import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import type { RequestContext } from '@azy-board/types'
import { parseJson, updateVersionSchema, versionSchema } from '../validation'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'

export const versionsRouter = new Hono<HonoEnv>()
versionsRouter.use('*', authMiddleware)

// GET /projects/:projectId/versions
versionsRouter.get('/', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!

  const result = await persistence.planning.listVersions(userPersistenceContext(ctx), projectId)

  return c.json(result)
})

// POST /projects/:projectId/versions
versionsRouter.post('/', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, versionSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  if (!body.name?.trim()) return c.json({ error: 'name é obrigatório' }, 400)

  const created = await persistence.planning.createVersion(userPersistenceContext(ctx), projectId, {
    name: body.name.trim(),
    releaseDate: body.releaseDate ?? null,
    description: body.description ?? null,
    status: body.status ?? 'PLANNED',
  })

  return c.json({ id: created.id, name: created.name, status: created.status }, 201)
})

// PATCH /projects/:projectId/versions/:versionId
versionsRouter.patch('/:versionId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, versionId } = c.req.param()
  const parsed = await parseJson(c, updateVersionSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const existing = await persistence.planning.getVersion(userPersistenceContext(ctx), projectId, versionId)
  if (!existing) return c.json({ error: 'Versão não encontrada' }, 404)

  const updated = await persistence.planning.updateVersion(userPersistenceContext(ctx), projectId, versionId, {
    ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    ...(body.releaseDate !== undefined ? { releaseDate: body.releaseDate } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.position !== undefined ? { position: body.position } : {}),
  })
  return c.json({ version: updated })
})

// DELETE /projects/:projectId/versions/:versionId
versionsRouter.delete('/:versionId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, versionId } = c.req.param()

  const deleted = await persistence.planning.deleteVersion(userPersistenceContext(ctx), projectId, versionId)
  if (!deleted) return c.json({ error: 'Versão não encontrada' }, 404)

  return c.json({ ok: true })
})

// GET /projects/:projectId/versions/:versionId/items
versionsRouter.get('/:versionId/items', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, versionId } = c.req.param()
  const page = Number.parseInt(c.req.query('page') ?? '1', 10) || 1
  const limit = Number.parseInt(c.req.query('limit') ?? '20', 10) || 20

  const projectContext = userPersistenceContext(ctx)
  const version = await persistence.planning.getVersion(projectContext, projectId, versionId)
  if (!version) return c.json({ error: 'Versão não encontrada' }, 404)

  const result = await persistence.planning.listVersionItems(projectContext, projectId, versionId, { page, limit })

  return c.json({ data: result.data, total: result.total, page, limit })
})
