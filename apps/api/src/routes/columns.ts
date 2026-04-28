import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { eq, and, asc, gt } from 'drizzle-orm'
import { db } from '../db/index'
import { columns, items } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import { generateId } from '../utils/id'
import { broadcast } from '../services/websocket'
import type { RequestContext, TaskStatus } from '@azy-board/types'

export const columnsRouter = new Hono<HonoEnv>()
columnsRouter.use('*', authMiddleware)

// GET /projects/:projectId/columns
columnsRouter.get('/', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!

  // [TENANT] Duplo filtro: tenantId + projectId
  const result = await db.select().from(columns)
    .where(and(eq(columns.projectId, projectId), eq(columns.tenantId, ctx.tenantId)))
    .orderBy(asc(columns.position))

  return c.json(result)
})

// POST /projects/:projectId/columns
columnsRouter.post('/', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const body = await c.req.json<{ name: string; baseStatus: TaskStatus }>()

  const existing = await db.select().from(columns)
    .where(and(eq(columns.projectId, projectId), eq(columns.tenantId, ctx.tenantId)))
  const position = existing.length

  const id = generateId()
  await db.insert(columns).values({
    id,
    tenantId: ctx.tenantId,
    projectId,
    name: body.name,
    baseStatus: body.baseStatus,
    position,
  })

  return c.json({ id, name: body.name, baseStatus: body.baseStatus }, 201)
})

// PATCH /projects/:projectId/columns/:colId
columnsRouter.patch('/:colId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const colId = c.req.param('colId')!
  const body = await c.req.json<{ name?: string; baseStatus?: TaskStatus }>()

  await db.update(columns)
    .set({ ...(body.name && { name: body.name }), ...(body.baseStatus && { baseStatus: body.baseStatus }) })
    .where(and(eq(columns.id, colId), eq(columns.tenantId, ctx.tenantId)))

  return c.json({ ok: true })
})

// PATCH /projects/:projectId/columns/reorder
columnsRouter.patch('/reorder', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const body = await c.req.json<{ order: string[] }>()

  await db.transaction(async (tx) => {
    for (let i = 0; i < body.order.length; i++) {
      const colId = body.order[i]!
      await tx.update(columns)
        .set({ position: i })
        // [TENANT] Garante que só colunas do tenant correto são reordenadas
        .where(and(eq(columns.id, colId), eq(columns.tenantId, ctx.tenantId), eq(columns.projectId, projectId)))
    }
  })

  return c.json({ ok: true })
})

// DELETE /projects/:projectId/columns/:colId
columnsRouter.delete('/:colId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const colId = c.req.param('colId')!
  const projectId = c.req.param('projectId')!
  const body = await c.req.json<{ moveToColumnId: string }>()

  await db.transaction(async (tx) => {
    // Mover cards para a coluna destino antes de excluir
    await tx.update(items)
      .set({ columnId: body.moveToColumnId })
      .where(and(eq(items.columnId, colId), eq(items.tenantId, ctx.tenantId)))

    await tx.delete(columns)
      .where(and(eq(columns.id, colId), eq(columns.tenantId, ctx.tenantId)))
  })

  return c.json({ ok: true })
})
