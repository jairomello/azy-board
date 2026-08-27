import { Hono } from 'hono'
import type { Context } from 'hono'
import type { HonoEnv } from '../types/hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index'
import { sprints } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import { generateId } from '../utils/id'
import type { RequestContext } from '@azy-board/types'
import { validateSprintDates, validateSprintTransition } from '../services/sprints'

export const sprintsRouter = new Hono<HonoEnv>()
sprintsRouter.use('*', authMiddleware)

function scope(ctx: RequestContext, projectId: string, sprintId?: string) {
  return sprintId
    ? and(eq(sprints.id, sprintId), eq(sprints.projectId, projectId), eq(sprints.tenantId, ctx.tenantId))
    : and(eq(sprints.projectId, projectId), eq(sprints.tenantId, ctx.tenantId))
}

sprintsRouter.get('/current', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const sprint = await db.query.sprints.findFirst({ where: (s) => and(scope(ctx, projectId), eq(s.status, 'OPEN')) })
  if (!sprint) return c.json({ status: 'NONE' })
  return c.json({ id: sprint.id, name: sprint.name, startDate: sprint.startDate, endDate: sprint.endDate, status: sprint.status })
})

sprintsRouter.post('/', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const body = await c.req.json<{ name?: string; startDate?: string; endDate?: string }>()
  const error = validateSprintDates(body.name, body.startDate, body.endDate)
  if (error) return c.json({ error }, 422)
  const id = generateId()
  await db.insert(sprints).values({ id, tenantId: ctx.tenantId, projectId, name: body.name!.trim(), status: 'PROPOSED', startDate: body.startDate!, endDate: body.endDate!, createdAt: new Date().toISOString() })
  return c.json({ id, name: body.name!.trim(), startDate: body.startDate, endDate: body.endDate, status: 'PROPOSED' }, 201)
})

sprintsRouter.patch('/:sprintId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, sprintId } = c.req.param()
  const current = await db.query.sprints.findFirst({ where: (s) => scope(ctx, projectId, sprintId) })
  if (!current) return c.json({ error: 'Sprint não encontrada' }, 404)
  const body = await c.req.json<{ name?: string; startDate?: string; endDate?: string }>()
  const error = validateSprintDates(body.name ?? current.name, body.startDate ?? current.startDate, body.endDate ?? current.endDate)
  if (error) return c.json({ error }, 422)
  await db.update(sprints).set({ name: (body.name ?? current.name).trim(), startDate: body.startDate ?? current.startDate, endDate: body.endDate ?? current.endDate }).where(scope(ctx, projectId, sprintId))
  return c.json({ ...current, name: (body.name ?? current.name).trim(), startDate: body.startDate ?? current.startDate, endDate: body.endDate ?? current.endDate })
})

sprintsRouter.patch('/:sprintId/activate', requireRole('ADMIN'), async (c) => transition(c, 'open'))
sprintsRouter.patch('/:sprintId/open', requireRole('ADMIN'), async (c) => transition(c, 'open'))
sprintsRouter.patch('/:sprintId/close', requireRole('ADMIN'), async (c) => transition(c, 'close'))

async function transition(c: Context<HonoEnv>, action: 'open' | 'close') {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, sprintId } = c.req.param()
  const requested = await db.query.sprints.findFirst({ where: (s) => scope(ctx, projectId, sprintId) })
  if (!requested) return c.json({ error: 'Sprint não encontrada' }, 404)
  const error = validateSprintTransition(requested.status, action)
  if (error) return c.json({ error }, 409)
  await db.transaction(async (tx) => {
    if (action === 'open') await tx.update(sprints).set({ status: 'PROPOSED' }).where(and(scope(ctx, projectId), eq(sprints.status, 'OPEN')))
    await tx.update(sprints).set({ status: action === 'open' ? 'OPEN' : 'CLOSED' }).where(scope(ctx, projectId, sprintId))
  })
  const updated = await db.query.sprints.findFirst({ where: (s) => scope(ctx, projectId, sprintId) })
  return c.json({ sprint: updated })
}

sprintsRouter.get('/', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  return c.json(await db.select().from(sprints).where(scope(ctx, c.req.param('projectId')!)))
})
