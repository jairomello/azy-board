import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import type { RequestContext } from '@azy-board/api-contracts'
import type { HonoEnv } from '../types/hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import { createItemApplication } from '../application/items'
import { userMutationContext, userPersistenceContext } from '../persistence/context'
import { persistence } from '../persistence/runtime'
import { logger } from '../services/logger'

// E5 — criação de card pelo Teams via outgoing webhook.
// O Teams assina o corpo com HMAC-SHA256 usando o token de segurança do webhook.
// A integração é resolvida pelo token público da URL e vive no banco por projeto.

const MAX_BODY_BYTES = 32_768
const RATE_LIMIT_PER_MINUTE = 30
const KIND = 'TEAMS_WEBHOOK'

interface TeamsPayload {
  id?: string
  text?: string
  from?: { name?: string }
}

interface ParsedCommand {
  title: string
  type?: 'TASK' | 'BUG'
  startDate?: string
  dueDate?: string
  description?: string
  ignored: string[]
}

function signatureMatches(rawBody: string, header: string, secret: string): boolean {
  if (!secret || !header) return false
  const expected = createHmac('sha256', Buffer.from(secret, 'base64')).update(rawBody).digest()
  let received: Buffer
  try {
    received = Buffer.from(header, 'base64')
  } catch {
    return false
  }
  if (received.length !== expected.length) return false
  return timingSafeEqual(received, expected)
}

function cleanText(text: string): string {
  return text
    // O Teams envia HTML: toda tag sai (inclusive a menção `<at>`).
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|tr)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u200b|\u200c|\u200d|\ufeff/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDate(value: string): string | null {
  const cleaned = value.trim().replace(/\.$/, '')
  const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return cleaned
  const br = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (!br) return null
  const year = br[3].length === 2 ? `20${br[3]}` : br[3]
  const month = Number(br[2]); const day = Number(br[1])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseCommand(text: string): ParsedCommand | null {
  // Tolera a menção remanescente ("Azy criar ...") e comandos no meio da frase.
  const withoutMention = text.replace(/^@?azy\b[\s,:;-]*/i, '').trim()
  const match = withoutMention.match(/(?:^|\s)criar\s+(.+)$/i)
  if (!match) return null
  // Sintaxe curta: "criar <título>; <descrição>; <data>; <data>".
  // Também aceita rótulos explícitos (descrição / data inicio / data fim) e o
  // separador "|" de mensagens antigas.
  const parts = match[1].split(/[;|]/).map(part => part.trim().replace(/\.$/, '')).filter(Boolean)
  const command: ParsedCommand = { title: parts.shift() ?? '', ignored: [] }
  for (const field of parts) {
    const descriptionField = field.match(/^(?:descri[cç][aã]o|desc)\s*[:=]?\s*(.+)$/i)
    if (descriptionField) { command.description = descriptionField[1].trim().slice(0, 4000); continue }

    const typeField = field.match(/^tipo\s*[:=]\s*(bug|tarefa|task)$/i)
    if (typeField) { command.type = /bug/i.test(typeField[1]) ? 'BUG' : 'TASK'; continue }

    const labeledDate = field.match(/^(?:data\s*(?:de\s*)?)?(in[ií]cio|fim)\s*[:=]?\s*(.+)$/i)
    if (labeledDate) {
      const date = parseDate(labeledDate[2])
      if (date) {
        if (/^in/i.test(labeledDate[1])) command.startDate = date
        else command.dueDate = date
        continue
      }
    }

    // Data solta: a primeira vira início, a segunda vira fim.
    const bareDate = parseDate(field)
    if (bareDate) {
      if (!command.startDate) command.startDate = bareDate
      else if (!command.dueDate) command.dueDate = bareDate
      else command.ignored.push(field.slice(0, 40))
      continue
    }

    // Texto livre depois do título é a descrição.
    if (!command.description) { command.description = field.slice(0, 4000); continue }
    command.ignored.push(field.slice(0, 40))
  }
  return command
}

function publicBaseUrl(requestUrl: string): string {
  return process.env.AZY_PUBLIC_API_URL || new URL(requestUrl).origin
}

/** Base do web para o link do card. Em produção é a mesma origem da API. */
function webBaseUrl(requestUrl: string): string {
  return process.env.AZY_PUBLIC_WEB_URL || new URL(requestUrl).origin
}

export const teamsIntegrationRouter = new Hono<HonoEnv>()

teamsIntegrationRouter.post('/messages/:token', async (c) => {
  const integration = await persistence.integrations.getByPublicToken(c.req.param('token'))
  if (!integration || !integration.enabled) return c.json({ error: 'Integração não encontrada' }, 404)

  const rawBody = await c.req.text()
  if (rawBody.length > MAX_BODY_BYTES) return c.json({ error: 'Payload muito grande' }, 413)

  const signature = (c.req.header('authorization') ?? '').replace(/^HMAC\s+/i, '')
  if (!signatureMatches(rawBody, signature, integration.teamsSecret)) {
    return c.json({ error: 'Assinatura inválida' }, 401)
  }

  // Limite por integração: o endpoint é público e assinado, mas não ilimitado.
  const since = new Date(Date.now() - 60_000).toISOString()
  if (await persistence.integrations.countRecentMessages(integration.id, since) >= RATE_LIMIT_PER_MINUTE) {
    return c.json({ error: 'Limite de mensagens por minuto excedido' }, 429, { 'Retry-After': '60' })
  }

  let payload: TeamsPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return c.json({ type: 'message', text: 'Não consegui ler a mensagem.' })
  }

  const messageId = payload.id ?? createHash('sha256').update(rawBody).digest('hex')

  // Idempotência: o Teams pode reenviar a mesma mensagem.
  const previous = await persistence.integrations.findMessage(integration.id, messageId)
  if (previous) {
    if (previous.status === 'CREATED' && previous.itemId) {
      const link = `${webBaseUrl(c.req.url)}/projects/${integration.projectId}/board?itemId=${previous.itemId}`
      return c.json({ type: 'message', text: `Card já criado para esta mensagem.\n[Abrir no Azy Board](${link})` })
    }
    return c.json({ type: 'message', text: previous.error ?? 'Esta mensagem já foi processada.' })
  }

  const text = cleanText(payload.text ?? '')
  const command = parseCommand(text)
  const record = (status: 'CREATED' | 'IGNORED' | 'ERROR', itemId: string | null, error: string | null) =>
    persistence.integrations.recordMessage({
      integrationId: integration.id, tenantId: integration.tenantId, projectId: integration.projectId,
      teamsMessageId: messageId, status, itemId, error,
    })

  if (!command) {
    const help = 'Use `@Azy criar <título>; <descrição>; <data inicio>; <data fim>.` para abrir um card no Backlog.'
    await record('IGNORED', null, help)
    return c.json({ type: 'message', text: help })
  }
  if (!command.title || command.title.length > 500) {
    const error = 'Informe um título de até 500 caracteres depois de `criar`.'
    await record('IGNORED', null, error)
    return c.json({ type: 'message', text: error })
  }
  if (!integration.createdBy) {
    const error = 'Integração sem responsável técnico configurado. Reconfigure em Configurações → Integrações.'
    await record('ERROR', null, error)
    return c.json({ type: 'message', text: error })
  }

  const context: RequestContext = {
    userId: integration.createdBy,
    tenantId: integration.tenantId,
    email: integration.createdByEmail ?? '',
    globalGroup: 'ADMIN',
  }

  try {
    const result = await createItemApplication({
      context,
      projectId: integration.projectId,
      minimumRole: 'MEMBER',
      permissionScope: undefined,
      mutationContext: userMutationContext(context, 'TEAMS'),
      body: {
        title: command.title,
        type: command.type ?? (integration.defaultType === 'BUG' ? 'BUG' : 'TASK'),
        ...(integration.parentItemId ? { parentId: integration.parentItemId } : {}),
        ...(integration.moduleId ? { moduleId: integration.moduleId } : {}),
        ...(integration.defaultColumnId ? { columnId: integration.defaultColumnId } : {}),
        priority: 'MEDIUM',
        ...(command.startDate ? { startDate: command.startDate } : {}),
        ...(command.dueDate ? { dueDate: command.dueDate } : {}),
        ...(command.description
          ? { description: command.description }
          : payload.from?.name ? { description: `Criado pelo Teams por ${payload.from.name}.` } : {}),
        externalSource: 'TEAMS',
        externalRef: messageId.slice(0, 200),
      },
    })
    if (!result.ok) {
      const error = `Não consegui criar o card: ${result.body?.error ?? 'erro de validação'}.`
      await record('ERROR', null, error)
      return c.json({ type: 'message', text: error })
    }
    const item = result.record
    const code = item.sequenceCode ?? item.id
    const link = `${webBaseUrl(c.req.url)}/projects/${integration.projectId}/board?itemId=${item.id}`
    const dates = [command.startDate ? `início ${command.startDate}` : null, command.dueDate ? `fim ${command.dueDate}` : null].filter(Boolean)
    const extra = command.ignored.length ? `\nNão entendi: ${command.ignored.join(' · ')}.` : ''
    await record('CREATED', item.id, null)
    return c.json({
      type: 'message',
      text: `Card **${code} — ${command.title}** criado no Backlog${dates.length ? ` (${dates.join(', ')})` : ''}.\n[Abrir no Azy Board](${link})${extra}`,
    })
  } catch (error) {
    logger.error('teams-integration: falha ao criar card', { error: error instanceof Error ? error.message : String(error) })
    await record('ERROR', null, 'Erro interno ao criar o card.')
    return c.json({ type: 'message', text: 'Erro interno ao criar o card. Tente novamente.' })
  }
})

// ---------------------------------------------------------------------------
// Configuração (ADMIN) — usada pela tela de configurações do projeto.
// ---------------------------------------------------------------------------
export const teamsConfigRouter = new Hono<HonoEnv>()
teamsConfigRouter.use('*', authMiddleware)

teamsConfigRouter.get('/', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const integration = await persistence.integrations.getByProject(userPersistenceContext(ctx), projectId, KIND)
  const messages = await persistence.integrations.listMessages(userPersistenceContext(ctx), projectId, KIND, 20)
  if (!integration) {
    return c.json({ enabled: false, configured: false, url: null, moduleId: null, parentItemId: null, defaultType: 'TASK', messages: [] })
  }
  return c.json({
    enabled: integration.enabled,
    configured: true,
    url: `${publicBaseUrl(c.req.url)}/api/integrations/teams/messages/${integration.publicToken}`,
    moduleId: integration.moduleId,
    parentItemId: integration.parentItemId,
    defaultType: integration.defaultType,
    messages: messages.map(message => ({
      teamsMessageId: message.teamsMessageId, status: message.status, itemId: message.itemId,
      error: message.error, createdAt: message.createdAt,
    })),
  })
})

teamsConfigRouter.put('/', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const body = await c.req.json().catch(() => null) as null | {
    teamsSecret?: string; moduleId?: string | null; parentItemId?: string | null
    defaultType?: string; enabled?: boolean
  }
  if (!body || typeof body.teamsSecret !== 'string' || body.teamsSecret.trim().length < 16) {
    return c.json({ error: 'Informe o token de segurança do Teams (mínimo 16 caracteres).' }, 422)
  }
  if (body.defaultType !== undefined && body.defaultType !== 'TASK' && body.defaultType !== 'BUG') {
    return c.json({ error: 'Tipo padrão deve ser TASK ou BUG.' }, 422)
  }
  const integration = await persistence.integrations.upsert(
    { ...userPersistenceContext(ctx), mutation: { origin: 'REST', correlationId: null, actorType: 'HUMAN', actorSource: 'REST', actorLabel: null } },
    projectId, KIND,
    {
      teamsSecret: body.teamsSecret.trim(),
      createdByEmail: ctx.email,
      ...(body.moduleId !== undefined ? { moduleId: body.moduleId } : {}),
      ...(body.parentItemId !== undefined ? { parentItemId: body.parentItemId } : {}),
      ...(body.defaultType !== undefined ? { defaultType: body.defaultType } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    },
  )
  return c.json({
    enabled: integration.enabled,
    configured: true,
    url: `${publicBaseUrl(c.req.url)}/api/integrations/teams/messages/${integration.publicToken}`,
    moduleId: integration.moduleId,
    parentItemId: integration.parentItemId,
    defaultType: integration.defaultType,
    messages: [],
  })
})

teamsConfigRouter.delete('/', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  await persistence.integrations.remove(
    { ...userPersistenceContext(ctx), mutation: { origin: 'REST', correlationId: null, actorType: 'HUMAN', actorSource: 'REST', actorLabel: null } },
    projectId, KIND,
  )
  return c.json({ ok: true })
})
