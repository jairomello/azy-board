import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import type { RequestContext } from '@azy-board/api-contracts'
import { parseJson, tagSchema, updateTagSchema } from '../validation'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'
import { COMMAND_NAMESPACES } from '../persistence/idempotency'
import { runMetadataMutation } from '../services/metadataIdempotency'


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
  const projectContext = userPersistenceContext(ctx)

  const existing = (await persistence.planning.listTags(projectContext, projectId)).find(tag => tag.id === tagId)
  if (!existing) return c.json({ error: 'Tag não encontrada' }, 404)
  const changed = (body.name !== undefined && body.name !== existing.name) || (body.color !== undefined && body.color !== existing.color)

  try {
    const outcome = await runMetadataMutation({
      ctx, projectId, namespace: COMMAND_NAMESPACES.updateTag,
      idempotencyKey: c.req.header('Idempotency-Key'),
      payload: { tagId, name: body.name ?? null, color: body.color ?? null, expectedName: body.expectedName ?? null, expectedColor: body.expectedColor ?? null },
      execute: async () => {
        const updated = await persistence.planning.updateTag(projectContext, projectId, tagId, {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.color !== undefined ? { color: body.color } : {}),
          ...(body.expectedName !== undefined ? { expectedName: body.expectedName } : {}),
          ...(body.expectedColor !== undefined ? { expectedColor: body.expectedColor } : {}),
        })
        return {
          status: 200,
          body: {
            ok: true, changed,
            tag: updated,
            previous: { name: existing.name, color: existing.color },
          },
        }
      },
    })
    if (outcome.kind === 'conflict') {
      return c.json({ error: outcome.reason === 'payload' ? 'A chave já foi usada com outro payload' : 'Operação em andamento; tente novamente.', code: 'IDEMPOTENCY_CONFLICT', retryable: outcome.reason === 'in-flight' }, 409)
    }
    return c.json(outcome.body, outcome.status)
  } catch (error) {
    if (error instanceof Error && error.message === 'PRECONDITION_FAILED') {
      return c.json({ error: 'Os dados mudaram desde a aprovação; refaça a prévia.', code: 'CONFLICT', retryable: false }, 409)
    }
    throw error
  }
})

// DELETE /projects/:projectId/tags/:tagId
tagsRouter.delete('/:tagId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, tagId } = c.req.param()

  const deleted = await persistence.planning.deleteTag(userPersistenceContext(ctx), projectId, tagId)
  if (!deleted) return c.json({ error: 'Tag não encontrada' }, 404)

  return c.json({ ok: true })
})
