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

// POST /projects/:projectId/api-keys — gerar nova API Key
apiKeysRouter.post('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const body = await c.req.json<{ name: string; aiModelName?: string }>()

  const { key, prefix } = generateApiKey()

  // Hash SHA-256 para armazenar — o valor completo é exibido apenas uma vez
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
  return c.json({ key, prefix, name: body.name }, 201)
})

// GET /projects/:projectId/api-keys — listar chaves (sem revelar o valor completo)
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

async function hashKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Buffer.from(buf).toString('hex')
}
