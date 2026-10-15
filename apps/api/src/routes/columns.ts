import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import type { RequestContext } from '@azy-board/api-contracts'
import { resolveColumnProgressWeights, type ProgressColumn } from '@azy-board/domain'
import { columnSchema, deleteColumnSchema, parseJson, reorderSchema, updateColumnSchema } from '../validation'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'
import type { ColumnRecord } from '../persistence/models'


export const columnsRouter = new Hono<HonoEnv>()
columnsRouter.use('*', authMiddleware)

// Contrato de coluna: o peso efetivo (derivado ou explícito) alimenta o cálculo de avanço
// no web; o override permite ao editor saber se há valor explícito a restaurar.
function columnWithEffectiveWeight(column: ColumnRecord, columns: readonly ColumnRecord[]) {
  const effective = resolveColumnProgressWeights(columns.map(toProgressColumn))
  return {
    ...column,
    progressWeightOverride: column.progressWeight,
    progressWeight: effective.get(column.id) ?? 0,
  }
}

function toProgressColumn(column: ColumnRecord): ProgressColumn {
  return { id: column.id, baseStatus: column.baseStatus, position: column.position, progressWeight: column.progressWeight }
}

// GET /projects/:projectId/columns
columnsRouter.get('/', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!

  const result = await persistence.projects.listColumns(userPersistenceContext(ctx), projectId)
  const weights = resolveColumnProgressWeights(result.map(toProgressColumn))

  return c.json(result.map(column => ({
    ...column,
    progressWeightOverride: column.progressWeight,
    progressWeight: weights.get(column.id) ?? 0,
  })))
})

// POST /projects/:projectId/columns
columnsRouter.post('/', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, columnSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const created = await persistence.projects.createColumn(userPersistenceContext(ctx), projectId, {
    name: body.name, baseStatus: body.baseStatus,
    ...(body.progressWeight !== undefined ? { progressWeight: body.progressWeight } : {}),
  })

  const columns = await persistence.projects.listColumns(userPersistenceContext(ctx), projectId)
  return c.json(columnWithEffectiveWeight(created, columns), 201)
})

// PATCH /projects/:projectId/columns/reorder — antes de /:colId para não colidir
columnsRouter.patch('/reorder', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, reorderSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  await persistence.projects.reorderColumns(userPersistenceContext(ctx), projectId, body.order)

  return c.json({ ok: true })
})

// PATCH /projects/:projectId/columns/:colId
columnsRouter.patch('/:colId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const colId = c.req.param('colId')!
  const parsed = await parseJson(c, updateColumnSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const existing = await persistence.projects.getColumn(userPersistenceContext(ctx), projectId, colId)
  if (!existing) return c.json({ error: 'Coluna não encontrada' }, 404)

  const updated = await persistence.projects.updateColumn(userPersistenceContext(ctx), projectId, colId, {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.baseStatus !== undefined ? { baseStatus: body.baseStatus } : {}),
    ...(body.progressWeight !== undefined ? { progressWeight: body.progressWeight } : {}),
  })
  if (!updated) return c.json({ error: 'Coluna não encontrada' }, 404)
  const columns = await persistence.projects.listColumns(userPersistenceContext(ctx), projectId)
  return c.json({ column: columnWithEffectiveWeight(updated, columns) })
})

// DELETE /projects/:projectId/columns/:colId
columnsRouter.delete('/:colId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const colId = c.req.param('colId')!
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, deleteColumnSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const existing = await persistence.projects.getColumn(userPersistenceContext(ctx), projectId, colId)
  if (!existing) return c.json({ error: 'Coluna não encontrada' }, 404)
  if (body.moveToColumnId) {
    const target = await persistence.projects.getColumn(userPersistenceContext(ctx), projectId, body.moveToColumnId)
    if (!target) return c.json({ error: 'Coluna destino não encontrada' }, 400)
  }

  await persistence.projects.deleteColumn(userPersistenceContext(ctx), projectId, colId, body.moveToColumnId ?? undefined)

  return c.json({ ok: true })
})
