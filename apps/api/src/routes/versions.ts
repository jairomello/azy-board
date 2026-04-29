import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { eq, and, asc, desc, sql } from 'drizzle-orm'
import { db } from '../db/index'
import { projectVersions, items } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import { generateId } from '../utils/id'
import type { RequestContext } from '@azy-board/types'

export const versionsRouter = new Hono<HonoEnv>()
versionsRouter.use('*', authMiddleware)

type VersionStatus = 'PLANNED' | 'IN_DEV' | 'RELEASED' | 'CANCELLED'

// GET /projects/:projectId/versions
versionsRouter.get('/', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!

  // [TENANT] filtro por tenantId + projectId
  const result = await db.select()
    .from(projectVersions)
    .where(and(eq(projectVersions.projectId, projectId), eq(projectVersions.tenantId, ctx.tenantId)))
    .orderBy(asc(projectVersions.position))

  return c.json(result)
})

// POST /projects/:projectId/versions
versionsRouter.post('/', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const body = await c.req.json<{
    name: string
    releaseDate?: string | null
    description?: string | null
    status?: VersionStatus
  }>()

  if (!body.name?.trim()) return c.json({ error: 'name é obrigatório' }, 400)

  const existing = await db.select({ id: projectVersions.id })
    .from(projectVersions)
    .where(and(eq(projectVersions.projectId, projectId), eq(projectVersions.tenantId, ctx.tenantId)))

  const id = generateId()
  const now = new Date().toISOString()

  // [TENANT] tenantId vem do middleware
  await db.insert(projectVersions).values({
    id,
    tenantId: ctx.tenantId,
    projectId,
    name: body.name.trim(),
    releaseDate: body.releaseDate ?? null,
    description: body.description ?? null,
    status: body.status ?? 'PLANNED',
    position: existing.length,
    createdAt: now,
  })

  return c.json({ id, name: body.name.trim(), status: body.status ?? 'PLANNED' }, 201)
})

// PATCH /projects/:projectId/versions/:versionId
versionsRouter.patch('/:versionId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { versionId } = c.req.param()
  const body = await c.req.json<{
    name?: string
    releaseDate?: string | null
    description?: string | null
    status?: VersionStatus
    position?: number
  }>()

  // [TENANT] Anti-IDOR
  const version = await db.query.projectVersions.findFirst({
    where: (v) => and(eq(v.id, versionId), eq(v.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!version) return c.json({ error: 'Versão não encontrada' }, 404)

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.releaseDate !== undefined) updates.releaseDate = body.releaseDate
  if (body.description !== undefined) updates.description = body.description
  if (body.status !== undefined) updates.status = body.status
  if (body.position !== undefined) updates.position = body.position

  await db.update(projectVersions)
    .set(updates)
    .where(and(eq(projectVersions.id, versionId), eq(projectVersions.tenantId, ctx.tenantId)))

  return c.json({ ok: true })
})

// DELETE /projects/:projectId/versions/:versionId
versionsRouter.delete('/:versionId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { versionId } = c.req.param()

  // [TENANT] Anti-IDOR
  const version = await db.query.projectVersions.findFirst({
    where: (v) => and(eq(v.id, versionId), eq(v.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!version) return c.json({ error: 'Versão não encontrada' }, 404)

  // Desassociar itens (ON DELETE SET NULL garante isso no DB, mas fazemos explicitamente)
  await db.update(items)
    .set({ versionId: null })
    .where(and(eq(items.versionId, versionId), eq(items.tenantId, ctx.tenantId)))

  await db.delete(projectVersions)
    .where(and(eq(projectVersions.id, versionId), eq(projectVersions.tenantId, ctx.tenantId)))

  return c.json({ ok: true })
})

// GET /projects/:projectId/versions/:versionId/items
versionsRouter.get('/:versionId/items', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { versionId } = c.req.param()
  const page = parseInt(c.req.query('page') ?? '1')
  const limit = parseInt(c.req.query('limit') ?? '20')
  const offset = (page - 1) * limit

  // [TENANT] Anti-IDOR na versão
  const version = await db.query.projectVersions.findFirst({
    where: (v) => and(eq(v.id, versionId), eq(v.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!version) return c.json({ error: 'Versão não encontrada' }, 404)

  // [TENANT] itens da versão filtrados por tenant
  const result = await db.query.items.findMany({
    where: (i) => and(eq(i.versionId, versionId), eq(i.tenantId, ctx.tenantId)),
    with: {
      assignee: { columns: { id: true, name: true, avatarUrl: true } },
    },
    columns: { id: true, title: true, type: true, status: true, priority: true, assigneeId: true },
    orderBy: (i, { asc }) => [asc(i.type), asc(i.title)],
    limit,
    offset,
  })

  const totalRow = await db.select({ count: sql<number>`COUNT(*)` })
    .from(items)
    .where(and(eq(items.versionId, versionId), eq(items.tenantId, ctx.tenantId)))
  const total = totalRow[0]?.count ?? 0

  return c.json({ data: result, total, page, limit })
})
