import { Hono } from 'hono'
import type { Context } from 'hono'
import type { HonoEnv } from '../types/hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import { broadcast } from '../services/websocket'
import type { RequestContext } from '@azy-board/api-contracts'
import { checklistItemSchema, checklistSchema, parseJson, updateChecklistItemSchema, updateChecklistSchema } from '../validation'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'
import type { ChecklistItemRecord, ChecklistRecord } from '../persistence/models'

export const checklistsRouter = new Hono<HonoEnv>()
checklistsRouter.use('*', authMiddleware)

// [TENANT] Resolve o gate de checklists detalhados dentro do tenant autenticado.
async function projectAdvancedChecklists(tenantId: string, projectId: string): Promise<boolean> {
  const project = await persistence.projects.getProject({ tenantId, actorUserId: null, actorKind: 'SYSTEM' }, projectId)
  return Boolean(project?.advancedChecklists)
}

// Campos avançados só podem ser gravados quando o projeto os habilita.
function hasAdvancedChecklistFields(body: Record<string, unknown>): boolean {
  return body.dueDate !== undefined || body.assigneeId !== undefined || body.description !== undefined
}

function advancedFieldsDisabledResponse(c: Context) {
  return c.json({
    error: 'Checklists detalhados estão desabilitados neste projeto',
    code: 'CHECKLIST_ADVANCED_DISABLED',
    retryable: false,
  }, 422)
}

// [TENANT] Resolve o responsável para devolver o objeto no payload de resposta.
async function resolveChecklistAssignee(tenantId: string, assigneeId: string | null | undefined) {
  if (!assigneeId) return null
  const user = await persistence.identity.findUser({ tenantId, actorUserId: null, actorKind: 'SYSTEM' }, assigneeId)
  return user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl } : null
}

// Mapeia o item de checklist expondo os campos avançados apenas no modo detalhado.
function mapChecklistItem(ci: ChecklistItemRecord, advanced: boolean, assignee: { id: string; name: string; avatarUrl: string | null } | null = null) {
  const base = { id: ci.id, text: ci.text, checked: Boolean(ci.checked), position: ci.position }
  if (!advanced) return base
  return {
    ...base,
    dueDate: ci.dueDate ?? null,
    assigneeId: ci.assigneeId ?? null,
    assignee,
    description: ci.description ?? null,
  }
}

async function checklistResponse(tenantId: string, checklist: ChecklistRecord, advanced: boolean) {
  const items = await Promise.all(checklist.items.map(async item => (
    mapChecklistItem(item, advanced, advanced ? await resolveChecklistAssignee(tenantId, item.assigneeId) : null)
  )))
  return { id: checklist.id, name: checklist.name, position: checklist.position, items }
}

// GET /projects/:projectId/items/:itemId/checklists
checklistsRouter.get('/', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const advanced = await projectAdvancedChecklists(ctx.tenantId, projectId)
  const rows = await persistence.checklists.listChecklists(projectContext, projectId, itemId)

  return c.json(await Promise.all(rows.map(row => checklistResponse(ctx.tenantId, row, advanced))))
})

// POST /projects/:projectId/items/:itemId/checklists
checklistsRouter.post('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  const parsed = await parseJson(c, checklistSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  if (!body.name?.trim()) return c.json({ error: 'name é obrigatório' }, 400)

  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const created = await persistence.checklists.createChecklist(projectContext, projectId, itemId, body.name.trim())

  const progress = await persistence.checklists.getChecklistProgress(projectContext, itemId)
  broadcast(projectId, { type: 'CHECKLIST_UPDATED', projectId, payload: { itemId, progress } })

  return c.json({ id: created.id, name: created.name, position: created.position, items: [] }, 201)
})

// PATCH /projects/:projectId/items/:itemId/checklists/:checklistId
checklistsRouter.patch('/:checklistId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, checklistId } = c.req.param()
  const parsed = await parseJson(c, updateChecklistSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const existing = await persistence.checklists.getChecklist(projectContext, projectId, itemId, checklistId)
  if (!existing) return c.json({ error: 'Checklist não encontrado' }, 404)

  const updated = await persistence.checklists.updateChecklist(projectContext, projectId, itemId, checklistId, {
    ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    ...(body.position !== undefined ? { position: body.position } : {}),
  })
  if (!updated) return c.json({ error: 'Checklist não encontrado' }, 404)

  return c.json({ ...updated, items: undefined })
})

// DELETE /projects/:projectId/items/:itemId/checklists/:checklistId
checklistsRouter.delete('/:checklistId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, checklistId } = c.req.param()

  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  await persistence.checklists.deleteChecklist(projectContext, projectId, itemId, checklistId)

  const progress = await persistence.checklists.getChecklistProgress(projectContext, itemId)
  broadcast(projectId, { type: 'CHECKLIST_UPDATED', projectId, payload: { itemId, progress } })

  return c.body(null, 204)
})

// POST /projects/:projectId/items/:itemId/checklists/:checklistId/items
checklistsRouter.post('/:checklistId/items', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, checklistId } = c.req.param()
  const parsed = await parseJson(c, checklistItemSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  if (!body.text?.trim()) return c.json({ error: 'text é obrigatório' }, 400)

  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  // Gate: campos avançados só existem quando o projeto habilita checklists detalhados.
  const advanced = await projectAdvancedChecklists(ctx.tenantId, projectId)
  if (!advanced && hasAdvancedChecklistFields(body as Record<string, unknown>)) return advancedFieldsDisabledResponse(c)
  if (advanced && body.assigneeId) {
    // [TENANT] responsável precisa ser membro do projeto do tenant autenticado
    const member = await persistence.projects.getMembership(projectContext, projectId, body.assigneeId)
    if (!member) return c.json({ error: 'O responsável deve ser membro do projeto', code: 'INVALID_ASSIGNEE', retryable: false }, 422)
  }

  const checklist = await persistence.checklists.getChecklist(projectContext, projectId, itemId, checklistId)
  if (!checklist) return c.json({ error: 'Checklist não encontrado' }, 404)

  let created: ChecklistItemRecord
  try {
    created = await persistence.checklists.createChecklistItem(projectContext, projectId, itemId, checklistId, {
      text: body.text.trim(),
      checked: false,
      dueDate: advanced ? body.dueDate ?? null : null,
      assigneeId: advanced ? body.assigneeId ?? null : null,
      description: advanced ? body.description ?? null : null,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'CHECKLIST_NOT_FOUND') return c.json({ error: 'Checklist não encontrado' }, 404)
    throw error
  }

  const newItem = mapChecklistItem(
    created,
    advanced,
    advanced ? await resolveChecklistAssignee(ctx.tenantId, created.assigneeId) : null,
  )
  const progress = await persistence.checklists.getChecklistProgress(projectContext, itemId)
  broadcast(projectId, { type: 'CHECKLIST_UPDATED', projectId, payload: { itemId, checklistId, progress } })

  return c.json(newItem, 201)
})

// PATCH /projects/:projectId/items/:itemId/checklists/:checklistId/items/:checklistItemId
checklistsRouter.patch('/:checklistId/items/:checklistItemId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, checklistId, checklistItemId } = c.req.param()
  const parsed = await parseJson(c, updateChecklistItemSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  // Gate: campos avançados só existem quando o projeto habilita checklists detalhados.
  const advanced = await projectAdvancedChecklists(ctx.tenantId, projectId)
  if (!advanced && hasAdvancedChecklistFields(body as Record<string, unknown>)) return advancedFieldsDisabledResponse(c)
  if (advanced && body.assigneeId) {
    // [TENANT] responsável precisa ser membro do projeto do tenant autenticado
    const member = await persistence.projects.getMembership(projectContext, projectId, body.assigneeId)
    if (!member) return c.json({ error: 'O responsável deve ser membro do projeto', code: 'INVALID_ASSIGNEE', retryable: false }, 422)
  }

  const checklist = await persistence.checklists.getChecklist(projectContext, projectId, itemId, checklistId)
  if (!checklist) return c.json({ error: 'Checklist não pertence ao item informado', code: 'CHECKLIST_ITEM_MISMATCH', retryable: false }, 404)
  const ci = checklist.items.find(candidate => candidate.id === checklistItemId)
  if (!ci) return c.json({ error: 'Item de checklist não encontrado' }, 404)

  const updated = await persistence.checklists.updateChecklistItem(projectContext, projectId, itemId, checklistId, checklistItemId, {
    ...(body.text !== undefined ? { text: body.text.trim() } : {}),
    ...(body.checked !== undefined ? { checked: body.checked } : {}),
    ...(body.position !== undefined ? { position: body.position } : {}),
    ...(advanced && body.dueDate !== undefined ? { dueDate: body.dueDate } : {}),
    ...(advanced && body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
    ...(advanced && body.description !== undefined ? { description: body.description } : {}),
  })
  if (!updated) return c.json({ error: 'Item de checklist não encontrado' }, 404)

  const progress = await persistence.checklists.getChecklistProgress(projectContext, itemId)
  broadcast(projectId, { type: 'CHECKLIST_UPDATED', projectId, payload: { itemId, checklistId, progress } })

  return c.json(mapChecklistItem(
    updated,
    advanced,
    advanced ? await resolveChecklistAssignee(ctx.tenantId, updated.assigneeId) : null,
  ))
})

// DELETE /projects/:projectId/items/:itemId/checklists/:checklistId/items/:checklistItemId
checklistsRouter.delete('/:checklistId/items/:checklistItemId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, checklistId, checklistItemId } = c.req.param()

  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const checklist = await persistence.checklists.getChecklist(projectContext, projectId, itemId, checklistId)
  if (!checklist) return c.json({ error: 'Checklist não pertence ao item informado', code: 'CHECKLIST_ITEM_MISMATCH', retryable: false }, 404)

  await persistence.checklists.deleteChecklistItem(projectContext, projectId, itemId, checklistId, checklistItemId)

  const progress = await persistence.checklists.getChecklistProgress(projectContext, itemId)
  broadcast(projectId, { type: 'CHECKLIST_UPDATED', projectId, payload: { itemId, checklistId, progress } })

  return c.body(null, 204)
})
