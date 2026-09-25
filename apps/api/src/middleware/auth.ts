import type { Context, Next } from 'hono'
import type { HonoEnv } from '../types/hono'
import { getCookie } from 'hono/cookie'
import { isGlobalGroup, verifyJwt } from '../services/auth'
import { hasGlobalGroup, hasMemberRole, hasKeyPermission, isValidApiKeyPermissionScope, parseApiKeyScope } from '../services/authorization'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'
import type { GlobalGroup, RequestContext, MemberRole } from '@azy-board/types'

// [TENANT] Middleware principal: resolve tenant_id e userId de toda requisição autenticada.
// Aceita JWT (usuários humanos) ou API Key (agentes de IA).
// Sem tenant_id resolvível → 401, sem exceção.
export async function authMiddleware(c: Context<HonoEnv>, next: Next) {
  let ctx: RequestContext | null = null

  // Tentar autenticação por JWT (cookie HttpOnly)
  const token = getCookie(c, 'session')
  if (token) {
    try {
      const payload = await verifyJwt(token)
      const persisted = await persistence.identity.findUser({
        tenantId: payload.tenantId, actorUserId: payload.sub, actorKind: 'SYSTEM',
      }, payload.sub)
      if (persisted && isGlobalGroup(persisted.globalGroup)) {
        ctx = { userId: persisted.id, tenantId: persisted.tenantId, email: persisted.email, globalGroup: persisted.globalGroup }
      }
    } catch {
      // Token inválido ou expirado
    }
  }

  // Tentar autenticação por API Key (agentes de IA)
  if (!ctx) {
    const authHeader = c.req.header('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const rawKey = authHeader.slice(7)
      const keyHash = await hashApiKey(rawKey)

      // [TENANT] API Key armazena tenant_id — resolve o contexto de tenant do agente
      const keyRecord = await persistence.apiKeys.findByHash(keyHash)

      if (keyRecord) {
        const now = new Date().toISOString()
        const expired = keyRecord.expiresAt != null && keyRecord.expiresAt <= now
        const revoked = keyRecord.revokedAt != null
        const projectScope = parseApiKeyScope(keyRecord.projectScope)
        const permissionScope = parseApiKeyScope(keyRecord.permissionScope)
        const requestedProjectId = c.req.param('projectId') ?? c.req.param('id')
        // [TENANT] Escopo da chave só pode restringir projetos do próprio tenant.
        if ((keyRecord.projectScope && !projectScope) || (keyRecord.permissionScope && !permissionScope) || !isValidApiKeyPermissionScope(permissionScope)) {
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

    // [TENANT] Resolve a visibilidade do projeto no tenant atual antes do bypass global.
    // Projeto restrito sem membership ou gerência não pode ser acessado por nenhuma rota.
    const persistenceContext = userPersistenceContext(ctx)
    const project = await persistence.projects.getProject(persistenceContext, projectId)
    if (!project) return c.json({ error: 'Projeto não encontrado', code: 'RESOURCE_NOT_FOUND', retryable: false }, 404)

    const membership = await persistence.projects.getMembership(persistenceContext, projectId, ctx.userId)

    const globalAdmin = hasGlobalGroup(ctx.globalGroup, 'ADMIN')
    const isProjectManager = project.managerUserId === ctx.userId
    if (project.isRestricted && !membership && !isProjectManager) {
      // Não revelar projeto restrito nem mesmo para ADMIN/ROOT, por URL ou API Key.
      return c.json({ error: 'Projeto não encontrado', code: 'RESOURCE_NOT_FOUND', retryable: false }, 404)
    }
    const isAssociated = Boolean(membership || isProjectManager)
    if (minRole === 'ADMIN' && !hasGlobalGroup(ctx.globalGroup, 'MANAGER')) {
      return c.json({ error: 'Permissão insuficiente', code: 'FORBIDDEN', retryable: false }, 403)
    }
    if (!isAssociated && !globalAdmin) {
      // Retorna 404 para não revelar se o projeto existe para outro tenant
      return c.json({ error: 'Projeto não encontrado', code: 'RESOURCE_NOT_FOUND', retryable: false }, 404)
    }

    if (!globalAdmin && !hasGlobalGroup(ctx.globalGroup, 'MANAGER') && !hasMemberRole(membership?.role, minRole) && !(isProjectManager && minRole === 'VIEWER')) {
      return c.json({ error: 'Permissão insuficiente', code: 'FORBIDDEN', retryable: false }, 403)
    }
    if (!globalAdmin && hasGlobalGroup(ctx.globalGroup, 'MANAGER') && minRole === 'ADMIN' && !membership && !isProjectManager) {
      return c.json({ error: 'Projeto não encontrado', code: 'RESOURCE_NOT_FOUND', retryable: false }, 404)
    }
    if (!globalAdmin && membership && !hasMemberRole(membership.role, minRole) && !(hasGlobalGroup(ctx.globalGroup, 'MANAGER') && minRole === 'ADMIN')) {
      return c.json({ error: 'Permissão insuficiente', code: 'FORBIDDEN', retryable: false }, 403)
    }
    const permissionScope = c.get('apiKeyPermissionScope')
    if (permissionScope) {
      const requiredPermission = minRole === 'VIEWER' ? 'read' : minRole === 'MEMBER' ? 'write' : 'admin'
      if (!hasKeyPermission(permissionScope, minRole)) {
        return c.json({ error: 'Permissão insuficiente', code: 'FORBIDDEN', retryable: false }, 403)
      }
    }

    c.set('memberRole', globalAdmin ? 'ADMIN' : membership?.role ?? 'MEMBER')
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
