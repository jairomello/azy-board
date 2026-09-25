import { Hono } from 'hono'
import type { Context } from 'hono'
import type { HonoEnv } from '../types/hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import type { RequestContext } from '@azy-board/api-contracts'
import { validateSprintDates, validateSprintTransition } from '../services/sprints'
import { parseJson, sprintSchema } from '../validation'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'

export const sprintsRouter = new Hono<HonoEnv>()
sprintsRouter.use('*', authMiddleware)

sprintsRouter.get('/current', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const sprint = (await persistence.planning.listSprints(userPersistenceContext(ctx), projectId)).find(candidate => candidate.status === 'OPEN')
  if (!sprint) return c.json({ status: 'NONE' })
  return c.json({ id: sprint.id, name: sprint.name, startDate: sprint.startDate, endDate: sprint.endDate, status: sprint.status })
})

sprintsRouter.post('/', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, sprintSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const error = validateSprintDates(body.name, body.startDate, body.endDate)
  if (error) return c.json({ error }, 422)
  const sprint = await persistence.planning.createSprint(userPersistenceContext(ctx), projectId, {
    name: body.name!.trim(), status: 'PROPOSED', startDate: body.startDate!, endDate: body.endDate!,
  })
  return c.json(sprint, 201)
})

sprintsRouter.patch('/:sprintId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, sprintId } = c.req.param()
  const current = await persistence.planning.getSprint(userPersistenceContext(ctx), projectId, sprintId)
  if (!current) return c.json({ error: 'Sprint não encontrada' }, 404)
  const parsed = await parseJson(c, sprintSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const error = validateSprintDates(body.name ?? current.name, body.startDate ?? current.startDate, body.endDate ?? current.endDate)
  if (error) return c.json({ error }, 422)
  const updated = await persistence.planning.updateSprint(userPersistenceContext(ctx), projectId, sprintId, {
    name: (body.name ?? current.name).trim(), startDate: body.startDate ?? current.startDate, endDate: body.endDate ?? current.endDate,
  })
  return updated ? c.json(updated) : c.json({ error: 'Sprint não encontrada' }, 404)
})

sprintsRouter.patch('/:sprintId/activate', requireRole('ADMIN'), async (c) => transition(c, 'open'))
sprintsRouter.patch('/:sprintId/open', requireRole('ADMIN'), async (c) => transition(c, 'open'))
sprintsRouter.patch('/:sprintId/close', requireRole('ADMIN'), async (c) => transition(c, 'close'))

async function transition(c: Context<HonoEnv>, action: 'open' | 'close') {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, sprintId } = c.req.param()
  const projectContext = userPersistenceContext(ctx)
  const requested = await persistence.planning.getSprint(projectContext, projectId, sprintId)
  if (!requested) return c.json({ error: 'Sprint não encontrada' }, 404)
  const error = validateSprintTransition(requested.status, action)
  if (error) return c.json({ error }, 409)
  const updated = await persistence.planning.transitionSprint(projectContext, projectId, sprintId, action === 'open' ? 'OPEN' : 'CLOSED')
  return c.json({ sprint: updated })
}

sprintsRouter.get('/', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  return c.json(await persistence.planning.listSprints(userPersistenceContext(ctx), c.req.param('projectId')!))
})
