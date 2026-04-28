import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { eq, and, max, asc, sql } from 'drizzle-orm'
import { db } from '../db/index'
import { checklists, checklistItems, items } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import { generateId } from '../utils/id'
import { broadcast } from '../services/websocket'
import type { RequestContext } from '@azy-board/types'

// Calcula progresso agregado dos checklists de um item para enviar no broadcast
async function getChecklistProgress(tenantId: string, itemId: string) {
  const rows = await db.select({
    total: sql<number>`COUNT(${checklistItems.id})`,
    checked: sql<number>`SUM(CASE WHEN ${checklistItems.checked} = 1 THEN 1 ELSE 0 END)`,
  })
    .from(checklists)
    .leftJoin(checklistItems, eq(checklistItems.checklistId, checklists.id))
    .where(and(eq(checklists.itemId, itemId), eq(checklists.tenantId, tenantId)))
  return { checked: Number(rows[0]?.checked ?? 0), total: Number(rows[0]?.total ?? 0) }
}

export const checklistsRouter = new Hono<HonoEnv>()
checklistsRouter.use('*', authMiddleware)

// Valida que o item existe e pertence ao tenant — anti-IDOR
// [TENANT] join via items.tenantId antes de qualquer operação de checklist
async function assertItemAccess(tenantId: string, itemId: string, projectId: string): Promise<boolean> {
  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, tenantId), eq(i.projectId, projectId)),
    columns: { id: true },
  })
  return !!item
}

// GET /projects/:projectId/items/:itemId/checklists
checklistsRouter.get('/', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  // [TENANT] verifica acesso antes de retornar dados
  const allowed = await assertItemAccess(ctx.tenantId, itemId, projectId)
  if (!allowed) return c.json({ error: 'Item não encontrado' }, 404)

  const rows = await db.query.checklists.findMany({
    where: (cl) => and(eq(cl.itemId, itemId), eq(cl.tenantId, ctx.tenantId)),
    with: { checklistItems: { orderBy: (ci) => [asc(ci.position)] } },
    orderBy: (cl) => [asc(cl.position)],
  })

  return c.json(rows.map(cl => ({
    id: cl.id,
    name: cl.name,
    position: cl.position,
    items: cl.checklistItems.map(ci => ({
      id: ci.id,
      text: ci.text,
      checked: Boolean(ci.checked),
      position: ci.position,
    })),
  })))
})

// POST /projects/:projectId/items/:itemId/checklists
checklistsRouter.post('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  const body = await c.req.json<{ name: string }>()

  if (!body.name?.trim()) return c.json({ error: 'name é obrigatório' }, 400)

  // [TENANT] verifica acesso ao item
  const allowed = await assertItemAccess(ctx.tenantId, itemId, projectId)
  if (!allowed) return c.json({ error: 'Item não encontrado' }, 404)

  const maxPos = await db.select({ pos: max(checklists.position) })
    .from(checklists)
    .where(and(eq(checklists.itemId, itemId), eq(checklists.tenantId, ctx.tenantId)))
  const position = (maxPos[0]?.pos ?? -1) + 1

  const id = generateId()
  await db.insert(checklists).values({
    id,
    tenantId: ctx.tenantId, // [TENANT]
    itemId,
    name: body.name.trim(),
    position,
    createdAt: new Date().toISOString(),
  })

  const progress = await getChecklistProgress(ctx.tenantId, itemId)
  broadcast(projectId, { type: 'CHECKLIST_UPDATED', projectId, payload: { itemId, progress } })

  return c.json({ id, name: body.name.trim(), position, items: [] }, 201)
})

// PATCH /projects/:projectId/items/:itemId/checklists/:checklistId
checklistsRouter.patch('/:checklistId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, checklistId } = c.req.param()
  const body = await c.req.json<{ name?: string; position?: number }>()

  // [TENANT] verifica acesso via item
  const allowed = await assertItemAccess(ctx.tenantId, itemId, projectId)
  if (!allowed) return c.json({ error: 'Item não encontrado' }, 404)

  const cl = await db.query.checklists.findFirst({
    where: (cl) => and(eq(cl.id, checklistId), eq(cl.itemId, itemId), eq(cl.tenantId, ctx.tenantId)),
  })
  if (!cl) return c.json({ error: 'Checklist não encontrado' }, 404)

  const updates: Partial<typeof checklists.$inferInsert> = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.position !== undefined) updates.position = body.position

  await db.update(checklists).set(updates)
    .where(and(eq(checklists.id, checklistId), eq(checklists.tenantId, ctx.tenantId)))

  return c.json({ ...cl, ...updates })
})

// DELETE /projects/:projectId/items/:itemId/checklists/:checklistId
checklistsRouter.delete('/:checklistId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, checklistId } = c.req.param()

  // [TENANT] verifica acesso via item
  const allowed = await assertItemAccess(ctx.tenantId, itemId, projectId)
  if (!allowed) return c.json({ error: 'Item não encontrado' }, 404)

  await db.delete(checklists)
    .where(and(eq(checklists.id, checklistId), eq(checklists.itemId, itemId), eq(checklists.tenantId, ctx.tenantId)))

  const progress = await getChecklistProgress(ctx.tenantId, itemId)
  broadcast(projectId, { type: 'CHECKLIST_UPDATED', projectId, payload: { itemId, progress } })

  return c.body(null, 204)
})

// POST /projects/:projectId/items/:itemId/checklists/:checklistId/items
checklistsRouter.post('/:checklistId/items', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, checklistId } = c.req.param()
  const body = await c.req.json<{ text: string }>()

  if (!body.text?.trim()) return c.json({ error: 'text é obrigatório' }, 400)

  // [TENANT] verifica acesso via item
  const allowed = await assertItemAccess(ctx.tenantId, itemId, projectId)
  if (!allowed) return c.json({ error: 'Item não encontrado' }, 404)

  const cl = await db.query.checklists.findFirst({
    where: (cl) => and(eq(cl.id, checklistId), eq(cl.itemId, itemId), eq(cl.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!cl) return c.json({ error: 'Checklist não encontrado' }, 404)

  const maxPos = await db.select({ pos: max(checklistItems.position) })
    .from(checklistItems)
    .where(and(eq(checklistItems.checklistId, checklistId), eq(checklistItems.tenantId, ctx.tenantId)))
  const position = (maxPos[0]?.pos ?? -1) + 1

  const id = generateId()
  await db.insert(checklistItems).values({
    id,
    tenantId: ctx.tenantId, // [TENANT]
    checklistId,
    text: body.text.trim(),
    checked: false,
    position,
  })

  const newItem = { id, text: body.text.trim(), checked: false, position }
  const progress = await getChecklistProgress(ctx.tenantId, itemId)
  broadcast(projectId, { type: 'CHECKLIST_UPDATED', projectId, payload: { itemId, checklistId, progress } })

  return c.json(newItem, 201)
})

// PATCH /projects/:projectId/items/:itemId/checklists/:checklistId/items/:checklistItemId
checklistsRouter.patch('/:checklistId/items/:checklistItemId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, checklistId, checklistItemId } = c.req.param()
  const body = await c.req.json<{ text?: string; checked?: boolean; position?: number }>()

  // [TENANT] verifica acesso via item
  const allowed = await assertItemAccess(ctx.tenantId, itemId, projectId)
  if (!allowed) return c.json({ error: 'Item não encontrado' }, 404)

  const ci = await db.query.checklistItems.findFirst({
    where: (ci) => and(eq(ci.id, checklistItemId), eq(ci.checklistId, checklistId), eq(ci.tenantId, ctx.tenantId)),
  })
  if (!ci) return c.json({ error: 'Item de checklist não encontrado' }, 404)

  const updates: Partial<typeof checklistItems.$inferInsert> = {}
  if (body.text !== undefined) updates.text = body.text.trim()
  if (body.checked !== undefined) updates.checked = body.checked
  if (body.position !== undefined) updates.position = body.position

  await db.update(checklistItems).set(updates)
    .where(and(eq(checklistItems.id, checklistItemId), eq(checklistItems.tenantId, ctx.tenantId)))

  const progress = await getChecklistProgress(ctx.tenantId, itemId)
  broadcast(projectId, { type: 'CHECKLIST_UPDATED', projectId, payload: { itemId, checklistId, progress } })

  return c.json({ ...ci, ...updates, checked: Boolean(body.checked ?? ci.checked) })
})

// DELETE /projects/:projectId/items/:itemId/checklists/:checklistId/items/:checklistItemId
checklistsRouter.delete('/:checklistId/items/:checklistItemId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, checklistId, checklistItemId } = c.req.param()

  // [TENANT] verifica acesso via item
  const allowed = await assertItemAccess(ctx.tenantId, itemId, projectId)
  if (!allowed) return c.json({ error: 'Item não encontrado' }, 404)

  await db.delete(checklistItems)
    .where(and(
      eq(checklistItems.id, checklistItemId),
      eq(checklistItems.checklistId, checklistId),
      eq(checklistItems.tenantId, ctx.tenantId),
    ))

  const progress = await getChecklistProgress(ctx.tenantId, itemId)
  broadcast(projectId, { type: 'CHECKLIST_UPDATED', projectId, payload: { itemId, checklistId, progress } })

  return c.body(null, 204)
})
