import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index'
import { apiKeys } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import { generateApiKey } from '../services/auth'
import { generateId } from '../utils/id'
import type { RequestContext } from '@azy-board/types'

export const apiKeysRouter = new Hono<HonoEnv>()
apiKeysRouter.use('*', authMiddleware)

// POST /projects/:projectId/api-keys — gerar nova API Key (rota legada, mantida por compatibilidade)
apiKeysRouter.post('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const body = await c.req.json<{ name: string; aiModelName?: string }>()

  const { key } = generateApiKey()
  const keyHash = await hashKey(key)

  await db.insert(apiKeys).values({
    id: generateId(),
    // [TENANT] API Key sempre vinculada ao tenant do criador
    tenantId: ctx.tenantId,
    ownerId: ctx.userId,
    name: body.name,
    keyHash,
    aiModelName: body.aiModelName,
    createdAt: new Date().toISOString(),
  })

  // Retorna o valor completo apenas nesta resposta — não é possível recuperá-lo depois
  return c.json({ key, name: body.name }, 201)
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
  const body = await c.req.json<{ name: string; aiModelName?: string }>()

  if (!body.name?.trim()) return c.json({ error: 'Nome obrigatório' }, 400)

  const { key } = generateApiKey()
  const keyHash = await hashKey(key)

  await db.insert(apiKeys).values({
    id: generateId(),
    // [TENANT] API Key sempre vinculada ao tenant do criador
    tenantId: ctx.tenantId,
    ownerId: ctx.userId,
    name: body.name.trim(),
    keyHash,
    aiModelName: body.aiModelName ?? null,
    createdAt: new Date().toISOString(),
  })

  // Retorna o valor completo apenas nesta resposta — não é possível recuperá-lo depois
  return c.json({ key, name: body.name }, 201)
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

  await db.delete(apiKeys).where(eq(apiKeys.id, id))

  return c.body(null, 204)
})

async function hashKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Buffer.from(buf).toString('hex')
}
