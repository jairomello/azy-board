import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import type { RequestContext } from '@azy-board/api-contracts'
import { authMiddleware, requireRole } from '../middleware/auth'
import { normalizePlanningGapArguments, validateToolArguments } from '@azy-board/tool-registry'
import { parseJson, planningGapQuerySchema } from '../validation'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'
import { planningGapPage } from '../services/planningGaps'
import type { PlanningGapQueryNode, PlanningGapSnapshotRecord } from '../persistence/models'

export const planningGapsRouter = new Hono<HonoEnv>()
planningGapsRouter.use('*', authMiddleware)

function present(snapshot: PlanningGapSnapshotRecord, limit: number) {
  const { items, nextCursor } = planningGapPage(snapshot, null, limit)
  return {
    resultId: snapshot.resultId,
    capturedAt: snapshot.capturedAt,
    expiresAt: snapshot.expiresAt,
    totalDistinct: snapshot.totalDistinct,
    groups: snapshot.groups,
    exclusiveCombinations: snapshot.exclusiveCombinations,
    scope: JSON.parse(snapshot.scopeJson),
    expression: JSON.parse(snapshot.expressionJson),
    referenceDate: snapshot.referenceDate,
    timeZone: snapshot.timeZone,
    items,
    nextCursor,
  }
}

// POST /projects/:projectId/planning-gaps/query — captura fixada e primeira página.
planningGapsRouter.post('/query', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, planningGapQuerySchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  let normalized: Record<string, unknown>
  try {
    // [TENANT] A captura é escopada por tenant/projeto/ator dentro do adapter.
    normalized = normalizePlanningGapArguments({ ...body, projectId }, ctx.userId)
    validateToolArguments('query_planning_gaps', normalized)
  } catch (error) {
    return c.json({ error: (error as Error).message, code: 'INVALID_PLANNING_GAP_QUERY', retryable: false }, 422)
  }

  const snapshot = await persistence.planningGapSnapshots.capture(userPersistenceContext(ctx), {
    projectId,
    scope: body.scope ?? null,
    where: normalized.where as PlanningGapQueryNode,
    limit: body.limit ?? 50,
    referenceDate: body.referenceDate ?? null,
    timeZone: body.timeZone ?? null,
  })
  return c.json(present(snapshot, Math.min(100, Math.max(1, body.limit ?? 50))))
})

// GET /projects/:projectId/planning-gaps/:resultId — paginação vinculada ao resultado.
planningGapsRouter.get('/:resultId', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const resultId = c.req.param('resultId')!
  const cursor = c.req.query('cursor') ?? null
  const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query('limit') ?? '50', 10) || 50))
  try {
    const page = await persistence.planningGapSnapshots.page(userPersistenceContext(ctx), projectId, resultId, cursor, limit)
    if (!page) return c.json({ error: 'Resultado não encontrado', code: 'PLANNING_GAP_RESULT_NOT_FOUND', retryable: false }, 404)
    return c.json(page)
  } catch (error) {
    const message = (error as Error).message
    const status = message === 'PLANNING_GAP_RESULT_EXPIRED' ? 410 : 422
    return c.json({ error: message, code: message, retryable: false }, status)
  }
})
