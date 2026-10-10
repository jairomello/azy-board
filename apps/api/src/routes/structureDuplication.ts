import { Hono } from 'hono'
import { z } from 'zod'
import { isIconColor, isIconName } from '@azy-board/ui-contracts'
import type { HonoEnv } from '../types/hono'
import type { RequestContext } from '@azy-board/api-contracts'
import { authMiddleware, requireRole } from '../middleware/auth'
import { parseJson } from '../validation'
import { persistence } from '../persistence/runtime'
import { userMutationContext, userPersistenceContext } from '../persistence/context'
import { IDEMPOTENCY_RETENTION_MS, payloadHash } from '../services/idempotency'
import { COMMAND_NAMESPACES, isIdempotencyConflict, isIdempotentReplay, parseEnvelope } from '../persistence/idempotency'
import { findOperationId } from '../services/domainEventOutbox'
import { prepareStructureDuplication } from '../services/structureDuplicationPrepare'
import { StructureDuplicationError } from '../services/structureDuplication'
import type { StructureDuplicationPlan } from '../persistence/models'

export const structureDuplicationRouter = new Hono<HonoEnv>()
structureDuplicationRouter.use('*', authMiddleware)

const policySchema = z.union([
  z.literal('CLEAR'), z.literal('COPY'),
  z.object({ mode: z.enum(['CLEAR', 'COPY']) }).strict(),
  z.object({ mode: z.literal('SET'), userId: z.string().min(1) }).strict(),
  z.object({ mode: z.literal('SET'), sprintIds: z.array(z.string().min(1)).max(100) }).strict(),
  z.object({ mode: z.literal('SET'), versionId: z.string().min(1).nullable() }).strict(),
])
const policiesSchema = z.object({
  points: z.enum(['CLEAR', 'COPY']).optional(),
  assignee: policySchema.optional(),
  sprint: policySchema.optional(),
  version: policySchema.optional(),
  links: z.enum(['EXCLUDE', 'COPY']).optional(),
  attachments: z.enum(['EXCLUDE']).optional(),
}).strict()

const prepareSchema = z.object({
  sourceRootId: z.string().min(1),
  destinationParentId: z.string().min(1).nullable().optional(),
  rootTitle: z.string().trim().min(1).max(500).nullable().optional(),
  policies: policiesSchema.optional(),
}).strict()

const planSchema = z.object({
  planVersion: z.literal(1),
  projectId: z.string().min(1),
  sourceRootId: z.string().min(1),
  sourceRootType: z.enum(['EPIC', 'STORY', 'TASK', 'BUG']),
  destinationParentId: z.string().min(1).nullable(),
  destinationMode: z.enum(['SIMPLE', 'HIERARCHICAL']),
  hierarchy: z.enum(['STORY', 'SUBTREE']),
  policies: policiesSchema,
  fingerprint: z.string().min(1),
  items: z.array(z.object({
    sourceId: z.string().min(1),
    parentSourceId: z.string().min(1).nullable(),
    type: z.enum(['EPIC', 'STORY', 'TASK', 'BUG']),
    title: z.string().max(500),
    description: z.string().max(20_000).nullable(),
    persona: z.string().nullable(),
    goal: z.string().nullable(),
    benefit: z.string().nullable(),
    acceptanceCriteria: z.string().nullable(),
    notes: z.string().nullable(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    points: z.number().finite().nullable(),
    icon: z.string().refine(isIconName, 'Ícone não pertence ao catálogo').nullable(),
    color: z.string().refine(isIconColor, 'Cor não pertence à paleta de ícones').nullable(),
    costCenterId: z.string().nullable(),
    tagIds: z.array(z.string()),
    sprintIds: z.array(z.string()),
    versionId: z.string().nullable(),
    assigneeId: z.string().nullable(),
    assigneeApiKeyId: z.string().nullable(),
    checklists: z.array(z.object({
      name: z.string().max(200),
      steps: z.array(z.object({ text: z.string().max(2_000), description: z.string().max(20_000).nullable(), assigneeId: z.string().nullable() })),
    })),
    links: z.array(z.object({ name: z.string().max(200), url: z.string().max(2_048), description: z.string().max(20_000).nullable() })),
  })).min(1).max(50),
  totalSteps: z.number().int().min(0).max(1_000),
  excluded: z.object({ attachments: z.number().int().min(0), hours: z.number().int().min(0), history: z.literal(true) }),
}).strict()

const applySchema = z.object({ plan: planSchema, idempotencyKey: z.string().min(1).max(200).optional() }).strict()

function errorStatus(code: string): 404 | 409 | 422 {
  if (code === 'PROJECT_NOT_FOUND' || code === 'SOURCE_NOT_FOUND') return 404
  if (code === 'DUPLICATION_SOURCE_CHANGED') return 409
  return 422
}

// POST /projects/:projectId/structure-duplication/prepare — plano somente-leitura.
structureDuplicationRouter.post('/prepare', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, prepareSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  try {
    const plan = await prepareStructureDuplication({
      context: userPersistenceContext(ctx),
      projectId,
      sourceRootId: body.sourceRootId,
      destinationParentId: body.destinationParentId ?? null,
      rootTitle: body.rootTitle ?? null,
      policies: body.policies ?? {},
    })
    return c.json(plan)
  } catch (error) {
    if (error instanceof StructureDuplicationError) return c.json({ code: error.code, error: error.code, retryable: false }, errorStatus(error.code))
    throw error
  }
})

// POST /projects/:projectId/structure-duplication/apply — cópia MEMBER aprovada.
structureDuplicationRouter.post('/apply', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, applySchema)
  if (!parsed.ok) return parsed.response
  const plan = parsed.data.plan as unknown as StructureDuplicationPlan
  if (plan.projectId !== projectId) return c.json({ code: 'PROJECT_CONTEXT_MISMATCH', error: 'O plano pertence a outro projeto.' }, 422)

  const key = c.req.header('Idempotency-Key') ?? parsed.data.idempotencyKey ?? null
  const commandHash = key ? await payloadHash({ projectId, plan }) : null
  const mutationContext = userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST')
  if (key && commandHash) {
    mutationContext.idempotency = {
      namespace: COMMAND_NAMESPACES.duplicateStructure, projectScope: projectId, key,
      payloadHash: commandHash, expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS).toISOString(),
    }
  }
  try {
    const result = await persistence.unitOfWork.duplicateStructure(mutationContext, plan)
    if (key) {
      const operationId = await findOperationId(ctx.tenantId, ctx.userId, COMMAND_NAMESPACES.duplicateStructure, key, projectId)
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
    if (error instanceof StructureDuplicationError) return c.json({ code: error.code, error: error.code, retryable: false }, errorStatus(error.code))
    const message = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    if (errorStatus(message) !== 422) return c.json({ code: message, error: message, retryable: false }, errorStatus(message))
    throw error
  }
})
