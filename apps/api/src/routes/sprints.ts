import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index'
import { sprints } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import { generateId } from '../utils/id'
import type { RequestContext } from '@azy-board/types'

export const sprintsRouter = new Hono<HonoEnv>()
sprintsRouter.use('*', authMiddleware)

// GET /projects/:projectId/current-sprint — endpoint AI-friendly
sprintsRouter.get('/current', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!

  // [TENANT] Filtra por tenantId + projectId
  const sprint = await db.query.sprints.findFirst({
    where: (s) =>
      and(
        eq(s.tenantId, ctx.tenantId),
        eq(s.projectId, projectId),
        eq(s.status, 'ACTIVE')
      ),
  })

  if (!sprint) return c.json({ status: 'NONE' })
  return c.json(sprint)
})

// POST /projects/:projectId/sprints
sprintsRouter.post('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const body = await c.req.json<{ name: string; startDate?: string; endDate?: string }>()

  const id = generateId()
  await db.insert(sprints).values({
    id,
    tenantId: ctx.tenantId,
    projectId,
    name: body.name,
    status: 'PLANNED',
    startDate: body.startDate,
    endDate: body.endDate,
    createdAt: new Date().toISOString(),
  })

  return c.json({ id, name: body.name, status: 'PLANNED' }, 201)
})

// PATCH /projects/:projectId/sprints/:sprintId/activate
sprintsRouter.patch('/:sprintId/activate', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, sprintId } = c.req.param()

  await db.transaction(async (tx) => {
    // Desativar sprint ativa anterior do mesmo projeto
    await tx.update(sprints)
      .set({ status: 'PLANNED' })
      .where(
        and(
          eq(sprints.tenantId, ctx.tenantId),
          eq(sprints.projectId, projectId),
          eq(sprints.status, 'ACTIVE')
        )
      )

    // Ativar a sprint solicitada
    await tx.update(sprints)
      .set({ status: 'ACTIVE' })
      .where(and(eq(sprints.id, sprintId), eq(sprints.tenantId, ctx.tenantId)))
  })

  return c.json({ ok: true })
})

// PATCH /projects/:projectId/sprints/:sprintId/close
sprintsRouter.patch('/:sprintId/close', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const sprintId = c.req.param('sprintId')!

  await db.update(sprints)
    .set({ status: 'DONE' })
    .where(and(eq(sprints.id, sprintId), eq(sprints.tenantId, ctx.tenantId)))

  return c.json({ ok: true })
})

// GET /projects/:projectId/sprints
sprintsRouter.get('/', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!

  const result = await db.select().from(sprints)
    .where(and(eq(sprints.projectId, projectId), eq(sprints.tenantId, ctx.tenantId)))

  return c.json(result)
})
