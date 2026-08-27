import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../db/index'
import { apiKeys, projects } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import { generateApiKey } from '../services/auth'
import { generateId } from '../utils/id'
import type { RequestContext } from '@azy-board/types'
import { API_KEY_PERMISSIONS } from '../services/authorization'

export const apiKeysRouter = new Hono<HonoEnv>()
apiKeysRouter.use('*', authMiddleware)


// POST /projects/:projectId/api-keys — gerar nova API Key (rota legada, mantida por compatibilidade)
apiKeysRouter.post('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const body = await c.req.json<{ name: string; aiModelName?: string; permissionScope?: string[]; expiresAt?: string | null }>()

  const { key } = generateApiKey()
  const keyHash = await hashKey(key)
  const id = generateId()

  await db.insert(apiKeys).values({
    id,
    // [TENANT] API Key sempre vinculada ao tenant do criador
    tenantId: ctx.tenantId,
    ownerId: ctx.userId,
    name: body.name,
    keyHash,
    aiModelName: body.aiModelName,
    projectScope: JSON.stringify([c.req.param('projectId')]),
    permissionScope: body.permissionScope ? JSON.stringify(body.permissionScope) : null,
    expiresAt: body.expiresAt ?? null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
  })

  // Retorna o valor completo apenas nesta resposta — não é possível recuperá-lo depois
  return c.json({ id, key, name: body.name }, 201)
})

// GET /projects/:projectId/api-keys — listar chaves (rota legada, mantida por compatibilidade)
apiKeysRouter.get('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext

  // [TENANT] Filtra por tenantId + ownerId — agente só vê suas próprias chaves
  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      aiModelName: apiKeys.aiModelName,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.tenantId, ctx.tenantId), eq(apiKeys.ownerId, ctx.userId)))

  return c.json(keys)
})

// --- Router de nível de usuário (sem vínculo de projeto) ---

export const userApiKeysRouter = new Hono<HonoEnv>()
userApiKeysRouter.use('*', authMiddleware)

// GET /api-keys — listar chaves do usuário autenticado
userApiKeysRouter.get('/', async (c) => {
  const ctx = c.get('ctx') as RequestContext

  // [TENANT] Filtra por tenantId + ownerId — isolamento cross-tenant obrigatório
  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      aiModelName: apiKeys.aiModelName,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.tenantId, ctx.tenantId), eq(apiKeys.ownerId, ctx.userId)))

  return c.json(keys)
})

// POST /api-keys — gerar nova chave
userApiKeysRouter.post('/', async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const body = await c.req.json<{ name: string; aiModelName?: string; projectScope?: string[]; permissionScope?: string[]; expiresAt?: string | null }>()

  if (!body.name?.trim()) return c.json({ error: 'Nome obrigatório' }, 400)
  if (body.permissionScope && (!Array.isArray(body.permissionScope) || body.permissionScope.some(scope => !API_KEY_PERMISSIONS.includes(scope as typeof API_KEY_PERMISSIONS[number])))) {
    return c.json({ error: 'Escopo de permissão inválido' }, 400)
  }

  const { key } = generateApiKey()
  const keyHash = await hashKey(key)
  const id = generateId()

  const projectScope = body.projectScope ? [...new Set(body.projectScope)] : []
  if (projectScope.length > 0) {
    // O escopo é validado contra projetos do tenant; a autorização final
    // continua sendo a interseção com grupo/membership em cada chamada.
    const scopedProjects = await db.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.tenantId, ctx.tenantId), inArray(projects.id, projectScope)))
    if (scopedProjects.length !== projectScope.length) return c.json({ error: 'Escopo contém projeto inválido' }, 400)
  }

  await db.insert(apiKeys).values({
    id,
    // [TENANT] API Key sempre vinculada ao tenant do criador
    tenantId: ctx.tenantId,
    ownerId: ctx.userId,
    name: body.name.trim(),
    keyHash,
    aiModelName: body.aiModelName ?? null,
    projectScope: projectScope.length > 0 ? JSON.stringify(projectScope) : null,
    permissionScope: body.permissionScope ? JSON.stringify(body.permissionScope) : null,
    expiresAt: body.expiresAt ?? null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
  })

  // Retorna o valor completo apenas nesta resposta — não é possível recuperá-lo depois
  return c.json({ id, key, name: body.name }, 201)
})

// DELETE /api-keys/:id — revogar chave (anti-IDOR: verifica tenantId + ownerId + id)
userApiKeysRouter.delete('/:id', async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const id = c.req.param('id')

  // [TENANT] Inclui tenantId + ownerId no filtro — retorna 404 se não for do usuário
  const existing = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(
      eq(apiKeys.id, id),
      eq(apiKeys.tenantId, ctx.tenantId),
      eq(apiKeys.ownerId, ctx.userId),
    ))
    .limit(1)

  if (existing.length === 0) return c.json({ error: 'Não encontrado' }, 404)

  await db.update(apiKeys)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, ctx.tenantId), eq(apiKeys.ownerId, ctx.userId)))

  return c.body(null, 204)
})

async function hashKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Buffer.from(buf).toString('hex')
}
