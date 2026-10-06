import { Hono, type Context } from 'hono'
import type { HonoEnv } from '../types/hono'
import type { RequestContext } from '@azy-board/api-contracts'
import { authMiddleware, requireRole } from '../middleware/auth'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext, userMutationContext } from '../persistence/context'
import { createItemLinkSchema, parseJson, updateItemLinkSchema } from '../validation'
import { findOperationId } from '../services/domainEventOutbox'
import { IDEMPOTENCY_RETENTION_MS, payloadHash } from '../services/idempotency'
import { COMMAND_NAMESPACES, isIdempotencyConflict, isIdempotentReplay, parseEnvelope } from '../persistence/idempotency'

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
  // [T38] Chave idempotente opcional (agente envia Idempotency-Key estável).
  const idempotencyKey = c.req.header('Idempotency-Key')
  const commandHash = idempotencyKey ? await payloadHash({ projectId: scope.projectId, itemId: scope.itemId, link: parsed.data }) : null
  const mutationContext = userMutationContext(scope.ctx, c.get('apiKeyId') ? 'MCP' : 'REST')
  if (idempotencyKey && commandHash) {
    mutationContext.idempotency = {
      namespace: COMMAND_NAMESPACES.createItemLink,
      projectScope: scope.projectId,
      key: idempotencyKey,
      payloadHash: commandHash,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS).toISOString(),
    }
  }
  try {
    const created = await persistence.itemLinks.create(mutationContext, scope.projectId, scope.itemId, parsed.data)
    if (idempotencyKey) {
      const operationId = await findOperationId(scope.ctx.tenantId, scope.ctx.userId, COMMAND_NAMESPACES.createItemLink, idempotencyKey, scope.projectId)
      if (operationId) c.header('X-Operation-Id', operationId)
    }
    return c.json(created, 201)
  } catch (error) {
    if (isIdempotencyConflict(error)) return c.json({ code: 'IDEMPOTENCY_CONFLICT', error: 'A chave já foi usada com outro payload' }, 409)
    if (isIdempotentReplay(error)) {
      const envelope = parseEnvelope(error.record.responseJson)
      if (!envelope?.body) return c.json({ error: 'Resultado idempotente indisponível.' }, 409)
      const replayOperationId = await findOperationId(scope.ctx.tenantId, scope.ctx.userId, COMMAND_NAMESPACES.createItemLink, idempotencyKey!, scope.projectId)
      if (replayOperationId) c.header('X-Operation-Id', replayOperationId)
      return c.json(envelope.body, 201)
    }
    throw error
  }
})

itemLinksRouter.patch('/:linkId', requireRole('MEMBER'), async (c) => {
  const scope = await authorizedItem(c)
  if (!scope) return c.json({ error: 'Item não encontrado' }, 404)
  const parsed = await parseJson(c, updateItemLinkSchema)
  if (!parsed.ok) return parsed.response
  const updated = await persistence.itemLinks.update(scope.persistenceContext, scope.projectId, scope.itemId, c.req.param('linkId')!, parsed.data)
  if (!updated) return c.json({ error: 'Link não encontrado' }, 404)
  return c.json(updated)
})

itemLinksRouter.delete('/:linkId', requireRole('MEMBER'), async (c) => {
  const scope = await authorizedItem(c)
  if (!scope) return c.json({ error: 'Item não encontrado' }, 404)
  const deleted = await persistence.itemLinks.delete(scope.persistenceContext, scope.projectId, scope.itemId, c.req.param('linkId')!)
  if (!deleted) return c.json({ error: 'Link não encontrado' }, 404)
  return c.json({ ok: true })
})
