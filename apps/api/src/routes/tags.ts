import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import type { RequestContext } from '@azy-board/types'
import { parseJson, tagSchema, updateTagSchema } from '../validation'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'

export const tagsRouter = new Hono<HonoEnv>()
tagsRouter.use('*', authMiddleware)

// POST /projects/:projectId/tags
tagsRouter.post('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, tagSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const tag = await persistence.planning.createTag(userPersistenceContext(ctx), projectId, {
    name: body.name, color: body.color ?? '#6366f1',
  })

  return c.json({ id: tag.id, name: tag.name, color: tag.color }, 201)
})

// GET /projects/:projectId/tags
tagsRouter.get('/', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!

  const result = await persistence.planning.listTags(userPersistenceContext(ctx), projectId)

  return c.json(result)
})

// PATCH /projects/:projectId/tags/:tagId
tagsRouter.patch('/:tagId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, tagId } = c.req.param()
  const parsed = await parseJson(c, updateTagSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const existing = (await persistence.planning.listTags(userPersistenceContext(ctx), projectId)).find(tag => tag.id === tagId)
  if (!existing) return c.json({ error: 'Tag não encontrada' }, 404)

  const updated = await persistence.planning.updateTag(userPersistenceContext(ctx), projectId, tagId, {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.color !== undefined ? { color: body.color } : {}),
  })
  return c.json({ tag: updated })
})

// DELETE /projects/:projectId/tags/:tagId
tagsRouter.delete('/:tagId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, tagId } = c.req.param()

  const deleted = await persistence.planning.deleteTag(userPersistenceContext(ctx), projectId, tagId)
  if (!deleted) return c.json({ error: 'Tag não encontrada' }, 404)

  return c.json({ ok: true })
})
