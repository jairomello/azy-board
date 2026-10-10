import { Hono, type Context } from 'hono'
import type { HonoEnv } from '../types/hono'
import type { RequestContext } from '@azy-board/api-contracts'
import { authMiddleware, requireRole } from '../middleware/auth'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext, userMutationContext } from '../persistence/context'
import { createItemDependencySchema, parseJson, updateItemDependencySchema } from '../validation'
import { findOperationId } from '../services/domainEventOutbox'
import { IDEMPOTENCY_RETENTION_MS, payloadHash } from '../services/idempotency'
import { wouldCreateCycle } from '../services/itemDependencies'
import { COMMAND_NAMESPACES, isIdempotencyConflict, isIdempotentReplay, parseEnvelope } from '../persistence/idempotency'

export const itemDependenciesRouter = new Hono<HonoEnv>()
itemDependenciesRouter.use('*', authMiddleware)

async function authorizedItem(c: Context<HonoEnv>) {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  // [TENANT] Ancora cada leitura/mutação ao item do projeto no tenant autenticado.
  const item = await persistence.items.getItem(userPersistenceContext(ctx), projectId, itemId)
  return item ? { ctx, projectId, itemId, persistenceContext: userPersistenceContext(ctx) } : null
}

itemDependenciesRouter.get('/', requireRole('VIEWER'), async (c) => {
  const scope = await authorizedItem(c)
  if (!scope) return c.json({ error: 'Item não encontrado' }, 404)
  return c.json(await persistence.itemDependencies.list(scope.persistenceContext, scope.projectId, scope.itemId))
})

itemDependenciesRouter.post('/', requireRole('MEMBER'), async (c) => {
  const scope = await authorizedItem(c)
  if (!scope) return c.json({ error: 'Item não encontrado' }, 404)
  const parsed = await parseJson(c, createItemDependencySchema)
  if (!parsed.ok) return parsed.response

  // Um item não pode depender de si mesmo.
  if (parsed.data.dependsOnItemId === scope.itemId) {
    return c.json({ code: 'SELF_DEPENDENCY', error: 'Um item não pode depender de si mesmo.' }, 400)
  }
  // [TENANT] Alvo precisa existir no MESMO projeto do tenant autenticado (anti-IDOR).
  const target = await persistence.items.getItem(scope.persistenceContext, scope.projectId, parsed.data.dependsOnItemId)
  if (!target) return c.json({ code: 'INVALID_TARGET', error: 'O item dependido não pertence ao projeto.' }, 422)

  // Bloqueio de ciclo: rejeita vínculo que fecharia ciclo direto ou indireto.
  const edges = await persistence.itemDependencies.listByProject(scope.persistenceContext, scope.projectId)
  if (wouldCreateCycle(edges, scope.itemId, parsed.data.dependsOnItemId)) {
    return c.json({ code: 'DEPENDENCY_CYCLE', error: 'Essa dependência criaria um ciclo (direto ou indireto) e foi rejeitada.' }, 409)
  }

  // [T38] Chave idempotente opcional (agente envia Idempotency-Key estável).
  const idempotencyKey = c.req.header('Idempotency-Key')
  const commandHash = idempotencyKey ? await payloadHash({ projectId: scope.projectId, itemId: scope.itemId, dependency: parsed.data }) : null
  const mutationContext = userMutationContext(scope.ctx, c.get('apiKeyId') ? 'MCP' : 'REST')
  if (idempotencyKey && commandHash) {
    mutationContext.idempotency = {
      namespace: COMMAND_NAMESPACES.createItemDependency,
      projectScope: scope.projectId,
      key: idempotencyKey,
      payloadHash: commandHash,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS).toISOString(),
    }
  }
  try {
    const created = await persistence.itemDependencies.create(mutationContext, scope.projectId, scope.itemId, parsed.data)
    if (idempotencyKey) {
      const operationId = await findOperationId(scope.ctx.tenantId, scope.ctx.userId, COMMAND_NAMESPACES.createItemDependency, idempotencyKey, scope.projectId)
      if (operationId) c.header('X-Operation-Id', operationId)
    }
    return c.json(created, 201)
  } catch (error) {
    if (isIdempotencyConflict(error)) return c.json({ code: 'IDEMPOTENCY_CONFLICT', error: 'A chave já foi usada com outro payload' }, 409)
    if (isIdempotentReplay(error)) {
      const envelope = parseEnvelope(error.record.responseJson)
      if (!envelope?.body) return c.json({ error: 'Resultado idempotente indisponível.' }, 409)
      const replayOperationId = await findOperationId(scope.ctx.tenantId, scope.ctx.userId, COMMAND_NAMESPACES.createItemDependency, idempotencyKey!, scope.projectId)
      if (replayOperationId) c.header('X-Operation-Id', replayOperationId)
      return c.json(envelope.body, 201)
    }
    throw error
  }
})

itemDependenciesRouter.patch('/:dependencyId', requireRole('MEMBER'), async (c) => {
  const scope = await authorizedItem(c)
  if (!scope) return c.json({ error: 'Item não encontrado' }, 404)
  const parsed = await parseJson(c, updateItemDependencySchema)
  if (!parsed.ok) return parsed.response

  const dependencyId = c.req.param('dependencyId')!
  const existing = await persistence.itemDependencies.get(scope.persistenceContext, scope.projectId, scope.itemId, dependencyId)
  if (!existing) return c.json({ error: 'Dependência não encontrada' }, 404)

  // Troca do alvo: valida auto-dependência, existência no projeto, unicidade do
  // par e bloqueio de ciclo (excluindo o vínculo em edição).
  if (parsed.data.dependsOnItemId !== undefined && parsed.data.dependsOnItemId !== existing.dependsOnItemId) {
    if (parsed.data.dependsOnItemId === scope.itemId) {
      return c.json({ code: 'SELF_DEPENDENCY', error: 'Um item não pode depender de si mesmo.' }, 400)
    }
    const target = await persistence.items.getItem(scope.persistenceContext, scope.projectId, parsed.data.dependsOnItemId)
    if (!target) return c.json({ code: 'INVALID_TARGET', error: 'O item dependido não pertence ao projeto.' }, 422)
    const edges = await persistence.itemDependencies.listByProject(scope.persistenceContext, scope.projectId)
    if (edges.some(edge => edge.id !== existing.id && edge.itemId === scope.itemId && edge.dependsOnItemId === parsed.data.dependsOnItemId)) {
      return c.json({ code: 'DUPLICATE_DEPENDENCY', error: 'Este item já depende do item informado.' }, 409)
    }
    if (wouldCreateCycle(edges.filter(edge => edge.id !== existing.id), scope.itemId, parsed.data.dependsOnItemId)) {
      return c.json({ code: 'DEPENDENCY_CYCLE', error: 'Essa dependência criaria um ciclo (direto ou indireto) e foi rejeitada.' }, 409)
    }
  }

  const updated = await persistence.itemDependencies.update(scope.persistenceContext, scope.projectId, scope.itemId, dependencyId, parsed.data)
  if (!updated) return c.json({ error: 'Dependência não encontrada' }, 404)
  return c.json(updated)
})

itemDependenciesRouter.delete('/:dependencyId', requireRole('MEMBER'), async (c) => {
  const scope = await authorizedItem(c)
  if (!scope) return c.json({ error: 'Item não encontrado' }, 404)
  const deleted = await persistence.itemDependencies.delete(scope.persistenceContext, scope.projectId, scope.itemId, c.req.param('dependencyId')!)
  if (!deleted) return c.json({ error: 'Dependência não encontrada' }, 404)
  return c.json({ ok: true })
})