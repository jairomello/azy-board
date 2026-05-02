import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index'
import { tags, itemTags } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import { generateId } from '../utils/id'
import type { RequestContext } from '@azy-board/types'

export const tagsRouter = new Hono<HonoEnv>()
tagsRouter.use('*', authMiddleware)

// POST /projects/:projectId/tags
tagsRouter.post('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const body = await c.req.json<{ name: string; color?: string }>()

  const id = generateId()
  await db.insert(tags).values({
    id,
    tenantId: ctx.tenantId,
    projectId,
    name: body.name,
    color: body.color ?? '#6366f1',
  })

  return c.json({ id, name: body.name, color: body.color ?? '#6366f1' }, 201)
})

// GET /projects/:projectId/tags
tagsRouter.get('/', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!

  // [TENANT] Filtra por tenantId + projectId
  const result = await db.select().from(tags)
    .where(and(eq(tags.projectId, projectId), eq(tags.tenantId, ctx.tenantId)))

  return c.json(result)
})

// PATCH /projects/:projectId/tags/:tagId
tagsRouter.patch('/:tagId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const tagId = c.req.param('tagId')!
  const body = await c.req.json<{ name?: string; color?: string }>()

  await db.update(tags)
    .set({ ...(body.name && { name: body.name }), ...(body.color && { color: body.color }) })
    .where(and(eq(tags.id, tagId), eq(tags.tenantId, ctx.tenantId)))

  return c.json({ ok: true })
})

// DELETE /projects/:projectId/tags/:tagId
tagsRouter.delete('/:tagId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, tagId } = c.req.param()

  const tag = await db.query.tags.findFirst({
    where: (t) => and(eq(t.id, tagId), eq(t.projectId, projectId), eq(t.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!tag) return c.json({ error: 'Tag não encontrada' }, 404)

  await db.transaction(async (tx) => {
    // item_tags não possui tenantId; a tag acima já foi validada por tenant + projeto.
    await tx.delete(itemTags).where(eq(itemTags.tagId, tagId))
    await tx.delete(tags).where(and(eq(tags.id, tagId), eq(tags.tenantId, ctx.tenantId)))
  })

  return c.json({ ok: true })
})
