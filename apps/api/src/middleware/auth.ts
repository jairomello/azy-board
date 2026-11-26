import type { Context, Next } from 'hono'
import type { HonoEnv } from '../types/hono'
import { getCookie, setCookie } from 'hono/cookie'
import { isGlobalGroup, verifyJwt, signJwt, SESSION_COOKIE, sessionCookieOptions, resolveSessionState } from '../services/auth'
import { hasGlobalGroup, isValidApiKeyPermissionScope, parseApiKeyScope } from '../services/authorization'
import { persistence } from '../persistence/runtime'
import { authorizeProjectRole } from '../services/projectAuthorization'
import type { RequestContext } from '@azy-board/api-contracts'
import type { GlobalGroup, MemberRole } from '@azy-board/domain'

/**
 * Identidade já resolvida pelo MCP remoto para a execução in-process das
 * ferramentas (conexão OAuth). Só chega pelo binding do `app.fetch` interno,
 * marcado por um Symbol privado: requisições externas não alcançam esse canal.
 */
export type McpPrincipal = {
  ctx: RequestContext
  oauthGrantId: string
  clientName: string
  permissionScope: string[]
  projectScope: string[] | null
}

export const MCP_INTERNAL = Symbol('azyboard.mcp.internal')

export type McpInternalBinding = {
  [MCP_INTERNAL]: {
    /** Conexão OAuth já validada pelo MCP. */
    principal?: McpPrincipal
    /** MCP de projeto: restringe o escopo de projeto da credencial a este projeto. */
    projectLock?: string
  }
}

function mcpInternal(c: Context<HonoEnv>): McpInternalBinding[typeof MCP_INTERNAL] | null {
  const env = c.env as Partial<McpInternalBinding> | undefined
  return (env && typeof env === 'object' && env[MCP_INTERNAL]) || null
}

/** Escopo de projeto efetivo: a trava do MCP de projeto só restringe. */
function lockProjectScope(scope: string[] | null, lock: string | undefined): string[] | null {
  if (!lock) return scope
  return scope ? scope.filter(projectId => projectId === lock) : [lock]
}

/** Tokens OAuth do MCP nunca autenticam a API REST diretamente. */
function isOAuthToken(rawToken: string): boolean {
  return rawToken.startsWith('azo_') || rawToken.startsWith('azr_')
}

/** Sessão humana pelo cookie HttpOnly (com renovação deslizante). */
async function resolveSessionContext(c: Context<HonoEnv>): Promise<RequestContext | null> {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return null
  try {
    const payload = await verifyJwt(token)
    // [SESSION] Renovação deslizante para sessão humana; expiração absoluta força 401.
    const session = resolveSessionState(payload, Math.floor(Date.now() / 1000))
    if (session.expired) return null
    const persisted = await persistence.identity.findUser({
      tenantId: payload.tenantId, actorUserId: payload.sub, actorKind: 'SYSTEM',
    }, payload.sub)
    if (!persisted || !isGlobalGroup(persisted.globalGroup)) return null
    if (session.renew) {
      const renewed = await signJwt({
        sub: persisted.id, tenantId: persisted.tenantId, email: persisted.email, role: 'user', globalGroup: persisted.globalGroup,
      }, { ttlSeconds: session.ttlSeconds, remembered: session.remembered, authTime: session.authTime })
      setCookie(c, SESSION_COOKIE, renewed, sessionCookieOptions(session.ttlSeconds))
    }
    return { userId: persisted.id, tenantId: persisted.tenantId, email: persisted.email, globalGroup: persisted.globalGroup }
  } catch {
    // Token inválido ou expirado
    return null
  }
}

/**
 * Rotas que exigem a pessoa no navegador (consentimento OAuth, conexões MCP):
 * só o cookie de sessão autentica; API Key e tokens OAuth são recusados.
 */
export async function requireHumanSession(c: Context<HonoEnv>, next: Next) {
  const ctx = await resolveSessionContext(c)
  if (!ctx) return c.json({ error: 'Não autorizado', code: 'UNAUTHORIZED', retryable: false }, 401)
  c.set('ctx', ctx)
  await next()
}

/** Requisição feita por agente (API Key ou conexão OAuth do MCP). */
export function isAgentRequest(c: Context<HonoEnv>): boolean {
  return Boolean(c.get('apiKeyId') || c.get('oauthGrantId'))
}

/** Origem da mutação para auditoria: MCP para agentes, REST para humanos. */
export function requestOrigin(c: Context<HonoEnv>): 'MCP' | 'REST' {
  return isAgentRequest(c) ? 'MCP' : 'REST'
}

// [TENANT] Middleware principal: resolve tenant_id e userId de toda requisição autenticada.
// Aceita JWT (usuários humanos), API Key (agentes de IA) ou a identidade de uma
// conexão OAuth já resolvida pelo MCP (somente pelo binding interno).
// Sem tenant_id resolvível → 401, sem exceção.
export async function authMiddleware(c: Context<HonoEnv>, next: Next) {
  let ctx: RequestContext | null = null
  const internal = mcpInternal(c)
  const requestedProjectId = c.req.param('projectId') ?? c.req.param('id')

  // Conexão OAuth do MCP: identidade e escopos validados pelo endpoint MCP.
  if (internal?.principal) {
    const { principal } = internal
    const projectScope = lockProjectScope(principal.projectScope, internal.projectLock)
    if (requestedProjectId && projectScope && !projectScope.includes(requestedProjectId)) {
      return c.json({ error: 'Não autorizado', code: 'UNAUTHORIZED', retryable: false }, 401)
    }
    c.set('ctx', principal.ctx)
    c.set('oauthGrantId', principal.oauthGrantId)
    c.set('aiModelName', principal.clientName)
    c.set('apiKeyName', principal.clientName)
    c.set('apiKeyProjectScope', projectScope)
    c.set('apiKeyPermissionScope', principal.permissionScope)
    await next()
    return
  }

  // Tentar autenticação por JWT (cookie HttpOnly)
  ctx = await resolveSessionContext(c)

  // Tentar autenticação por API Key (agentes de IA)
  if (!ctx) {
    const authHeader = c.req.header('Authorization')
    if (authHeader?.startsWith('Bearer ') && !isOAuthToken(authHeader.slice(7))) {
      const rawKey = authHeader.slice(7)
      const keyHash = await hashApiKey(rawKey)

      // [TENANT] API Key armazena tenant_id — resolve o contexto de tenant do agente
      const keyRecord = await persistence.apiKeys.findByHash(keyHash)

      if (keyRecord) {
        const now = new Date().toISOString()
        const expired = keyRecord.expiresAt != null && keyRecord.expiresAt <= now
        const revoked = keyRecord.revokedAt != null
        const keyProjectScope = parseApiKeyScope(keyRecord.projectScope)
        const projectScope = lockProjectScope(keyProjectScope, internal?.projectLock)
        const permissionScope = parseApiKeyScope(keyRecord.permissionScope)
        // [TENANT] Escopo da chave só pode restringir projetos do próprio tenant.
        if ((keyRecord.projectScope && !keyProjectScope) || (keyRecord.permissionScope && !permissionScope) || !isValidApiKeyPermissionScope(permissionScope)) {
          return c.json({ error: 'Não autorizado', code: 'UNAUTHORIZED', retryable: false }, 401)
        }
        if (expired || revoked || (requestedProjectId && projectScope && !projectScope.includes(requestedProjectId))) {
          return c.json({ error: 'Não autorizado', code: 'UNAUTHORIZED', retryable: false }, 401)
        }
        const owner = await persistence.identity.findUser({
          tenantId: keyRecord.tenantId, actorUserId: keyRecord.ownerId, actorKind: 'SYSTEM',
        }, keyRecord.ownerId)
        if (owner && owner.tenantId === keyRecord.tenantId && isGlobalGroup(owner.globalGroup)) {
          // [TENANT] tenant_id da API Key garante que agente opera no tenant correto
          ctx = { userId: owner.id, tenantId: keyRecord.tenantId, email: owner.email, globalGroup: owner.globalGroup }
          c.set('apiKeyId', keyRecord.id)
          c.set('aiModelName', keyRecord.aiModelName)
          c.set('apiKeyName', keyRecord.name)
          c.set('apiKeyProjectScope', projectScope)
          c.set('apiKeyPermissionScope', permissionScope)
          await persistence.apiKeys.updateLastUsed({ tenantId: keyRecord.tenantId, actorUserId: owner.id, actorKind: 'SYSTEM' }, keyRecord.id, now)
        }
      }
    }
  }

  if (!ctx) {
    return c.json({ error: 'Não autorizado', code: 'UNAUTHORIZED', retryable: false }, 401)
  }

  // Injeta contexto na requisição para uso nos handlers
  c.set('ctx', ctx)
  await next()
}

// Middleware RBAC: verifica se usuário tem o papel mínimo no projeto
// [TENANT] Busca membership filtrando por tenant_id E project_id — anti-IDOR por design
export function requireRole(minRole: MemberRole) {
  return async (c: Context<HonoEnv>, next: Next) => {
    const ctx = c.get('ctx') as RequestContext
    const projectId = c.req.param('projectId') ?? c.req.param('id')

    if (!projectId) return c.json({ error: 'Projeto não especificado', code: 'INVALID_REQUEST', retryable: false }, 400)

    const permissionScope = c.get('apiKeyPermissionScope')
    const authorization = await authorizeProjectRole(ctx, projectId, minRole, permissionScope)
    if (!authorization.ok) return c.json(authorization.body, authorization.status)
    c.set('memberRole', authorization.memberRole)
    await next()
  }
}

export function requireGlobalGroup(minimum: GlobalGroup) {
  return async (c: Context<HonoEnv>, next: Next) => {
    const ctx = c.get('ctx') as RequestContext
    if (!hasGlobalGroup(ctx.globalGroup, minimum)) return c.json({ error: 'Permissão insuficiente', code: 'FORBIDDEN', retryable: false }, 403)
    await next()
  }
}

async function hashApiKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Buffer.from(buf).toString('hex')
}
