import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import { createConfiguredStorageAdapter } from '../services/storage'
import { triggerStorageCleanupAfterCommit } from '../services/storageCleanup'
import { buildAttachmentReadResult, readLimitedBytes } from '../services/attachmentContent'
import type { RequestContext } from '@azy-board/api-contracts'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'
import type { AttachmentPatch, AttachmentRecord } from '../persistence/models'
import { attachmentMetadataSchema } from '../validation'
import { decryptAssistantSecret, encryptAssistantSecret } from '../services/assistantEncryption'
import { hasGlobalGroup } from '../services/auth'

export const attachmentsRouter = new Hono<HonoEnv>()
attachmentsRouter.use('*', authMiddleware)

export const attachmentSettingsRouter = new Hono<HonoEnv>()
attachmentSettingsRouter.use('*', authMiddleware)

function publicSettings(settings: Awaited<ReturnType<typeof persistence.attachmentSettings.get>>) {
  return {
    enabled: settings?.enabled ?? false,
    provider: settings?.provider ?? 'local',
    endpoint: settings?.endpoint ?? '',
    region: settings?.region ?? '',
    bucket: settings?.bucket ?? '',
    prefix: settings?.prefix ?? '',
    accessKeyId: settings?.accessKeyId ?? '',
    hasSecret: Boolean(settings?.secretCiphertext),
  }
}

attachmentSettingsRouter.get('/enabled', async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const settings = await persistence.attachmentSettings.get(ctx.tenantId)
  return c.json({ enabled: settings?.enabled ?? false })
})

attachmentSettingsRouter.get('/', async (c) => {
  const ctx = c.get('ctx') as RequestContext
  if (!hasGlobalGroup(ctx.globalGroup, 'MANAGER')) return c.json({ error: 'Permissão insuficiente' }, 403)
  return c.json(publicSettings(await persistence.attachmentSettings.get(ctx.tenantId)))
})

attachmentSettingsRouter.put('/', async (c) => {
  const ctx = c.get('ctx') as RequestContext
  if (!hasGlobalGroup(ctx.globalGroup, 'MANAGER')) return c.json({ error: 'Permissão insuficiente' }, 403)
  const body = await c.req.json<Record<string, unknown>>().catch(() => null)
  if (!body || typeof body.enabled !== 'boolean' || !['local', 's3'].includes(String(body.provider))) {
    return c.json({ error: 'Configuração de anexos inválida' }, 400)
  }
  const previous = await persistence.attachmentSettings.get(ctx.tenantId)
  const provider = body.provider as 'local' | 's3'
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim().replace(/\/+$/, '') : ''
  const region = typeof body.region === 'string' ? body.region.trim() : ''
  const bucket = typeof body.bucket === 'string' ? body.bucket.trim() : ''
  const prefix = typeof body.prefix === 'string' ? body.prefix.trim().replace(/^\/+|\/+$/g, '') : ''
  const accessKeyId = typeof body.accessKeyId === 'string' ? body.accessKeyId.trim() : ''
  const secret = typeof body.secret === 'string' ? body.secret : ''
  if (provider === 's3') {
    if (!region || !bucket || !accessKeyId || (!secret && !previous?.secretCiphertext)) {
      return c.json({ error: 'Informe região, bucket, access key e secret key para configurar S3.' }, 400)
    }
    if (endpoint) {
      try {
        const parsed = new URL(endpoint)
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error()
      } catch {
        return c.json({ error: 'Endpoint S3 inválido; informe uma URL HTTP ou HTTPS sem credenciais.' }, 400)
      }
    }
  }
  let secretCiphertext = provider === 's3' ? previous?.secretCiphertext ?? null : null
  let secretVersion = provider === 's3' ? previous?.secretVersion ?? null : null
  if (provider === 's3' && secret) {
    try {
      const encrypted = await encryptAssistantSecret(secret)
      secretCiphertext = encrypted.ciphertext
      secretVersion = encrypted.version
    } catch {
      return c.json({ error: 'Credencial não foi protegida. Configure ASSISTANT_ENCRYPTION_KEY no backend.' }, 503)
    }
  }
  const saved = await persistence.attachmentSettings.save(ctx.tenantId, {
    enabled: body.enabled,
    provider,
    endpoint: provider === 's3' ? endpoint || null : null,
    region: provider === 's3' ? region : null,
    bucket: provider === 's3' ? bucket : null,
    prefix: provider === 's3' ? prefix || null : null,
    accessKeyId: provider === 's3' ? accessKeyId : null,
    secretCiphertext,
    secretVersion,
  })
  return c.json(publicSettings(saved))
})

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE ?? String(10 * 1024 * 1024), 10) // 10 MB

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

function isValidContent(mimeType: string, data: Uint8Array): boolean {
  const starts = (...bytes: number[]) => bytes.every((byte, index) => data[index] === byte)
  const ascii = (start: number, length: number) => new TextDecoder().decode(data.slice(start, start + length))
  switch (mimeType) {
    case 'image/png': return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    case 'image/jpeg': return starts(0xff, 0xd8, 0xff)
    case 'image/gif': return ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a'
    case 'image/webp': return ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP'
    case 'image/avif': return ascii(4, 8).startsWith('ftypavif') || ascii(4, 8).startsWith('ftypavis')
    case 'image/bmp': return ascii(0, 2) === 'BM'
    case 'application/pdf': return ascii(0, 5) === '%PDF-'
    case 'application/zip':
    case 'application/x-7z-compressed':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return starts(0x50, 0x4b, 0x03, 0x04) || starts(0x50, 0x4b, 0x05, 0x06)
    case 'application/gzip': return starts(0x1f, 0x8b)
    case 'application/msword':
    case 'application/vnd.ms-excel':
    case 'application/vnd.ms-powerpoint': return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)
    case 'video/mp4': return ascii(4, 4) === 'ftyp'
    case 'audio/mpeg': return ascii(0, 3) === 'ID3' || (data[0] === 0xff && (data[1]! & 0xe0) === 0xe0)
    case 'audio/wav': return ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE'
    case 'audio/ogg': return ascii(0, 4) === 'OggS'
    case 'video/webm': return starts(0x1a, 0x45, 0xdf, 0xa3)
    default:
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(data)
        if (data.some(byte => byte < 0x09 || (byte > 0x0a && byte < 0x20))) return false
        if (mimeType === 'application/json') JSON.parse(text)
        return true
      } catch { return false }
  }
}

async function storageAdapterForTenant(tenantId: string, providerOverride?: 'local' | 's3') {
  const settings = await persistence.attachmentSettings.get(tenantId)
  const provider = providerOverride ?? settings?.provider ?? 'local'
  if (provider === 'local') return createConfiguredStorageAdapter({ provider })
  if (!settings?.secretCiphertext || !settings.secretVersion || !settings.accessKeyId || !settings.bucket || !settings.region) {
    throw new Error('Configuração S3 não disponível para este tenant.')
  }
  const secretAccessKey = await decryptAssistantSecret(settings.secretCiphertext, settings.secretVersion)
  return createConfiguredStorageAdapter({ provider: 's3', endpoint: settings.endpoint, region: settings.region,
    bucket: settings.bucket, prefix: settings.prefix, accessKeyId: settings.accessKeyId, secretAccessKey })
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

// Shape público de um anexo (lista, upload e edição de metadados).
function serializeAttachment(projectId: string, itemId: string, attachment: AttachmentRecord) {
  return {
    id: attachment.id,
    filename: attachment.fileName,
    originalName: attachment.originalName,
    label: attachment.label,
    referenceDate: attachment.referenceDate,
    description: attachment.description,
    mimeType: attachment.mimeType,
    size: attachment.sizeBytes,
    createdAt: attachment.createdAt,
    // [SECURITY] URL aponta para a rota autorizada por attachmentId — nunca para o caminho de disco.
    url: attachmentUrl(projectId, itemId, attachment.id),
    isImage: attachment.mimeType.startsWith('image/'),
  }
}

// POST /projects/:projectId/items/:itemId/attachments
attachmentsRouter.post('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  // [TENANT] Verifica que o item pertence ao tenant — anti-IDOR
  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)
  const settings = await persistence.attachmentSettings.get(ctx.tenantId)
  if (!settings?.enabled) return c.json({ error: 'Anexos estão desabilitados para este tenant' }, 409)

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
  if (!isValidContent(mimeType, new Uint8Array(buffer))) {
    return c.json({ error: 'O conteúdo do arquivo não corresponde ao tipo declarado', code: 'INVALID_FILE_CONTENT' }, 415)
  }

  // T10: metadados opcionais no upload; ausentes/brancos recebem sugestão automática.
  const metadata = attachmentMetadataSchema.safeParse({
    label: formData.get('label') ?? undefined,
    referenceDate: formData.get('referenceDate') ?? undefined,
    description: formData.get('description') ?? undefined,
  })
  if (!metadata.success) {
    return c.json({ error: 'Metadados do anexo inválidos', code: 'VALIDATION_ERROR', retryable: false }, 400)
  }
  const label = metadata.data.label ?? file.name.slice(0, 200)
  const referenceDate = metadata.data.referenceDate ?? new Date().toISOString().slice(0, 10)

  const adapter = await storageAdapterForTenant(ctx.tenantId, settings.provider)
  const { storagePath } = await adapter.upload(
    ctx.tenantId,
    itemId,
    file.name,
    buffer,
    mimeType
  )

  const created = await persistence.files.createAttachment(projectContext, projectId, itemId, {
    fileName: storagePath.split('/').pop()!,
    originalName: file.name,
    mimeType,
    sizeBytes: file.size,
    storagePath,
    storageProvider: settings.provider,
    label,
    referenceDate,
    description: metadata.data.description ?? null,
  })

  return c.json({
    id: created.id,
    url: attachmentUrl(projectId, itemId, created.id),
    filename: file.name,
    originalName: created.originalName,
    label: created.label,
    referenceDate: created.referenceDate,
    description: created.description,
    mimeType,
    size: file.size,
    createdAt: created.createdAt,
    isImage: mimeType.startsWith('image/'),
  }, 201)
})

// GET /projects/:projectId/items/:itemId/attachments
attachmentsRouter.get('/', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  // [TENANT] Anti-IDOR: verifica item antes de listar anexos
  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const result = await persistence.files.listAttachments(projectContext, projectId, itemId)
  return c.json(result.map(attachment => serializeAttachment(projectId, itemId, attachment)))
})

// GET /projects/:projectId/items/:itemId/attachments/:attachmentId/download
// [SECURITY] Rota canônica de download: requireRole valida membership do projeto
// (incluindo visibilidade de projeto restrito), o item ancora o anexo no projeto
// e o conteúdo sai do storagePath persistido — nunca do path da URL.
attachmentsRouter.get('/:attachmentId/download', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, attachmentId } = c.req.param()

  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const attachment = await persistence.files.getAttachment(projectContext, projectId, itemId, attachmentId)
  if (!attachment) return c.json({ error: 'Anexo não encontrado' }, 404)

  let body: BodyInit | null
  try {
    body = await (await storageAdapterForTenant(ctx.tenantId, attachment.storageProvider)).download(attachment.storagePath)
  } catch {
    return c.json({ error: 'O armazenamento deste anexo está indisponível' }, 503)
  }
  if (!body) return c.json({ error: 'Arquivo não encontrado' }, 404)

  return new Response(body, {
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Length': String(attachment.sizeBytes),
      'Content-Disposition': contentDispositionFor(attachment.mimeType, attachment.originalName),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
})

// GET /projects/:projectId/items/:itemId/attachments/:attachmentId/content
// Card T23 — leitura autorizada de conteúdo para o agente. Mesma autorização e
// ancoragem do download; a leitura é preservada mesmo com anexos desabilitados
// (desabilitar bloqueia upload/edição/remoção, não a leitura). Nunca expõe o
// caminho físico e sempre reporta limites (`truncated`/`reason`/`nextOffset`).
attachmentsRouter.get('/:attachmentId/content', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, attachmentId } = c.req.param()

  // [TENANT] Anti-IDOR: o item ancora o anexo no projeto informado.
  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const attachment = await persistence.files.getAttachment(projectContext, projectId, itemId, attachmentId)
  if (!attachment) return c.json({ error: 'Anexo não encontrado' }, 404)

  let body: BodyInit | null
  try {
    body = await (await storageAdapterForTenant(ctx.tenantId, attachment.storageProvider)).download(attachment.storagePath)
  } catch {
    return c.json({ error: 'O armazenamento deste anexo está indisponível' }, 503)
  }
  if (!body) return c.json({ error: 'Arquivo não encontrado' }, 404)

  const { bytes, truncated } = await readLimitedBytes(body)
  const rawOffset = Number(c.req.query('offset'))
  const result = buildAttachmentReadResult({
    mimeType: attachment.mimeType,
    bytes,
    bytesTruncated: truncated,
    offset: Number.isFinite(rawOffset) ? rawOffset : 0,
  })

  // [SECURITY] Só o conteúdo extraído e metadados seguros — nunca o storagePath.
  return c.json({
    attachmentId: attachment.id,
    attachmentName: attachment.originalName,
    mimeType: attachment.mimeType,
    format: result.format,
    text: result.text,
    encoding: result.encoding,
    totalBytes: attachment.sizeBytes,
    readBytes: bytes.byteLength,
    charCount: result.charCount,
    truncated: result.truncated,
    reason: result.reason,
    nextOffset: result.nextOffset,
  })
})

// PATCH /projects/:projectId/items/:itemId/attachments/:attachmentId
// T10: edição parcial de metadados — chave ausente preserva o valor; null (ou string
// em branco) limpa o campo. Last-write-wins (sem updated_at na tabela).
attachmentsRouter.patch('/:attachmentId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, attachmentId } = c.req.param()

  // [TENANT] O item ancora o anexo no projeto informado — anti-IDOR
  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)
  const settings = await persistence.attachmentSettings.get(ctx.tenantId)
  if (!settings?.enabled) return c.json({ error: 'Anexos estão desabilitados para este tenant' }, 409)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'JSON inválido', code: 'INVALID_REQUEST', retryable: false }, 400)
  }
  const parsed = attachmentMetadataSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Metadados do anexo inválidos', code: 'VALIDATION_ERROR', retryable: false }, 400)
  }
  // O patch é montado a partir das chaves presentes no corpo cru: o schema normaliza
  // ('' → null), mas a ausência de chave deve significar "não alterar".
  const raw = (body ?? {}) as Record<string, unknown>
  const patch: AttachmentPatch = {}
  if ('label' in raw) patch.label = parsed.data.label ?? null
  if ('referenceDate' in raw) patch.referenceDate = parsed.data.referenceDate ?? null
  if ('description' in raw) patch.description = parsed.data.description ?? null

  const updated = await persistence.files.updateAttachment(projectContext, projectId, itemId, attachmentId, patch)
  if (!updated) return c.json({ error: 'Anexo não encontrado' }, 404)

  return c.json(serializeAttachment(projectId, itemId, updated))
})

// DELETE /projects/:projectId/items/:itemId/attachments/:attachmentId
attachmentsRouter.delete('/:attachmentId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, attachmentId } = c.req.param()

  // [TENANT] O item ancora o anexo no projeto informado e impede deleção cross-project.
  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)
  const settings = await persistence.attachmentSettings.get(ctx.tenantId)
  if (!settings?.enabled) return c.json({ error: 'Anexos estão desabilitados para este tenant' }, 409)

  // Item 12: metadados saem em transação atômica; arquivo físico é removido
  // pós-commit via outbox de limpeza (idempotente, com retry).
  const removed = await persistence.files.deleteAttachmentWithCleanup(projectContext, projectId, itemId, attachmentId)
  if (!removed) return c.json({ error: 'Anexo não encontrado' }, 404)

  triggerStorageCleanupAfterCommit()

  return c.json({ ok: true })
})
