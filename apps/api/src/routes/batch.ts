import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import type { RequestContext } from '@azy-board/api-contracts'
import { getIdempotent, saveIdempotent } from '../services/idempotency'
import { broadcast } from '../services/websocket'
import { batchSchema, batchUpdateSchema, parseJson } from '../validation'
import { persistence } from '../persistence/runtime'
import { userMutationContext } from '../persistence/context'
import type { BatchItemCreateOperation, BatchItemUpdate, ItemPatch } from '../persistence/ports'

export const batchRouter = new Hono<HonoEnv>()
batchRouter.use('*', authMiddleware)

function exactResource<T extends { id: string; name: string }>(values: T[], selector: string, field: string): T {
  const normalized = selector.trim()
  const byId = values.find(value => value.id === normalized)
  if (byId) return byId
  const matches = values.filter(value => value.name.localeCompare(normalized, undefined, { sensitivity: 'base' }) === 0)
  if (matches.length !== 1) throw new Error(matches.length ? `AMBIGUOUS_${field}` : `${field}_NOT_FOUND`)
  return matches[0]!
}

function isoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
}

function shiftedDate(days: number): string {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

batchRouter.post('/items/update', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, batchUpdateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const agentRunId = typeof body.agentRunId === 'string' ? body.agentRunId : undefined
  const payload = { projectId, filters: body.filters, changes: body.changes }
  if (agentRunId) {
    try {
      const cached = await getIdempotent(ctx, 'update-items', agentRunId, payload)
      if (cached) return c.json(cached)
    } catch {
      return c.json({ code: 'IDEMPOTENCY_CONFLICT', error: 'A chave já foi usada com outro payload' }, 409)
    }
  }

  const snapshot = await persistence.batch.loadItemUpdateSnapshot(userMutationContext(ctx, 'MCP'), projectId)
  if (!snapshot) return c.json({ code: 'PROJECT_NOT_FOUND', error: 'Projeto não encontrado' }, 404)
  const { project, items: projectItems, modules: projectModules, sprints: projectSprints, versions, columns: projectColumns,
    costCenters, tags: projectTags, memberships: projectMemberships, users: tenantUsers, sprintLinks, tagLinks } = snapshot
  const filters = body.filters ?? {}
  const changes = body.changes
  const allowedFields = new Set(['title', 'description', 'priority', 'type', 'status', 'points', 'assignee', 'column', 'parent', 'module', 'startDate', 'dueDate', 'blockedReason', 'persona', 'goal', 'benefit', 'acceptanceCriteria', 'notes', 'version', 'costCenter', 'sprint'])
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > 20) return c.json({ code: 'VALIDATION_ERROR', error: 'changes deve conter entre 1 e 20 alterações' }, 422)
  const changedFields = new Set<string>()
  for (const change of changes) {
    if (typeof change.field !== 'string' || !allowedFields.has(change.field) || changedFields.has(change.field)) return c.json({ code: 'VALIDATION_ERROR', error: 'Campo de alteração inválido ou duplicado' }, 422)
    changedFields.add(change.field)
    if (!['SET', 'CLEAR', 'TODAY', 'OFFSET_DAYS', 'COPY_CREATED_DATE'].includes(String(change.operation))) return c.json({ code: 'VALIDATION_ERROR', error: `Operação inválida para ${change.field}` }, 422)
  }
  const filterValues = [filters.itemIds, filters.types, filters.statuses, filters.sprint, filters.version, filters.module, filters.assignee, filters.parent, filters.column, filters.tag, filters.titleContains, filters.onlyLeaves]
  if (!filterValues.some(value => value !== null && value !== undefined) && filters.matchAll !== true) return c.json({ code: 'VALIDATION_ERROR', error: 'Informe filtros ou confirme matchAll' }, 422)

  try {
    const activeItems = projectItems.filter(item => item.status !== 'ARCHIVED')
    const members = projectMemberships.map(membership => {
      const user = tenantUsers.find(candidate => candidate.id === membership.userId)!
      return { id: membership.userId, name: user?.name ?? '', email: user?.email ?? '' }
    })
    const resolveMember = (selector: string) => {
      const normalized = selector.trim()
      const matches = members.filter(member => member.id === normalized || member.email.toLocaleLowerCase() === normalized.toLocaleLowerCase() || member.name.localeCompare(normalized, undefined, { sensitivity: 'base' }) === 0)
      const unique = [...new Map(matches.map(member => [member.id, member])).values()]
      if (unique.length !== 1) throw new Error(unique.length ? 'AMBIGUOUS_ASSIGNEE' : 'ASSIGNEE_NOT_FOUND')
      return unique[0]!
    }
    const resolveSprint = (selector: string) => selector.toUpperCase() === 'CURRENT'
      ? (() => { const open = projectSprints.filter(sprint => sprint.status === 'OPEN'); if (open.length !== 1) throw new Error(open.length ? 'AMBIGUOUS_SPRINT' : 'SPRINT_NOT_FOUND'); return open[0]! })()
      : exactResource(projectSprints, selector, 'SPRINT')
    const selectedSprint = typeof filters.sprint === 'string' ? resolveSprint(filters.sprint) : null
    const selectedVersion = typeof filters.version === 'string' ? exactResource(versions, filters.version, 'VERSION') : null
    const selectedModule = typeof filters.module === 'string' ? exactResource(projectModules, filters.module, 'MODULE') : null
    const selectedAssignee = typeof filters.assignee === 'string' ? resolveMember(filters.assignee) : null
    const selectedParent = typeof filters.parent === 'string' ? exactResource(activeItems.map(item => ({ ...item, name: item.title })), filters.parent, 'PARENT') : null
    const selectedColumn = typeof filters.column === 'string' ? exactResource(projectColumns, filters.column, 'COLUMN') : null
    const selectedTag = typeof filters.tag === 'string' ? exactResource(projectTags, filters.tag, 'TAG') : null
    const activeParentIds = new Set(activeItems.map(item => item.parentId).filter((id): id is string => Boolean(id)))
    const epicModule = new Map(activeItems.filter(item => item.type === 'EPIC').map(item => [item.id, item.moduleId]))
    // Item 15: pares deduplicados por (item, relação) — cobre resíduos de vínculos repetidos
    // sem alterar o resultado dos filtros.
    const sprintLinkPairs = new Set(sprintLinks.map(link => `${link.itemId}\u0000${link.relatedId}`))
    const tagLinkPairs = new Set(tagLinks.map(link => `${link.itemId}\u0000${link.relatedId}`))
    let matched = activeItems.filter(item => {
      if (Array.isArray(filters.itemIds) && !filters.itemIds.includes(item.id)) return false
      if (Array.isArray(filters.types) && !filters.types.includes(item.type)) return false
      if (Array.isArray(filters.statuses) && !filters.statuses.includes(item.status)) return false
      if (selectedSprint && !sprintLinkPairs.has(`${item.id}\u0000${selectedSprint.id}`)) return false
      if (selectedVersion && item.versionId !== selectedVersion.id) return false
      if (selectedAssignee && item.assigneeId !== selectedAssignee.id) return false
      if (selectedParent && item.parentId !== selectedParent.id) return false
      if (selectedColumn && item.columnId !== selectedColumn.id) return false
      if (selectedTag && !tagLinkPairs.has(`${item.id}\u0000${selectedTag.id}`)) return false
      if (typeof filters.titleContains === 'string' && !item.title.toLocaleLowerCase().includes(filters.titleContains.toLocaleLowerCase())) return false
      if (filters.onlyLeaves === true && activeParentIds.has(item.id)) return false
      if (filters.onlyLeaves === false && !activeParentIds.has(item.id)) return false
      if (selectedModule) {
        let moduleId = item.moduleId
        if (!moduleId) {
          try {
            const path = JSON.parse(item.ancestryPath) as Array<{ id?: string; type?: string }>
            const epicId = path.find(node => node.type === 'EPIC')?.id
            moduleId = epicId ? epicModule.get(epicId) ?? null : null
          } catch { moduleId = null }
        }
        if (moduleId !== selectedModule.id) return false
      }
      return true
    })
    if (matched.length === 0) return c.json({ code: 'NO_ITEMS_MATCHED', error: 'Nenhum item corresponde aos filtros informados' }, 422)

    const resolvedChanges = changes.map(change => {
      const field = change.field as string, operation = change.operation as string
      if (operation === 'SET' && (typeof change.value !== 'string' || !change.value.trim())) throw new Error(`VALUE_REQUIRED_${field}`)
      if (['TODAY', 'OFFSET_DAYS', 'COPY_CREATED_DATE'].includes(operation) && field !== 'startDate' && field !== 'dueDate') throw new Error(`INVALID_OPERATION_${field}`)
      if (operation === 'CLEAR' && ['title', 'priority', 'type', 'status'].includes(field)) throw new Error(`FIELD_NOT_CLEARABLE_${field}`)
      if (field === 'parent' && operation === 'CLEAR') throw new Error('HIERARCHY_REQUIRED')
      if (operation === 'OFFSET_DAYS' && (typeof change.value !== 'string' || !/^-?\d+$/.test(change.value) || Math.abs(Number(change.value)) > 36_500)) throw new Error(`INVALID_OFFSET_${field}`)
      let relationId: string | null | undefined
      if (operation === 'CLEAR') relationId = null
      else if (operation === 'SET') {
        if (field === 'assignee') relationId = resolveMember(change.value as string).id
        if (field === 'column') relationId = exactResource(projectColumns, change.value as string, 'COLUMN').id
        if (field === 'parent') relationId = exactResource(activeItems.map(item => ({ ...item, name: item.title })), change.value as string, 'PARENT').id
        if (field === 'module') relationId = exactResource(projectModules, change.value as string, 'MODULE').id
        if (field === 'version') relationId = exactResource(versions, change.value as string, 'VERSION').id
        if (field === 'costCenter') relationId = exactResource(costCenters.map(value => ({ ...value, name: value.code })), change.value as string, 'COST_CENTER').id
        if (field === 'sprint') relationId = resolveSprint(change.value as string).id
      }
      return { field, operation, value: change.value as string | null, relationId }
    })
    const relationFields: Record<string, string> = { assignee: 'assigneeId', column: 'columnId', parent: 'parentId', module: 'moduleId', version: 'versionId', costCenter: 'costCenterId' }
    const labels: Record<string, string> = { title: 'Título', description: 'Descrição', priority: 'Prioridade', type: 'Tipo', status: 'Status', points: 'Pontos', assignee: 'Responsável', column: 'Coluna', parent: 'Pai', module: 'Módulo', startDate: 'Início', dueDate: 'Fim', blockedReason: 'Motivo do bloqueio', persona: 'Persona', goal: 'Objetivo', benefit: 'Benefício', acceptanceCriteria: 'Critérios de aceite', notes: 'Notas', version: 'Versão', costCenter: 'Centro de custo', sprint: 'Sprint' }
    const now = new Date().toISOString()
    const updatesById = new Map<string, Record<string, unknown>>()
    for (const item of matched) {
      const update: Record<string, unknown> = { updatedAt: now }
      for (const change of resolvedChanges) {
        if (change.field === 'sprint') continue
        const targetField = relationFields[change.field] ?? change.field
        if (change.relationId !== undefined) update[targetField] = change.relationId
        else if (change.operation === 'CLEAR') update[targetField] = null
        else if (change.operation === 'TODAY') update[targetField] = shiftedDate(0)
        else if (change.operation === 'OFFSET_DAYS') update[targetField] = shiftedDate(Number(change.value))
        else if (change.operation === 'COPY_CREATED_DATE') update[targetField] = item.createdAt.slice(0, 10)
        else if (change.field === 'points') update[targetField] = Number(change.value)
        else update[targetField] = change.value
      }
      const nextType = (update.type ?? item.type) as typeof item.type
      if (project.boardMode === 'SIMPLE' && (nextType === 'TASK' || nextType === 'BUG')) { update.parentId = project.simpleStoryId; update.moduleId = null }
      if (changedFields.has('type') && project.boardMode !== 'SIMPLE' && (nextType === 'TASK' || nextType === 'BUG') && !item.parentId && update.parentId === undefined) throw new Error('HIERARCHY_REQUIRED')
      const nextColumnId = update.columnId === undefined ? item.columnId : update.columnId as string | null
      if (changedFields.has('column') && nextColumnId) update.status = projectColumns.find(column => column.id === nextColumnId)!.baseStatus
      if (changedFields.has('status') && (nextType === 'TASK' || nextType === 'BUG')) {
        const status = update.status as string
        const column = projectColumns.find(candidate => candidate.baseStatus === status)
        if (!column) throw new Error('COLUMN_FOR_STATUS_NOT_FOUND')
        update.columnId = column.id
      }
      const startDate = (update.startDate === undefined ? item.startDate : update.startDate) as string | null
      const dueDate = (update.dueDate === undefined ? item.dueDate : update.dueDate) as string | null
      if ((startDate && !isoDate(startDate)) || (dueDate && !isoDate(dueDate)) || (startDate && dueDate && startDate > dueDate)) throw new Error('INVALID_DATE_RANGE')
      const title = String(update.title ?? item.title).trim()
      if (!title || title.length > 500) throw new Error('INVALID_TITLE')
      update.title = changedFields.has('title') ? title : item.title
      if (changedFields.has('priority') && !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(update.priority))) throw new Error('INVALID_PRIORITY')
      if (changedFields.has('type') && !['TASK', 'BUG'].includes(String(update.type))) throw new Error('INVALID_TYPE')
      if (changedFields.has('status') && !['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'].includes(String(update.status))) throw new Error('INVALID_STATUS')
      if (changedFields.has('points') && update.points !== null && (!Number.isInteger(update.points) || Number(update.points) < 0)) throw new Error('INVALID_POINTS')
      updatesById.set(item.id, update)
    }

    const resulting = new Map<string, typeof projectItems[number]>(projectItems.map(item => [item.id, { ...item, ...(updatesById.get(item.id) ?? {}) } as typeof item]))
    // A hierarquia só é revalidada quando a mutação toca pai/tipo: estruturas preexistentes
    // inválidas não devem bloquear updates de campos (versão, sprint, responsável etc.).
    if (changedFields.has('parent') || changedFields.has('type')) {
      for (const item of matched) {
        const next = resulting.get(item.id)!
        if (next.parentId === next.id) throw new Error('INVALID_HIERARCHY')
        const parent = next.parentId ? resulting.get(next.parentId) : null
        if (next.type === 'EPIC' && (next.parentId || !next.moduleId)) throw new Error('INVALID_HIERARCHY')
        if (next.type === 'STORY' && parent?.type !== 'EPIC') throw new Error('INVALID_HIERARCHY')
        if ((next.type === 'TASK' || next.type === 'BUG') && parent && !['STORY', 'TASK', 'BUG'].includes(parent.type)) throw new Error('INVALID_HIERARCHY')
      }
    }
    const pathCache = new Map<string, Array<{ id: string; title: string; type: string }>>()
    const ancestryFor = (id: string, visiting = new Set<string>()): Array<{ id: string; title: string; type: string }> => {
      if (pathCache.has(id)) return pathCache.get(id)!
      if (visiting.has(id)) throw new Error('INVALID_HIERARCHY')
      visiting.add(id)
      const item = resulting.get(id)
      if (!item) throw new Error('INVALID_HIERARCHY')
      const path = item.parentId ? (() => { const parent = resulting.get(item.parentId!); if (!parent) throw new Error('INVALID_HIERARCHY'); return [...ancestryFor(parent.id, visiting), { id: parent.id, title: parent.title, type: parent.type }] })() : []
      visiting.delete(id); pathCache.set(id, path); return path
    }
    for (const id of resulting.keys()) ancestryFor(id)

    const batchUpdates: BatchItemUpdate[] = []
    const sprintChange = resolvedChanges.find(change => change.field === 'sprint')
    for (const item of matched) {
      const update = updatesById.get(item.id)!
      const ancestryPath = JSON.stringify(pathCache.get(item.id) ?? [])
      if ((changedFields.has('title') || changedFields.has('parent') || changedFields.has('type')) && ancestryPath !== item.ancestryPath) {
        update.ancestryPath = ancestryPath
      }
      const visibleUpdate = Object.fromEntries(Object.entries(update).filter(([key]) => key !== 'updatedAt'))
      const auditChanges = resolvedChanges.map(change => `${labels[change.field]}: "${change.operation === 'CLEAR' ? '' : String(visibleUpdate[relationFields[change.field] ?? change.field] ?? change.relationId ?? change.value ?? '')}"`)
      batchUpdates.push({
        itemId: item.id,
        patch: update as ItemPatch,
        ...(sprintChange ? { sprintIds: sprintChange.relationId ? [sprintChange.relationId] : [] } : {}),
        changedFields: [...changedFields],
        activity: `Campos alterados em lote: ${auditChanges.join('; ').slice(0, 10_000)}`,
        responseChanges: visibleUpdate,
      })
    }
    if (changedFields.has('title') || changedFields.has('parent') || changedFields.has('type')) {
      const included = new Set(matched.map(item => item.id))
      for (const item of projectItems) {
        const ancestryPath = JSON.stringify(pathCache.get(item.id) ?? [])
        if (!included.has(item.id) && ancestryPath !== item.ancestryPath) {
          batchUpdates.push({ itemId: item.id, patch: { ancestryPath }, changedFields: [] })
        }
      }
    }
    const mutationContext = userMutationContext(ctx, agentRunId ? 'MCP' : 'REST', agentRunId ?? null)
    if (agentRunId) {
      mutationContext.mutation.actorType = 'AGENT'
      mutationContext.mutation.actorLabel = 'Azy Agent'
    }
    const resultItems = await persistence.unitOfWork.applyItemBatch(mutationContext, projectId, batchUpdates)
    const result = { matchedCount: matched.length, updatedCount: resultItems.length, fields: [...changedFields], items: resultItems }
    if (agentRunId) await saveIdempotent(ctx, 'update-items', agentRunId, payload, result)
    for (const item of resultItems) broadcast(projectId, { type: 'ITEM_UPDATED', projectId, payload: { itemId: item.id, ...item.changes } })
    return c.json(result)
  } catch (error) {
    const code = error instanceof Error ? error.message : 'BULK_UPDATE_FAILED'
    return c.json({ code, error: 'Nenhuma alteração foi aplicada. Revise os filtros e valores informados.' }, 422)
  }
})

batchRouter.post('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, batchSchema)
  if (!parsed.ok) return parsed.response
  const input = parsed.data
  if (!Array.isArray(input.operations) || input.operations.length === 0 || input.operations.length > 50) return c.json({ code: 'VALIDATION_ERROR', error: 'operations deve conter entre 1 e 50 entradas' }, 422)
  const atomic = input.atomic === true
  const key = input.idempotencyKey
  const payload = { projectId, operations: input.operations, atomic }
  if (key) {
    try {
      const cached = await getIdempotent(ctx, 'batch', key, payload)
      if (cached) return c.json(cached)
    } catch {
      return c.json({ code: 'IDEMPOTENCY_CONFLICT', error: 'A chave já foi usada com outro payload' }, 409)
    }
  }

  const operations: BatchItemCreateOperation[] = input.operations.map(operation => {
    const body = operation.args ?? operation.body ?? {}
    const tool = operation.tool ?? (operation.method === 'POST' && operation.path === '/items' ? 'create_task' : '')
    const rawType = body.type
    const validType = rawType === 'EPIC' || rawType === 'STORY' || rawType === 'TASK' || rawType === 'BUG'
    const rawPriority = body.priority
    const priority = rawPriority === 'LOW' || rawPriority === 'MEDIUM' || rawPriority === 'HIGH' || rawPriority === 'CRITICAL'
      ? rawPriority
      : undefined
    return {
      tool,
      title: typeof body.title === 'string' ? body.title : null,
      ...(validType ? { type: rawType } : typeof rawType === 'string' ? { invalidType: rawType } : {}),
      ref: typeof body.ref === 'string' ? body.ref : null,
      parentRef: typeof body.parentRef === 'string' ? body.parentRef : null,
      parentId: typeof body.parentId === 'string' ? body.parentId : null,
      moduleId: typeof body.moduleId === 'string' ? body.moduleId : null,
      moduleName: typeof body.moduleName === 'string' ? body.moduleName : null,
      description: typeof body.description === 'string' ? body.description : null,
      priority,
      points: typeof body.points === 'number' ? body.points : null,
      assignToCurrentUser: body.assignToCurrentUser === true,
    }
  })

  try {
    const mutationContext = userMutationContext(ctx, 'BATCH', input.agentRunId ?? null)
    if (input.agentRunId) {
      mutationContext.mutation.actorType = 'AGENT'
      mutationContext.mutation.actorSource = 'MCP'
      mutationContext.mutation.actorLabel = 'Azy Agent'
    }
    const result = await persistence.unitOfWork.createItemsBatch(mutationContext, projectId, operations, {
      atomic, agentRunId: input.agentRunId ?? null,
    })
    const response = { atomic: result.atomic, agentRunId: result.agentRunId, results: result.results }
    if (key) await saveIdempotent(ctx, 'batch', key, payload, response)
    for (const module of result.createdModules) broadcast(projectId, { type: 'MODULE_CREATED', projectId, payload: module })
    for (const entry of result.results) {
      if (!entry.ok || !entry.data) continue
      broadcast(projectId, {
        type: entry.data.parentId ? 'SUBTASK_CREATED' : 'ITEM_CREATED', projectId,
        payload: entry.data.parentId ? { parentId: entry.data.parentId, item: entry.data } : entry.data,
      })
    }
    return c.json(response, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INTERNAL_ERROR'
    const match = message.match(/^BATCH_ITEM:(\d+):(.*)$/)
    const failedAt = match ? Number(match[1]) : -1
    const reason = match?.[2] ?? message
    const code = reason === 'VALIDATION_ERROR' || reason === 'HIERARCHY_REQUIRED' ? reason : 'BATCH_ROLLED_BACK'
    const detail = failedAt >= 0 ? ` (operação ${failedAt + 1}: ${reason})` : ''
    return c.json({ code, error: atomic ? `Lote desfeito; nenhuma operação foi aplicada${detail}` : 'Erro no lote' }, 422)
  }
})
