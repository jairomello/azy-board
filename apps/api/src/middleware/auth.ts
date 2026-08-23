import type { Context, Next } from 'hono'
import type { HonoEnv } from '../types/hono'
import { getCookie } from 'hono/cookie'
import { eq, and } from 'drizzle-orm'
import { hasGlobalGroup, isGlobalGroup, verifyJwt } from '../services/auth'
import { db } from '../db/index'
import { apiKeys, memberships } from '../db/schema'
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
      const persisted = await db.query.users.findFirst({
        // [TENANT] Grupo e identidade vêm do banco, não de valores enviados pelo cliente.
        where: (u) => and(eq(u.id, payload.sub), eq(u.tenantId, payload.tenantId)),
        columns: { id: true, tenantId: true, email: true, globalGroup: true },
      })
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
      const keyRecord = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, keyHash))
        .limit(1)
        .then(r => r[0])

      if (keyRecord) {
        const now = new Date().toISOString()
        const expired = keyRecord.expiresAt != null && keyRecord.expiresAt <= now
        const revoked = keyRecord.revokedAt != null
        const projectScope = parseScope(keyRecord.projectScope)
        const permissionScope = parseScope(keyRecord.permissionScope)
        const requestedProjectId = c.req.param('projectId') ?? c.req.param('id')
        // [TENANT] Escopo da chave só pode restringir projetos do próprio tenant.
        if ((keyRecord.projectScope && !projectScope) || (keyRecord.permissionScope && !permissionScope)) {
          return c.json({ error: 'Não autorizado' }, 401)
        }
        if (expired || revoked || (requestedProjectId && projectScope && !projectScope.includes(requestedProjectId))) {
          return c.json({ error: 'Não autorizado' }, 401)
        }
        const owner = await db.query.users.findFirst({
          where: (u) => and(eq(u.id, keyRecord.ownerId), eq(u.tenantId, keyRecord.tenantId)),
        })
        if (owner) {
          // [TENANT] tenant_id da API Key garante que agente opera no tenant correto
          ctx = { userId: owner.id, tenantId: keyRecord.tenantId, email: owner.email, globalGroup: owner.globalGroup }
          c.set('apiKeyId', keyRecord.id)
          c.set('aiModelName', keyRecord.aiModelName)
          c.set('apiKeyProjectScope', projectScope)
          c.set('apiKeyPermissionScope', permissionScope)
          await db.update(apiKeys).set({ lastUsedAt: now }).where(eq(apiKeys.id, keyRecord.id))
        }
      }
    }
  }

  if (!ctx) {
    return c.json({ error: 'Não autorizado' }, 401)
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

    if (!projectId) return c.json({ error: 'Projeto não especificado' }, 400)

    const membership = await db.query.memberships.findFirst({
      where: (m) =>
        // [TENANT] Duplo filtro: tenant_id + userId + projectId — nunca confiar só no projectId
        and(
          eq(m.tenantId, ctx.tenantId),
          eq(m.userId, ctx.userId),
          eq(m.projectId, projectId)
        ),
    })

    const globalAdmin = hasGlobalGroup(ctx.globalGroup, 'ADMIN')
    if (!membership && !globalAdmin) {
      // Retorna 404 para não revelar se o projeto existe para outro tenant
      return c.json({ error: 'Projeto não encontrado' }, 404)
    }

    const roleHierarchy: Record<MemberRole, number> = { ADMIN: 3, MEMBER: 2, VIEWER: 1 }
    if (!globalAdmin && minRole === 'ADMIN' && !hasGlobalGroup(ctx.globalGroup, 'MANAGER')) {
      return c.json({ error: 'Permissão insuficiente' }, 403)
    }
    if (!globalAdmin && membership && roleHierarchy[membership.role] < roleHierarchy[minRole] && !(hasGlobalGroup(ctx.globalGroup, 'MANAGER') && minRole === 'ADMIN')) {
      return c.json({ error: 'Permissão insuficiente' }, 403)
    }
    const permissionScope = c.get('apiKeyPermissionScope')
    if (permissionScope) {
      const requiredPermission = minRole === 'VIEWER' ? 'read' : minRole === 'MEMBER' ? 'write' : 'admin'
      if (!permissionScope.includes(requiredPermission) && !permissionScope.includes('admin')) {
        return c.json({ error: 'Permissão insuficiente para esta API Key' }, 403)
      }
    }

    c.set('memberRole', globalAdmin ? 'ADMIN' : membership?.role ?? 'MEMBER')
    await next()
  }
}

export function requireGlobalGroup(minimum: GlobalGroup) {
  return async (c: Context<HonoEnv>, next: Next) => {
    const ctx = c.get('ctx') as RequestContext
    if (!hasGlobalGroup(ctx.globalGroup, minimum)) return c.json({ error: 'Permissão insuficiente' }, 403)
    await next()
  }
}

function parseScope(value: string | null): string[] | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? parsed : null
  } catch {
    return null
  }
}

async function hashApiKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Buffer.from(buf).toString('hex')
}
