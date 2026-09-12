import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index'
import { attachments, items } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import { storage } from '../services/storage'
import { generateId } from '../utils/id'
import type { RequestContext } from '@azy-board/types'

export const attachmentsRouter = new Hono<HonoEnv>()
attachmentsRouter.use('*', authMiddleware)

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE ?? String(10 * 1024 * 1024)) // 10 MB

// [SECURITY] Allowlist de tipos aceitos no upload. HTML/SVG ficam fora:
// podem carregar script e seriam executados na origem da aplicação.
export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp',
  'application/pdf',
  'text/plain', 'text/markdown', 'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'application/gzip', 'application/x-7z-compressed',
  'audio/mpeg', 'audio/wav', 'audio/ogg',
  'video/mp4', 'video/webm',
])

// [SECURITY] Apenas imagens rasterizadas podem ser exibidas inline na mesma
// origem; qualquer outro tipo é baixado como attachment.
const INLINE_SAFE_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp',
])

export function normalizeMimeType(mimeType: string): string {
  return mimeType.split(';')[0]!.trim().toLowerCase()
}

export function isAllowedAttachmentMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(normalizeMimeType(mimeType))
}

// [SECURITY] Content-Disposition seguro: nome ASCII entre aspas + RFC 5987 para UTF-8.
function contentDispositionFor(mimeType: string, originalName: string): string {
  const inline = INLINE_SAFE_MIME_TYPES.has(mimeType)
  const asciiName = originalName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_').trim() || 'attachment'
  const encodedName = encodeURIComponent(originalName).replace(/['()]/g, '')
  return `${inline ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`
}

function attachmentUrl(projectId: string, itemId: string, attachmentId: string): string {
  return `/api/projects/${projectId}/items/${itemId}/attachments/${attachmentId}/download`
}

// POST /projects/:projectId/items/:itemId/attachments
attachmentsRouter.post('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  // [TENANT] Verifica que o item pertence ao tenant — anti-IDOR
  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, ctx.tenantId), eq(i.projectId, projectId)),
  })
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  if (!file) return c.json({ error: 'Arquivo não enviado' }, 400)

  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024} MB` }, 413)
  }

  // [SECURITY] Rejeita tipos fora da allowlist (HTML, SVG, executáveis etc.)
  if (!isAllowedAttachmentMimeType(file.type)) {
    return c.json({
      error: 'Tipo de arquivo não permitido',
      code: 'UNSUPPORTED_MEDIA_TYPE',
      allowed: [...ALLOWED_MIME_TYPES].sort(),
    }, 415)
  }

  const buffer = await file.arrayBuffer()
  const mimeType = normalizeMimeType(file.type)
  const { storagePath } = await storage.upload(
    ctx.tenantId,
    itemId,
    file.name,
    buffer,
    mimeType
  )

  const id = generateId()
  await db.insert(attachments).values({
    id,
    // [TENANT] Anexo sempre vinculado ao tenant
    tenantId: ctx.tenantId,
    itemId,
    filename: storagePath.split('/').pop()!,
    originalName: file.name,
    mimeType,
    size: file.size,
    storagePath,
    createdAt: new Date().toISOString(),
  })

  return c.json({ id, url: attachmentUrl(projectId, itemId, id), filename: file.name, mimeType, size: file.size }, 201)
})

// GET /projects/:projectId/items/:itemId/attachments
attachmentsRouter.get('/', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  // [TENANT] Anti-IDOR: verifica item antes de listar anexos
  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, ctx.tenantId), eq(i.projectId, projectId)),
  })
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const result = await db.select({
    id: attachments.id,
    filename: attachments.originalName,
    mimeType: attachments.mimeType,
    size: attachments.size,
    createdAt: attachments.createdAt,
  }).from(attachments)
    .where(and(eq(attachments.itemId, itemId), eq(attachments.tenantId, ctx.tenantId)))

  const withUrls = result.map(a => ({
    ...a,
    // [SECURITY] URL aponta para a rota autorizada por attachmentId — nunca para o caminho de disco.
    url: attachmentUrl(projectId, itemId, a.id),
    isImage: a.mimeType.startsWith('image/'),
  }))

  return c.json(withUrls)
})

// GET /projects/:projectId/items/:itemId/attachments/:attachmentId/download
// [SECURITY] Rota canônica de download: requireRole valida membership do projeto
// (incluindo visibilidade de projeto restrito), o item ancora o anexo no projeto
// e o conteúdo sai do storagePath persistido — nunca do path da URL.
attachmentsRouter.get('/:attachmentId/download', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, attachmentId } = c.req.param()

  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, ctx.tenantId), eq(i.projectId, projectId)),
    columns: { id: true },
  })
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const attachment = await db.query.attachments.findFirst({
    where: (a) => and(eq(a.id, attachmentId), eq(a.itemId, itemId), eq(a.tenantId, ctx.tenantId)),
  })
  if (!attachment) return c.json({ error: 'Anexo não encontrado' }, 404)

  const file = Bun.file(attachment.storagePath)
  if (!(await file.exists())) return c.json({ error: 'Arquivo não encontrado' }, 404)

  return new Response(file, {
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Length': String(attachment.size),
      'Content-Disposition': contentDispositionFor(attachment.mimeType, attachment.originalName),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
})

// DELETE /projects/:projectId/items/:itemId/attachments/:attachmentId
attachmentsRouter.delete('/:attachmentId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, attachmentId } = c.req.param()

  // [TENANT] O item ancora o anexo no projeto informado e impede deleção cross-project.
  const item = await db.query.items.findFirst({
    where: (candidate) => and(eq(candidate.id, itemId), eq(candidate.projectId, projectId), eq(candidate.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const attachment = await db.query.attachments.findFirst({
    where: (a) => and(eq(a.id, attachmentId), eq(a.itemId, itemId), eq(a.tenantId, ctx.tenantId)),
  })
  if (!attachment) return c.json({ error: 'Anexo não encontrado' }, 404)

  await storage.delete(attachment.storagePath)
  await db.delete(attachments).where(and(eq(attachments.id, attachmentId), eq(attachments.itemId, itemId), eq(attachments.tenantId, ctx.tenantId)))

  return c.json({ ok: true })
})
