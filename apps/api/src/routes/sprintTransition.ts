import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoEnv } from '../types/hono'
import type { RequestContext } from '@azy-board/api-contracts'
import { authMiddleware, requireRole } from '../middleware/auth'
import { parseJson } from '../validation'
import { persistence } from '../persistence/runtime'
import { userMutationContext, userPersistenceContext } from '../persistence/context'
import { IDEMPOTENCY_RETENTION_MS, payloadHash } from '../services/idempotency'
import { COMMAND_NAMESPACES, isIdempotencyConflict, isIdempotentReplay, parseEnvelope } from '../persistence/idempotency'
import { findOperationId } from '../services/domainEventOutbox'
import { prepareSprintTransition } from '../services/sprintTransitionPrepare'
import { SprintTransitionError } from '../services/sprintTransition'
import type { SprintTransitionPlan } from '../persistence/models'

export const sprintTransitionRouter = new Hono<HonoEnv>()
sprintTransitionRouter.use('*', authMiddleware)

const prepareSchema = z.object({
  sourceSprintId: z.string().min(1).nullable().optional(),
  destinationSprintId: z.string().min(1).nullable().optional(),
  destinationName: z.string().min(1).max(200).nullable().optional(),
  next: z.boolean().optional(),
}).strict()

const candidateSchema = z.object({
  itemId: z.string().min(1),
  revision: z.string().min(1),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED', 'ARCHIVED']),
  points: z.number().finite().nullable(),
  sprintIds: z.array(z.string()),
})
const planSchema = z.object({
  planVersion: z.literal(1),
  projectId: z.string().min(1),
  sourceSprintId: z.string().min(1),
  sourceSprintName: z.string().max(200),
  sourceCycleId: z.string().min(1),
  sourceRevision: z.string().min(1),
  destinationSprintId: z.string().min(1),
  destinationSprintName: z.string().max(200),
  destinationStatus: z.enum(['PROPOSED', 'OPEN', 'CLOSED']),
  candidates: z.array(candidateSchema).max(500),
  excluded: z.object({ done: z.number().int().min(0), cancelled: z.number().int().min(0), archived: z.number().int().min(0), aggregators: z.number().int().min(0) }),
  knownPoints: z.number(),
  unknownPointsCount: z.number().int().min(0),
  totalCandidates: z.number().int().min(0),
  fingerprint: z.string().min(1),
}).strict()

const applySchema = z.object({ plan: planSchema, idempotencyKey: z.string().min(1).max(200).optional() }).strict()

function errorStatus(code: string): 404 | 409 | 422 {
  if (code === 'PROJECT_NOT_FOUND' || code === 'SOURCE_NOT_FOUND' || code === 'DESTINATION_NOT_FOUND') return 404
  if (['SOURCE_CYCLE_CHANGED', 'TRANSITION_SOURCE_CHANGED', 'DESTINATION_CLOSED', 'SOURCE_NOT_OPEN', 'NEXT_SPRINT_AMBIGUOUS', 'DESTINATION_AMBIGUOUS', 'SOURCE_AMBIGUOUS', 'DESTINATION_EQUALS_SOURCE'].includes(code)) return 409
  return 422
}

// POST /projects/:projectId/sprint-transition/prepare — plano ADMIN somente-leitura.
sprintTransitionRouter.post('/prepare', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, prepareSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  try {
    const plan = await prepareSprintTransition({
      context: userPersistenceContext(ctx),
      projectId,
      sourceSprintId: body.sourceSprintId ?? null,
      destinationSprintId: body.destinationSprintId ?? null,
      destinationName: body.destinationName ?? null,
      next: body.next,
    })
    return c.json(plan)
  } catch (error) {
    if (error instanceof SprintTransitionError) return c.json({ code: error.code, error: error.code, retryable: false }, errorStatus(error.code))
    throw error
  }
})

// POST /projects/:projectId/sprint-transition/apply — aplica plano aprovado.
sprintTransitionRouter.post('/apply', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, applySchema)
  if (!parsed.ok) return parsed.response
  const plan = parsed.data.plan as unknown as SprintTransitionPlan
  if (plan.projectId !== projectId) return c.json({ code: 'PROJECT_CONTEXT_MISMATCH', error: 'O plano pertence a outro projeto.' }, 422)

  const key = c.req.header('Idempotency-Key') ?? parsed.data.idempotencyKey ?? null
  const commandHash = key ? await payloadHash({ projectId, plan }) : null
  const mutationContext = userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST')
  if (key && commandHash) {
    mutationContext.idempotency = {
      namespace: COMMAND_NAMESPACES.applySprintTransition, projectScope: projectId, key,
      payloadHash: commandHash, expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS).toISOString(),
    }
  }
  try {
    const result = await persistence.unitOfWork.applySprintTransition(mutationContext, plan)
    if (key) {
      const operationId = await findOperationId(ctx.tenantId, ctx.userId, COMMAND_NAMESPACES.applySprintTransition, key, projectId)
      if (operationId) c.header('X-Operation-Id', operationId)
    }
    return c.json(result, 200)
  } catch (error) {
    if (isIdempotencyConflict(error)) return c.json({ code: 'IDEMPOTENCY_CONFLICT', error: 'A chave já foi usada com outro payload' }, 409)
    if (isIdempotentReplay(error)) {
      const envelope = parseEnvelope(error.record.responseJson)
      if (!envelope) return c.json({ code: 'IDEMPOTENCY_RESULT_UNAVAILABLE', error: 'Resultado idempotente indisponível.' }, 409)
      return c.json(envelope.body as object, 200)
    }
    const message = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    if (errorStatus(message) !== 422) return c.json({ code: message, error: message, retryable: false }, errorStatus(message))
    throw error
  }
})
