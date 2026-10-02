import { Hono, type Context } from 'hono'
import type { HonoEnv } from '../types/hono'
import type { RequestContext } from '@azy-board/api-contracts'
import { authMiddleware, requireRole } from '../middleware/auth'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'
import { createItemLinkSchema, parseJson, updateItemLinkSchema } from '../validation'
import { broadcast } from '../services/websocket'

export const itemLinksRouter = new Hono<HonoEnv>()
itemLinksRouter.use('*', authMiddleware)

async function authorizedItem(c: Context<HonoEnv>) {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  // [TENANT] Ancora cada leitura/mutação ao item do projeto no tenant autenticado.
  const item = await persistence.items.getItem(userPersistenceContext(ctx), projectId, itemId)
  return item ? { ctx, projectId, itemId, persistenceContext: userPersistenceContext(ctx) } : null
}

itemLinksRouter.get('/', requireRole('VIEWER'), async (c) => {
  const scope = await authorizedItem(c)
  if (!scope) return c.json({ error: 'Item não encontrado' }, 404)
  return c.json(await persistence.itemLinks.list(scope.persistenceContext, scope.projectId, scope.itemId))
})

itemLinksRouter.post('/', requireRole('MEMBER'), async (c) => {
  const scope = await authorizedItem(c)
  if (!scope) return c.json({ error: 'Item não encontrado' }, 404)
  const parsed = await parseJson(c, createItemLinkSchema)
  if (!parsed.ok) return parsed.response
  const created = await persistence.itemLinks.create(scope.persistenceContext, scope.projectId, scope.itemId, parsed.data)
  broadcast(scope.projectId, { type: 'ITEM_UPDATED', projectId: scope.projectId, payload: { itemIds: [scope.itemId] } })
  return c.json(created, 201)
})

itemLinksRouter.patch('/:linkId', requireRole('MEMBER'), async (c) => {
  const scope = await authorizedItem(c)
  if (!scope) return c.json({ error: 'Item não encontrado' }, 404)
  const parsed = await parseJson(c, updateItemLinkSchema)
  if (!parsed.ok) return parsed.response
  const updated = await persistence.itemLinks.update(scope.persistenceContext, scope.projectId, scope.itemId, c.req.param('linkId')!, parsed.data)
  if (!updated) return c.json({ error: 'Link não encontrado' }, 404)
  broadcast(scope.projectId, { type: 'ITEM_UPDATED', projectId: scope.projectId, payload: { itemIds: [scope.itemId] } })
  return c.json(updated)
})

itemLinksRouter.delete('/:linkId', requireRole('MEMBER'), async (c) => {
  const scope = await authorizedItem(c)
  if (!scope) return c.json({ error: 'Item não encontrado' }, 404)
  const deleted = await persistence.itemLinks.delete(scope.persistenceContext, scope.projectId, scope.itemId, c.req.param('linkId')!)
  if (!deleted) return c.json({ error: 'Link não encontrado' }, 404)
  broadcast(scope.projectId, { type: 'ITEM_UPDATED', projectId: scope.projectId, payload: { itemIds: [scope.itemId] } })
  return c.json({ ok: true })
})
