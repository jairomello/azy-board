import { createHmac, timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import type { RequestContext } from '@azy-board/api-contracts'
import { createItemApplication } from '../application/items'
import { userMutationContext } from '../persistence/context'
import { logger } from '../services/logger'

// E5 — criação de card pelo Teams via outgoing webhook.
// O Teams assina o corpo com HMAC-SHA256 usando o token de segurança do webhook.
// A configuração por projeto entra nas próximas etapas; neste primeiro corte ela
// vem do ambiente para permitir o teste ponta a ponta com o canal real.

const MAX_BODY_BYTES = 32_768

interface TeamsIntegrationConfig {
  token: string
  secret: string
  tenantId: string
  projectId: string
  actorUserId: string
  actorEmail: string
  webBase: string
  parentId: string
  moduleId: string
}

function readConfig(): TeamsIntegrationConfig {
  return {
    token: process.env.AZY_TEAMS_TOKEN ?? '',
    secret: process.env.AZY_TEAMS_SECRET ?? '',
    tenantId: process.env.AZY_TEAMS_TENANT_ID ?? '',
    projectId: process.env.AZY_TEAMS_PROJECT_ID ?? '',
    actorUserId: process.env.AZY_TEAMS_ACTOR_USER_ID ?? '',
    actorEmail: process.env.AZY_TEAMS_ACTOR_EMAIL ?? '',
    webBase: process.env.AZY_TEAMS_WEB_BASE ?? 'http://localhost:8180',
    parentId: process.env.AZY_TEAMS_PARENT_ID ?? '',
    moduleId: process.env.AZY_TEAMS_MODULE_ID ?? '',
  }
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
    // O Teams envia HTML: quebra de linha vira espaço e TODA tag sai (inclusive <at>).
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|tr)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

interface ParsedCommand {
  title: string
  type?: 'TASK' | 'BUG'
  startDate?: string
  dueDate?: string
  description?: string
  ignored: string[]
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

export const teamsIntegrationRouter = new Hono()

teamsIntegrationRouter.post('/messages/:token', async (c) => {
  const config = readConfig()
  if (!config.token || c.req.param('token') !== config.token) {
    return c.json({ error: 'Integração não encontrada' }, 404)
  }

  const rawBody = await c.req.text()
  if (rawBody.length > MAX_BODY_BYTES) return c.json({ error: 'Payload muito grande' }, 413)

  const signature = (c.req.header('authorization') ?? '').replace(/^HMAC\s+/i, '')
  if (!signatureMatches(rawBody, signature, config.secret)) {
    return c.json({ error: 'Assinatura inválida' }, 401)
  }

  let payload: { id?: string; text?: string; from?: { name?: string } }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return c.json({ type: 'message', text: 'Não consegui ler a mensagem.' })
  }

  const text = cleanText(payload.text ?? '')
  logger.info('teams-integration: mensagem recebida', { text: text.slice(0, 200) })
  const command = parseCommand(text)
  if (!command) {
    return c.json({ type: 'message', text: 'Use `@Azy criar <título>; descrição <texto>; data inicio dd/mm/aa; data fim dd/mm/aa.` para abrir um card no Backlog.' })
  }
  if (!command.title || command.title.length > 500) {
    return c.json({ type: 'message', text: 'Informe um título de até 500 caracteres depois de `criar`.' })
  }

  const context: RequestContext = {
    userId: config.actorUserId,
    tenantId: config.tenantId,
    email: config.actorEmail,
    globalGroup: 'ADMIN',
  }

  try {
    const result = await createItemApplication({
      context,
      projectId: config.projectId,
      minimumRole: 'MEMBER',
      permissionScope: undefined,
      mutationContext: userMutationContext(context, 'TEAMS'),
      body: {
        title: command.title,
        type: command.type ?? 'TASK',
        ...(config.parentId ? { parentId: config.parentId } : {}),
        ...(config.moduleId ? { moduleId: config.moduleId } : {}),
        priority: 'MEDIUM',
        ...(command.startDate ? { startDate: command.startDate } : {}),
        ...(command.dueDate ? { dueDate: command.dueDate } : {}),
        ...(command.description
          ? { description: command.description }
          : payload.from?.name ? { description: `Criado pelo Teams por ${payload.from.name}.` } : {}),
        externalSource: 'TEAMS',
        ...(payload.id ? { externalRef: payload.id.slice(0, 200) } : {}),
      },
    })
    if (!result.ok) {
      return c.json({ type: 'message', text: `Não consegui criar o card: ${result.body?.error ?? 'erro de validação'}.` })
    }
    const record = result.record
    const code = record.sequenceCode ?? record.id
    const link = `${config.webBase}/projects/${config.projectId}/board?itemId=${record.id}`
    const dates = [command.startDate ? `início ${command.startDate}` : null, command.dueDate ? `fim ${command.dueDate}` : null].filter(Boolean)
    const extra = command.ignored.length ? `\nNão entendi: ${command.ignored.join(' · ')}.` : ''
    return c.json({
      type: 'message',
      text: `Card **${code} — ${command.title}** criado no Backlog${dates.length ? ` (${dates.join(', ')})` : ''}.\n[Abrir no Azy Board](${link})${extra}`,
    })
  } catch (error) {
    logger.error('teams-integration: falha ao criar card', { error: error instanceof Error ? error.message : String(error) })
    return c.json({ type: 'message', text: 'Erro interno ao criar o card. Tente novamente.' })
  }
})
