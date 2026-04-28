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

  const buffer = await file.arrayBuffer()
  const { storagePath, url } = await storage.upload(
    ctx.tenantId,
    itemId,
    file.name,
    buffer,
    file.type
  )

  const id = generateId()
  await db.insert(attachments).values({
    id,
    // [TENANT] Anexo sempre vinculado ao tenant
    tenantId: ctx.tenantId,
    itemId,
    filename: url.split('/').pop()!,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
    storagePath,
    createdAt: new Date().toISOString(),
  })

  return c.json({ id, url, filename: file.name, mimeType: file.type, size: file.size }, 201)
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
    url: attachments.storagePath,
    createdAt: attachments.createdAt,
  }).from(attachments)
    .where(and(eq(attachments.itemId, itemId), eq(attachments.tenantId, ctx.tenantId)))

  const withUrls = result.map(a => ({
    ...a,
    // [DB-SWAP] Para S3, substituir por URL pré-assinada gerada pelo S3StorageAdapter
    url: `/uploads/${ctx.tenantId}/${itemId}/${a.url.split('/').pop()}`,
    isImage: a.mimeType.startsWith('image/'),
  }))

  return c.json(withUrls)
})

// DELETE /projects/:projectId/items/:itemId/attachments/:attachmentId
attachmentsRouter.delete('/:attachmentId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const attachmentId = c.req.param('attachmentId')!

  const attachment = await db.query.attachments.findFirst({
    where: (a) => and(eq(a.id, attachmentId), eq(a.tenantId, ctx.tenantId)),
  })
  if (!attachment) return c.json({ error: 'Anexo não encontrado' }, 404)

  await storage.delete(attachment.storagePath)
  await db.delete(attachments).where(and(eq(attachments.id, attachmentId), eq(attachments.tenantId, ctx.tenantId)))

  return c.json({ ok: true })
})
