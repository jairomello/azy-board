import { Hono } from 'hono'
import type { RequestContext } from '@azy-board/api-contracts'
import type { HonoEnv } from '../types/hono'
import { authMiddleware } from '../middleware/auth'
import { hasGlobalGroup } from '../services/authorization'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'
import { GLOBAL_PROJECT_SCOPE, parseEnvelope } from '../persistence/idempotency'

// [T38] Consulta escopada de operação idempotente. O `operationId` é o id do
// registro no journal; a resposta preserva status/body originais e distingue
// commit de publicação pendente, revalidando o acesso atual ao escopo.
export const operationsRouter = new Hono<HonoEnv>()
operationsRouter.use('*', authMiddleware)

operationsRouter.get('/:operationId', async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const operationId = c.req.param('operationId')!
  const record = await persistence.idempotency.findById(userPersistenceContext(ctx), operationId)
  if (!record) return c.json({ code: 'OPERATION_NOT_FOUND', error: 'Operação não encontrada.' }, 404)

  // [TENANT] Revalida o acesso atual ao projeto antes de devolver o resultado.
  if (record.projectScope && record.projectScope !== GLOBAL_PROJECT_SCOPE) {
    const scope = userPersistenceContext(ctx)
    const project = await persistence.projects.getProject(scope, record.projectScope)
    if (!project) return c.json({ code: 'RESOURCE_NOT_FOUND', error: 'Projeto não encontrado' }, 404)
    const membership = await persistence.projects.getMembership(scope, record.projectScope, ctx.userId)
    const isManager = project.managerUserId === ctx.userId
    const isGlobalAdmin = hasGlobalGroup(ctx.globalGroup, 'ADMIN')
    if (!membership && !isManager && (project.isRestricted || !isGlobalAdmin)) {
      return c.json({ code: 'RESOURCE_NOT_FOUND', error: 'Projeto não encontrado' }, 404)
    }
  }

  const envelope = parseEnvelope(record.responseJson)
  const publicationPending = await persistence.domainEvents.hasPendingForOperation(ctx.tenantId, operationId)
  return c.json({
    operationId,
    projectScope: record.projectScope || null,
    status: record.status,
    httpStatus: envelope?.status ?? null,
    body: envelope?.body ?? null,
    publication: { pending: publicationPending },
  })
})
