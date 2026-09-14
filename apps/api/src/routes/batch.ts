import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/index'
import { columns, itemLogs, items, itemSprints, itemTags, memberships, modules, projectCostCenters, projects, projectVersions, sprints, tags, users } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import type { RequestContext } from '@azy-board/types'
import { generateId } from '../utils/id'
import { getIdempotent, saveIdempotent } from '../services/idempotency'
import { assertProjectScope } from '../services/scope'
import { appendAnalyticsEvent, snapshotItem } from '../services/analytics'
import { broadcast } from '../services/websocket'
import { batchSchema, batchUpdateSchema, parseJson } from '../validation'

export const batchRouter = new Hono<HonoEnv>()
batchRouter.use('*', authMiddleware)

type Operation = { tool?: string; args?: Record<string, unknown>; method?: string; path?: string; body?: Record<string, unknown> }
type BatchTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
type BatchDb = typeof db | BatchTransaction
type ItemChange = { field?: unknown; operation?: unknown; value?: unknown }
type ItemFilters = {
  itemIds?: unknown; types?: unknown; statuses?: unknown; sprint?: unknown; version?: unknown; module?: unknown
  assignee?: unknown; parent?: unknown; column?: unknown; tag?: unknown; titleContains?: unknown; onlyLeaves?: unknown; matchAll?: unknown
}

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

async function runCreate(ctx: RequestContext, projectId: string, body: Record<string, unknown>, tx: BatchDb = db) {
  // [TENANT] Projeto e todas as relações são resolvidos pelo contexto autenticado, nunca pelo body.
  const project = await tx.query.projects.findFirst({ where: (p) => and(eq(p.id, projectId), eq(p.tenantId, ctx.tenantId)), columns: { id: true, tenantId: true, boardMode: true, simpleStoryId: true } })
  if (!project || typeof body.title !== 'string' || !body.title.trim()) throw new Error('VALIDATION_ERROR')
  assertProjectScope({ tenantId: project.tenantId, projectId: project.id }, ctx.tenantId, projectId)
  const type = typeof body.type === 'string' ? body.type : 'TASK'
  const parentId = project.boardMode === 'SIMPLE' && (type === 'TASK' || type === 'BUG') ? project.simpleStoryId : (typeof body.parentId === 'string' ? body.parentId : null)
  if (type === 'STORY' && !parentId) throw new Error('VALIDATION_ERROR')
  if ((type === 'TASK' || type === 'BUG') && !parentId) throw new Error('HIERARCHY_REQUIRED')
  if (type === 'EPIC' && (parentId || typeof body.moduleId !== 'string')) throw new Error('VALIDATION_ERROR')
  let ancestryPath: Array<{ id: string; title: string; type: string }> = []
  if (parentId) {
    const parent = await tx.query.items.findFirst({ where: (i) => and(eq(i.id, parentId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)), columns: { id: true, title: true, type: true, ancestryPath: true } })
    if (!parent) throw new Error('RELATION_OUT_OF_SCOPE')
    if (type === 'STORY' && parent.type !== 'EPIC') throw new Error('VALIDATION_ERROR')
    if ((type === 'TASK' || type === 'BUG') && !['STORY', 'TASK', 'BUG'].includes(parent.type)) throw new Error('VALIDATION_ERROR')
    try { ancestryPath = JSON.parse(parent.ancestryPath) } catch { ancestryPath = [] }
    ancestryPath.push({ id: parent.id, title: parent.title, type: parent.type })
  }
  if (typeof body.moduleId === 'string') {
    const module = await tx.query.modules.findFirst({ where: (m) => and(eq(m.id, body.moduleId as string), eq(m.projectId, projectId), eq(m.tenantId, ctx.tenantId)), columns: { id: true } })
    if (!module) throw new Error('RELATION_OUT_OF_SCOPE')
  }
  const firstColumn = type === 'TASK' || type === 'BUG'
    ? await tx.query.columns.findFirst({ where: (column) => and(eq(column.projectId, projectId), eq(column.tenantId, ctx.tenantId)), orderBy: (column, { asc }) => [asc(column.position)], columns: { id: true } })
    : null
  const id = generateId(); const now = new Date().toISOString()
  const priority = typeof body.priority === 'string' && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(body.priority) ? body.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' : 'MEDIUM'
  await tx.insert(items).values({ id, tenantId: ctx.tenantId, projectId, type: type as 'EPIC' | 'STORY' | 'TASK' | 'BUG', parentId, moduleId: typeof body.moduleId === 'string' ? body.moduleId : null, columnId: firstColumn?.id ?? null, title: body.title.trim(), description: typeof body.description === 'string' ? body.description : null, ancestryPath: JSON.stringify(ancestryPath), status: 'NOT_STARTED', priority, points: typeof body.points === 'number' ? body.points : null, assigneeId: body.assignToCurrentUser === true ? ctx.userId : null, position: 0, authorId: ctx.userId, createdAt: now, updatedAt: now })
  await appendAnalyticsEvent(tx, { tenantId: ctx.tenantId, projectId, itemId: id, eventType: 'ITEM_CREATED', actorId: ctx.userId, origin: 'BATCH', correlationId: `${id}`, after: await snapshotItem(tx, ctx.tenantId, projectId, id) })
  return {
    id, title: body.title.trim(), type, projectId, parentId,
    moduleId: typeof body.moduleId === 'string' ? body.moduleId : null,
    columnId: firstColumn?.id ?? null,
    ancestryPath: JSON.stringify(ancestryPath),
    description: typeof body.description === 'string' ? body.description : null,
    priority,
    points: typeof body.points === 'number' ? body.points : null,
    assigneeId: body.assignToCurrentUser === true ? ctx.userId : null,
    status: 'NOT_STARTED',
  }
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

  const project = await db.query.projects.findFirst({
    where: (row) => and(eq(row.id, projectId), eq(row.tenantId, ctx.tenantId)),
    columns: { id: true, boardMode: true, simpleStoryId: true },
  })
  if (!project) return c.json({ code: 'PROJECT_NOT_FOUND', error: 'Projeto não encontrado' }, 404)
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
    const [projectItems, projectModules, projectSprints, versions, projectColumns, costCenters, projectTags, projectMemberships, tenantUsers, sprintLinks, tagLinks] = await Promise.all([
      db.select().from(items).where(and(eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId))),
      db.select().from(modules).where(and(eq(modules.projectId, projectId), eq(modules.tenantId, ctx.tenantId))),
      db.select().from(sprints).where(and(eq(sprints.projectId, projectId), eq(sprints.tenantId, ctx.tenantId))),
      db.select().from(projectVersions).where(and(eq(projectVersions.projectId, projectId), eq(projectVersions.tenantId, ctx.tenantId))),
      db.select().from(columns).where(and(eq(columns.projectId, projectId), eq(columns.tenantId, ctx.tenantId))),
      db.select().from(projectCostCenters).where(and(eq(projectCostCenters.projectId, projectId), eq(projectCostCenters.tenantId, ctx.tenantId))),
      db.select().from(tags).where(and(eq(tags.projectId, projectId), eq(tags.tenantId, ctx.tenantId))),
      db.select().from(memberships).where(and(eq(memberships.projectId, projectId), eq(memberships.tenantId, ctx.tenantId))),
      db.select().from(users).where(eq(users.tenantId, ctx.tenantId)),
      db.select().from(itemSprints),
      db.select().from(itemTags),
    ])
    const activeItems = projectItems.filter(item => item.status !== 'ARCHIVED')
    const itemById = new Map(projectItems.map(item => [item.id, item]))
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
    let matched = activeItems.filter(item => {
      if (Array.isArray(filters.itemIds) && !filters.itemIds.includes(item.id)) return false
      if (Array.isArray(filters.types) && !filters.types.includes(item.type)) return false
      if (Array.isArray(filters.statuses) && !filters.statuses.includes(item.status)) return false
      if (selectedSprint && !sprintLinks.some(link => link.itemId === item.id && link.sprintId === selectedSprint.id)) return false
      if (selectedVersion && item.versionId !== selectedVersion.id) return false
      if (selectedAssignee && item.assigneeId !== selectedAssignee.id) return false
      if (selectedParent && item.parentId !== selectedParent.id) return false
      if (selectedColumn && item.columnId !== selectedColumn.id) return false
      if (selectedTag && !tagLinks.some(link => link.itemId === item.id && link.tagId === selectedTag.id)) return false
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

    const resultItems = await db.transaction(async tx => {
      const output: Array<{ id: string; changes: Record<string, unknown> }> = []
      for (const item of matched) {
        const update = updatesById.get(item.id)!
        const before = await snapshotItem(tx, ctx.tenantId, projectId, item.id)
        await tx.update(items).set(update).where(and(eq(items.id, item.id), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))
        const sprintChange = resolvedChanges.find(change => change.field === 'sprint')
        if (sprintChange) {
          await tx.delete(itemSprints).where(eq(itemSprints.itemId, item.id))
          if (sprintChange.relationId) await tx.insert(itemSprints).values({ tenantId: ctx.tenantId, itemId: item.id, sprintId: sprintChange.relationId })
        }
        const visibleUpdate = Object.fromEntries(Object.entries(update).filter(([key]) => key !== 'updatedAt'))
        const auditChanges = resolvedChanges.map(change => `${labels[change.field]}: "${change.operation === 'CLEAR' ? '' : String(visibleUpdate[relationFields[change.field] ?? change.field] ?? change.relationId ?? change.value ?? '')}"`)
        await tx.insert(itemLogs).values({ id: generateId(), tenantId: ctx.tenantId, itemId: item.id, authorId: ctx.userId, type: 'auto', actorType: agentRunId ? 'AGENT' : 'HUMAN', actorLabel: agentRunId ? 'Azy Agent' : null, source: agentRunId ? 'MCP' : 'REST', activity: `Campos alterados em lote: ${auditChanges.join('; ').slice(0, 10_000)}`, durationMin: null, createdAt: now, updatedAt: now })
        const after = await snapshotItem(tx, ctx.tenantId, projectId, item.id)
        const analytics: Array<[string, 'STATUS_CHANGED' | 'POINTS_CHANGED' | 'TYPE_CHANGED' | 'SPRINT_CHANGED' | 'VERSION_CHANGED' | 'ITEM_REPARENTED' | 'MODULE_CHANGED']> = [['status', 'STATUS_CHANGED'], ['points', 'POINTS_CHANGED'], ['type', 'TYPE_CHANGED'], ['sprint', 'SPRINT_CHANGED'], ['version', 'VERSION_CHANGED'], ['parent', 'ITEM_REPARENTED'], ['module', 'MODULE_CHANGED']]
        for (const [field, eventType] of analytics) if (changedFields.has(field)) await appendAnalyticsEvent(tx, { tenantId: ctx.tenantId, projectId, itemId: item.id, eventType, actorId: ctx.userId, origin: agentRunId ? 'MCP' : 'REST', correlationId: agentRunId, before, after })
        output.push({ id: item.id, changes: visibleUpdate })
      }
      if (changedFields.has('title') || changedFields.has('parent') || changedFields.has('type')) {
        for (const item of projectItems) {
          const ancestryPath = JSON.stringify(pathCache.get(item.id) ?? [])
          if (ancestryPath !== item.ancestryPath) await tx.update(items).set({ ancestryPath, updatedAt: now }).where(and(eq(items.id, item.id), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))
        }
      }
      return output
    })
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
  let failedAt = -1
  let failedReason = ''
  const createdModules: Array<{ id: string; name: string; position: number; description: string | null }> = []
  const execute = async (tx: BatchDb) => {
    const refs = new Map<string, string>()
    const projectModules = await tx.select({ id: modules.id, name: modules.name }).from(modules).where(and(eq(modules.projectId, projectId), eq(modules.tenantId, ctx.tenantId)))
    const ensureModule = async (name: string) => {
      const existing = projectModules.find(module => module.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)
      if (existing) return existing
      const id = generateId()
      const position = projectModules.length
      await tx.insert(modules).values({ id, tenantId: ctx.tenantId, projectId, name, description: null, position })
      projectModules.push({ id, name })
      createdModules.push({ id, name, position, description: null })
      return { id, name }
    }
    // Validate local references before writing; relation IDs are resolved as preceding operations execute.
    // [TENANT] Módulos inexistentes citados no lote são criados no projeto do tenant autenticado.
    if (atomic) {
      const declaredRefs = new Set<string>()
      const missingModules = new Set<string>()
      for (const [index, operation] of input.operations.entries()) {
        try {
          const tool = operation.tool ?? (operation.method === 'POST' && operation.path === '/items' ? 'create_task' : '')
          const body = operation.args ?? operation.body ?? {}
          if ((tool !== 'create_task' && tool !== 'create_item') || typeof body.title !== 'string' || !body.title.trim()) throw new Error('VALIDATION_ERROR')
          const project = await tx.query.projects.findFirst({ where: (p) => and(eq(p.id, projectId), eq(p.tenantId, ctx.tenantId)), columns: { id: true } })
          if (!project) throw new Error('VALIDATION_ERROR')
          const ref = typeof body.ref === 'string' ? body.ref : null
          if (ref && declaredRefs.has(ref)) throw new Error('VALIDATION_ERROR')
          const parentRef = typeof body.parentRef === 'string' ? body.parentRef : null
          if (parentRef && !declaredRefs.has(parentRef)) throw new Error('VALIDATION_ERROR')
          if (ref) declaredRefs.add(ref)
          const parentId = typeof body.parentId === 'string' ? body.parentId : null
          if (parentId) {
            const parent = await tx.query.items.findFirst({ where: (i) => and(eq(i.id, parentId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)), columns: { id: true } })
            if (!parent) throw new Error('RELATION_OUT_OF_SCOPE')
          }
          if (typeof body.moduleId === 'string') {
            const module = await tx.query.modules.findFirst({ where: (m) => and(eq(m.id, body.moduleId as string), eq(m.projectId, projectId), eq(m.tenantId, ctx.tenantId)), columns: { id: true } })
            if (!module) throw new Error('RELATION_OUT_OF_SCOPE')
          }
          if (typeof body.moduleName === 'string' && !projectModules.some(module => module.name.localeCompare(body.moduleName as string, undefined, { sensitivity: 'accent' }) === 0)) missingModules.add(body.moduleName)
        } catch (error) {
          failedAt = index
          failedReason = error instanceof Error ? error.message : 'INTERNAL_ERROR'
          throw error
        }
      }
      for (const name of missingModules) await ensureModule(name)
    }
    const results: Array<{ ok: boolean; data?: unknown; code?: string }> = []
    for (const [index, operation] of input.operations.entries()) {
      const tool = operation.tool ?? (operation.method === 'POST' && operation.path === '/items' ? 'create_task' : '')
      try {
        if (tool !== 'create_task' && tool !== 'create_item') throw new Error('VALIDATION_ERROR')
        const body = operation.args ?? operation.body ?? {}
        const parentRef = typeof body.parentRef === 'string' ? body.parentRef : null
        const parentId = parentRef ? refs.get(parentRef) : body.parentId
        if (parentRef && !parentId) throw new Error('RELATION_OUT_OF_SCOPE')
        const moduleName = typeof body.moduleName === 'string' ? body.moduleName : null
        const moduleId = moduleName ? (await ensureModule(moduleName)).id : body.moduleId
        const data = await runCreate(ctx, projectId, { ...body, parentId, moduleId }, tx)
        if (typeof body.ref === 'string') refs.set(body.ref, data.id)
        results.push({ ok: true, data })
      } catch (error) {
        failedAt = index
        failedReason = error instanceof Error ? error.message : 'INTERNAL_ERROR'
        if (atomic) throw error
        const code = error instanceof Error && ['VALIDATION_ERROR', 'RELATION_OUT_OF_SCOPE', 'HIERARCHY_REQUIRED'].includes(error.message) ? error.message : 'INTERNAL_ERROR'
        results.push({ ok: false, code })
      }
    }
    return { atomic, agentRunId: input.agentRunId ?? null, results }
  }
  try {
    const result = atomic ? await db.transaction(tx => execute(tx)) : await execute(db)
    if (key) await saveIdempotent(ctx, 'batch', key, payload, result)
    for (const module of createdModules) broadcast(projectId, { type: 'MODULE_CREATED', projectId, payload: module })
    for (const entry of result.results) {
      if (!entry.ok || !entry.data || typeof entry.data !== 'object') continue
      const item = entry.data as { id: string; parentId?: string | null }
      broadcast(projectId, { type: item.parentId ? 'SUBTASK_CREATED' : 'ITEM_CREATED', projectId, payload: item.parentId ? { parentId: item.parentId, item: entry.data } : entry.data })
    }
    return c.json(result, 200)
  } catch (error) {
    const code = error instanceof Error && ['VALIDATION_ERROR', 'HIERARCHY_REQUIRED'].includes(error.message) ? error.message : 'BATCH_ROLLED_BACK'
    const detail = failedAt >= 0 ? ` (operação ${failedAt + 1}: ${failedReason})` : ''
    return c.json({ code, error: atomic ? `Lote desfeito; nenhuma operação foi aplicada${detail}` : 'Erro no lote' }, 422)
  }
})
