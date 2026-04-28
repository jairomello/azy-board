import type { Context, Next } from 'hono'
import type { HonoEnv } from '../types/hono'
import { getCookie } from 'hono/cookie'
import { eq, and } from 'drizzle-orm'
import { verifyJwt } from '../services/auth'
import { db } from '../db/index'
import { apiKeys, memberships } from '../db/schema'
import type { RequestContext, MemberRole } from '@azy-board/types'

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
      // [TENANT] tenant_id vem do JWT — cliente não pode falsificar
      ctx = { userId: payload.sub, tenantId: payload.tenantId, email: payload.email }
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
        const owner = await db.query.users.findFirst({
          where: (u) => and(eq(u.id, keyRecord.ownerId), eq(u.tenantId, keyRecord.tenantId)),
        })
        if (owner) {
          // [TENANT] tenant_id da API Key garante que agente opera no tenant correto
          ctx = { userId: owner.id, tenantId: keyRecord.tenantId, email: owner.email }
          c.set('apiKeyId', keyRecord.id)
          c.set('aiModelName', keyRecord.aiModelName)
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

    if (!membership) {
      // Retorna 404 para não revelar se o projeto existe para outro tenant
      return c.json({ error: 'Projeto não encontrado' }, 404)
    }

    const roleHierarchy: Record<MemberRole, number> = { ADMIN: 3, MEMBER: 2, VIEWER: 1 }
    if (roleHierarchy[membership.role] < roleHierarchy[minRole]) {
      return c.json({ error: 'Permissão insuficiente' }, 403)
    }

    c.set('memberRole', membership.role)
    await next()
  }
}

async function hashApiKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Buffer.from(buf).toString('hex')
}
