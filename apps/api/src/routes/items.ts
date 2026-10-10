import { Hono, type Context } from 'hono'
import type { HonoEnv } from '../types/hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import { addTreeProgress, type TreeProgressNode } from '../services/treeProgress'
import type { RequestContext } from '@azy-board/api-contracts'
import type { ActivityActorType, ActivitySource, ItemType } from '@azy-board/domain'
import { parseWorkDuration } from '@azy-board/ui-contracts'
import { PROJECTION_FIELDS } from '@azy-board/tool-registry'
import { IDEMPOTENCY_RETENTION_MS, payloadHash } from '../services/idempotency'
import { COMMAND_NAMESPACES, isIdempotencyConflict, isIdempotentReplay, isPendingBody, parseEnvelope } from '../persistence/idempotency'
import { claimItem, releaseItem } from '../services/itemMutations'
import { triggerStorageCleanupAfterCommit } from '../services/storageCleanup'
import { confirmationSchema, createItemSchema, itemLogSchema, itemSprintSchema, itemTagsSchema, moveItemSchema, parseJson, parseOptionalJson, reorderItemsSchema, updateItemLogSchema, updateItemSchema, updateWorkLogSchema, workLogSchema } from '../validation'
import { persistence } from '../persistence/runtime'
import { userMutationContext, userPersistenceContext } from '../persistence/context'
import type { ItemLogRecord, ItemRecord, ItemDependencyRecord, ItemDependencyTargetSummary, ItemDependencyWithTarget } from '../persistence/models'
import { emitDomainEvent, findOperationId } from '../services/domainEventOutbox'
import { createItemApplication, moveItemApplication, updateItemApplication } from '../application/items'
import { loadItemWithRelations } from '../application/itemRules'

export const itemsRouter = new Hono<HonoEnv>()
itemsRouter.use('*', authMiddleware)

/** Resumo de dependências por item, agregado sem N+1 (uma leitura de arestas do projeto). */
function dependencyIndexByItem(
  items: Array<{ id: string; projectId: string; title: string; type: ItemType; sequenceCode: string | null }>,
  edges: ItemDependencyRecord[],
  extraTargets: Map<string, ItemDependencyTargetSummary> = new Map(),
): Map<string, { dependencies: Array<Pick<ItemDependencyWithTarget, 'dependsOnItemId' | 'dependencyType' | 'lagDays' | 'dependsOn'>>; dependencyCount: number }> {
  const summaryByItem = new Map<string, ItemDependencyTargetSummary>(
    items.map(item => [item.id, { id: item.id, title: item.title, type: item.type, sequenceCode: item.sequenceCode, projectId: item.projectId, projectName: null }]),
  )
  for (const [id, summary] of extraTargets) summaryByItem.set(id, summary)
  const byOrigin = new Map<string, Array<Pick<ItemDependencyWithTarget, 'dependsOnItemId' | 'dependencyType' | 'lagDays' | 'dependsOn'>>>()
  for (const edge of edges) {
    const list = byOrigin.get(edge.itemId) ?? []
    list.push({
      dependsOnItemId: edge.dependsOnItemId,
      dependencyType: edge.dependencyType,
      lagDays: edge.lagDays,
      dependsOn: summaryByItem.get(edge.dependsOnItemId)
        ?? { id: edge.dependsOnItemId, title: '', type: 'TASK' as ItemType, sequenceCode: null, projectId: edge.dependsOnProjectId ?? items[0]?.projectId ?? '', projectName: null },
    })
    byOrigin.set(edge.itemId, list)
  }
  return new Map([...byOrigin].map(([itemId, dependencies]) => [itemId, { dependencies, dependencyCount: dependencies.length }]))
}

// [TENANT] Resolve os resumos de itens dependidos que estão em OUTROS projetos
// (cross-project), buscando por projeto acessível do mesmo tenant.
async function resolveCrossProjectDependencyTargets(
  projectContext: ReturnType<typeof userPersistenceContext>,
  edges: ItemDependencyRecord[],
  projectId: string,
): Promise<Map<string, ItemDependencyTargetSummary>> {
  const missingByProject = new Map<string, string[]>()
  for (const edge of edges) {
    const targetProjectId = edge.dependsOnProjectId
    if (!targetProjectId || targetProjectId === projectId) continue
    const ids = missingByProject.get(targetProjectId) ?? []
    if (!ids.includes(edge.dependsOnItemId)) ids.push(edge.dependsOnItemId)
    missingByProject.set(targetProjectId, ids)
  }
  const result = new Map<string, ItemDependencyTargetSummary>()
  for (const [targetProjectId, ids] of missingByProject) {
    const project = await persistence.projects.getProject(projectContext, targetProjectId)
    const projectName = project?.name ?? null
    const targets = await persistence.items.listItems(projectContext, targetProjectId)
    for (const item of targets) {
      if (ids.includes(item.id)) {
        result.set(item.id, { id: item.id, title: item.title, type: item.type, sequenceCode: item.sequenceCode, projectId: targetProjectId, projectName })
      }
    }
  }
  return result
}

function auditContext(c: Context<HonoEnv>): { actorType: ActivityActorType; source: ActivitySource; actorLabel: string | null } {
  const apiKeyId = c.get('apiKeyId')
  return {
    actorType: apiKeyId ? 'AGENT' : 'HUMAN',
    source: apiKeyId ? 'MCP' : 'REST',
    actorLabel: apiKeyId ? c.get('apiKeyName') : null,
  }
}

// PATCH /projects/:projectId/items/reorder — antes de /:itemId para não colidir
itemsRouter.patch('/reorder', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, reorderItemsSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const targetColumn = await persistence.projects.getColumn(userPersistenceContext(ctx), projectId, body.columnId)
  if (!targetColumn) return c.json({ error: 'Coluna não encontrada neste projeto' }, 404)
  const uniqueOrder = [...new Set(body.order)]
  if (uniqueOrder.length !== body.order.length) return c.json({ error: 'A ordem contém cards duplicados' }, 400)
  // Arquivar preserva columnId, mas o board não exibe nem envia cards arquivados.
  const orderedItems = (await persistence.items.listItems(userPersistenceContext(ctx), projectId, { columnId: body.columnId }))
    .filter(item => item.status !== 'ARCHIVED')
  if (orderedItems.length !== uniqueOrder.length) return c.json({ error: 'A ordem contém cards que não pertencem à coluna' }, 400)
  const orderSet = new Set(uniqueOrder)
  if (orderedItems.some(item => !orderSet.has(item.id))) return c.json({ error: 'A ordem contém cards que não pertencem à coluna' }, 400)

  await persistence.items.reorderItems(userPersistenceContext(ctx), projectId, body.columnId, body.order)

  void emitDomainEvent({ tenantId: ctx.tenantId, projectId: projectId, type: 'CARD_UPDATED', payload: { reordered: true, columnId: body.columnId, itemIds: body.order } })
  return c.json({ ok: true })
})

// GET /projects/:projectId/items/tree
itemsRouter.get('/tree', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const filterModuleId = c.req.query('moduleId')
  const filterAssigneeId = c.req.query('assigneeId')
  const filterSprintId = c.req.query('sprintId')
  const filterTagIds = c.req.query('tagIds')?.split(',').filter(Boolean) ?? []

  // [TENANT] Filtra por tenantId + projectId; exclui itens arquivados por padrão
  const projectContext = userPersistenceContext(ctx)
  const [allModules, allItems] = await Promise.all([
    persistence.projects.listModules(projectContext, projectId),
    persistence.items.listItemsWithRelations(projectContext, projectId),
  ])
  const activeItems = allItems.filter(item => item.status !== 'ARCHIVED')

  const assigneeIds = [...new Set(activeItems.map(item => item.assigneeId).filter((id): id is string => id !== null))]
  const usersInTenant = assigneeIds.length > 0 ? await persistence.identity.listUsers(projectContext) : []
  const assignees = usersInTenant.filter(user => assigneeIds.includes(user.id)).map(user => ({ id: user.id, name: user.name, avatarUrl: user.avatarUrl }))
  const assigneeMap = new Map(assignees.map(assignee => [assignee.id, assignee]))
  // [TENANT] Arestas de dependência do projeto, agregadas em um único mapa (sem N+1).
  const dependencyEdges = await persistence.itemDependencies.listByProject(projectContext, projectId)
  const extraTargets = await resolveCrossProjectDependencyTargets(projectContext, dependencyEdges, projectId)
  const dependencyIndex = dependencyIndexByItem(activeItems, dependencyEdges, extraTargets)
  const treeItems = activeItems.map(item => {
    const dependency = dependencyIndex.get(item.id)
    return {
      ...item,
      assignee: item.assigneeId ? assigneeMap.get(item.assigneeId) ?? null : null,
      dependencies: dependency?.dependencies ?? [],
      dependencyCount: dependency?.dependencyCount ?? 0,
    }
  })

  // [TENANT] O modo e a STORY fixa são resolvidos dentro do projeto do tenant atual.
  const project = await persistence.projects.getProject(projectContext, projectId)

  let sprintItemIds: Set<string> | null = null
  if (filterSprintId) {
    sprintItemIds = new Set(activeItems.filter(item => item.itemSprints.some(link => link.sprintId === filterSprintId)).map(item => item.id))
  }

  let tagItemIds: Set<string> | null = null
  if (filterTagIds.length > 0) {
    tagItemIds = new Set(activeItems.filter(item => item.itemTags.some(link => filterTagIds.includes(link.tag.id))).map(item => item.id))
  }

  const epics = treeItems.filter(i =>
    i.type === 'EPIC' &&
    (!filterModuleId || i.moduleId === filterModuleId)
  )

  function buildChildren(parentId: string, depth: number): TreeProgressNode[] {
    const children = treeItems
      .filter(i => i.parentId === parentId)
      .sort((a, b) => a.position - b.position)

    return children.map(child => {
      const nested = buildChildren(child.id, depth + 1)
      const hasChildren = treeItems.some(item => item.parentId === child.id)
      const leafItems = !hasChildren && ['TASK', 'BUG', 'EXTERNAL'].includes(child.type)

      if (filterAssigneeId && leafItems && child.assigneeId !== filterAssigneeId) return null
      if (sprintItemIds && leafItems && !sprintItemIds.has(child.id)) return null
      if (tagItemIds && leafItems && !tagItemIds.has(child.id)) return null

      return {
        ...child,
        ancestryPath: (() => { try { return JSON.parse(child.ancestryPath) } catch { return [] } })(),
        isLeaf: !hasChildren,
        children: nested.filter(child => child !== null),
      }
    }).filter(child => child !== null) as TreeProgressNode[]
  }

  if (project?.boardMode === 'SIMPLE') {
    const fixedStory = treeItems.find(item => item.id === project.simpleStoryId) ?? treeItems.find(item => item.type === 'STORY' && !item.parentId)
    if (!fixedStory) return c.json([])
    return c.json(addTreeProgress([{
      ...fixedStory,
      type: 'STORY' as const,
      ancestryPath: [],
      isLeaf: false,
      children: buildChildren(fixedStory.id, 0),
    }]))
  }

  const tree = (filterModuleId ? allModules.filter(m => m.id === filterModuleId) : allModules)
    .map(mod => ({
      ...mod,
      type: 'module' as const,
      children: epics
        .filter(e => e.moduleId === mod.id)
        .map(epic => ({
          ...epic,
          ancestryPath: [],
          isLeaf: false,
          children: buildChildren(epic.id, 2),
        })),
    }))

  return c.json(addTreeProgress(tree))
})

// GET /projects/:projectId/items
itemsRouter.get('/', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const typeParam = c.req.query('type')
  const leafOnly = c.req.query('leaf') === 'true'
  const parentIdFilter = c.req.query('parentId')
  const columnIdFilter = c.req.query('columnId')
  const moduleIdFilter = c.req.query('moduleId')
  const sprintIdFilter = c.req.query('sprintId')
  const assigneeIdFilter = c.req.query('assigneeId')
  const statusFilter = c.req.query('status')
  const tagIdsFilter = c.req.query('tagIds')?.split(',').filter(Boolean) ?? []
  const requestedLimit = c.req.query('limit')
  const cursor = c.req.query('cursor')
  const includeDescriptions = c.req.query('includeDescriptions') === 'true'
  const requestedFields = c.req.query('fields')?.split(',').map(field => field.trim()).filter(Boolean) ?? null
  // [DB-SWAP] Projeção é aplicada sobre o objeto plano já carregado — nada específico do driver.
  const allowedFields = new Set(PROJECTION_FIELDS)
  const unknownField = requestedFields?.find(field => !allowedFields.has(field))
  if (unknownField) return c.json({ error: `Campo de projeção desconhecido: ${unknownField}`, code: 'INVALID_PROJECTION', retryable: false, details: { field: unknownField } }, 422)
  const page = Math.max(1, Number.parseInt(c.req.query('page') ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, Number.parseInt(requestedLimit ?? '50', 10) || 50))
  let cursorOffset = 0
  if (cursor) {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString()
      if (!/^\d+$/.test(decoded)) throw new Error('invalid')
      cursorOffset = Number.parseInt(decoded, 10)
    } catch {
      return c.json({ error: 'Cursor inválido', code: 'INVALID_CURSOR', retryable: false }, 400)
    }
  }

  // [TENANT] Filtra por tenantId + projectId
  let allItems = await persistence.items.listItemsWithRelations(userPersistenceContext(ctx), projectId)

  // Excluir itens arquivados por padrão — só aparecem via endpoint dedicado
  allItems = allItems.filter(i => i.status !== 'ARCHIVED')

  if (typeParam) {
    const types = typeParam.split(',') as ItemType[]
    allItems = allItems.filter(i => types.includes(i.type as ItemType))
  }
  if (parentIdFilter) {
    allItems = allItems.filter(i => i.parentId === parentIdFilter)
  }
  if (columnIdFilter) {
    allItems = allItems.filter(i => i.columnId === columnIdFilter)
  }
  if (moduleIdFilter) {
    allItems = allItems.filter(i => i.moduleId === moduleIdFilter)
  }
  if (assigneeIdFilter) {
    allItems = allItems.filter(i => i.assigneeId === assigneeIdFilter)
  }
  if (statusFilter) {
    const statuses = statusFilter.split(',')
    allItems = allItems.filter(i => statuses.includes(i.status))
  }
  if (tagIdsFilter.length > 0) {
    allItems = allItems.filter(i => i.itemTags?.some(link => tagIdsFilter.includes(link.tag.id)))
  }
  if (sprintIdFilter) {
    const sprint = await persistence.planning.getSprint(userPersistenceContext(ctx), projectId, sprintIdFilter)
    allItems = sprint ? allItems.filter(item => item.itemSprints.some(link => link.sprintId === sprint.id)) : []
  }

  // Leaf Rule: calcular isLeaf client-side
  const parentIdSet = new Set(allItems.map(i => i.parentId).filter(Boolean) as string[])
  const withIsLeaf = allItems.map(i => ({ ...i, isLeaf: !parentIdSet.has(i.id) }))

  // Contar filhos diretos por item — derivado dos dados já carregados, sem query extra
  // [DB-SWAP] GROUP BY equivalente em PostgreSQL: SELECT parent_id, COUNT(*) FROM items GROUP BY parent_id
  const childrenCountMap = new Map<string, number>()
  for (const item of allItems) {
    if (item.parentId) {
      childrenCountMap.set(item.parentId, (childrenCountMap.get(item.parentId) ?? 0) + 1)
    }
  }

  // Progresso de checklists por item — agregado pelo port, sem N+1.
  const progressEntries = await Promise.all(allItems.map(async item => {
    const progress = await persistence.checklists.getChecklistProgress(userPersistenceContext(ctx), item.id)
    return [item.id, progress] as const
  }))
  const progressMap = new Map(progressEntries.filter(([, progress]) => progress.total > 0))

  const withProgress = withIsLeaf.map(i => ({
    ...i,
    childrenCount: childrenCountMap.get(i.id) ?? 0,
    checklistProgress: progressMap.has(i.id) && progressMap.get(i.id)!.total > 0
      ? progressMap.get(i.id)!
      : null,
  }))

  // [TENANT] Arestas de dependência do projeto, agregadas em um único mapa (sem N+1).
  const dependencyEdges = await persistence.itemDependencies.listByProject(userPersistenceContext(ctx), projectId)
  const extraTargets = await resolveCrossProjectDependencyTargets(userPersistenceContext(ctx), dependencyEdges, projectId)
  const dependencyIndex = dependencyIndexByItem(allItems, dependencyEdges, extraTargets)

  const projected = withProgress.map(item => {
    const dependency = dependencyIndex.get(item.id)
    const flat = {
      ...item,
      sprintId: item.itemSprints[0]?.sprintId ?? null,
      sprintName: null,
      tagIds: item.itemTags.map(link => link.tag.id),
      tagNames: item.itemTags.map(link => link.tag.name),
      dependencies: dependency?.dependencies ?? [],
      dependencyCount: dependency?.dependencyCount ?? 0,
    } as Record<string, unknown>
    // itemSprints é preservado na resposta: o Board filtra cards por sprint client-side
    // via i.itemSprints?.some(...) (BoardScreen.tsx). Remover este campo esvaziava o board.
    delete flat.itemTags
    if (!includeDescriptions) for (const field of ['description', 'persona', 'goal', 'benefit', 'acceptanceCriteria', 'notes']) delete flat[field]
    if (!requestedFields) return flat
    const minimum = new Set(['id', 'title', 'type', 'status', 'isLeaf'])
    return Object.fromEntries(Object.entries(flat).filter(([field]) => minimum.has(field) || requestedFields.includes(field)))
  })

  if (leafOnly) {
    const leafItems = projected.filter(i => i.isLeaf)
    const offset = cursor ? cursorOffset : (page - 1) * limit
    const end = offset + limit
    return c.json({ data: leafItems.slice(offset, end), page, limit, total: leafItems.length, hasMore: end < leafItems.length, nextCursor: end < leafItems.length ? Buffer.from(String(end)).toString('base64url') : null })
  }

  const offset = cursor ? cursorOffset : (page - 1) * limit
  const end = offset + limit
  return c.json({ data: projected.slice(offset, end), page, limit, total: projected.length, hasMore: end < projected.length, nextCursor: end < projected.length ? Buffer.from(String(end)).toString('base64url') : null })
})

// GET /projects/:projectId/items/archived — listar todos os items arquivados do projeto
itemsRouter.get('/archived', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!

  const projectContext = userPersistenceContext(ctx)
  const [projectItems, projectColumns] = await Promise.all([
    persistence.items.listItems(projectContext, projectId),
    persistence.projects.listColumns(projectContext, projectId),
  ])
  const archived = projectItems.filter(item => item.status === 'ARCHIVED')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

  // Incluir nome da coluna original (via statusBeforeArchive mapeado para nome de coluna)
  const colMap = new Map(projectColumns.map(column => [column.id, column.name]))

  const result = archived.map(item => {
    const path: Array<{ id: string; title: string; type: string }> = (() => {
      try { return JSON.parse(item.ancestryPath || '[]') } catch { return [] }
    })()
    const epicAncestor = path.find(n => n.type === 'EPIC')
    return {
      ...item,
      ancestryPath: path,
      epicTitle: epicAncestor?.title ?? null,
      originalColumnName: item.columnId ? colMap.get(item.columnId) ?? null : null,
    }
  })

  return c.json(result)
})

// GET /projects/:projectId/items/:itemId
itemsRouter.get('/:itemId', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  // [TENANT] Anti-IDOR: filtra por tenantId + itemId
  const projectContext = userPersistenceContext(ctx)
  const allItems = await persistence.items.listItemsWithRelations(projectContext, projectId)
  const item = allItems.find(candidate => candidate.id === itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  // [TENANT] gate do modo detalhado resolvido no projeto do tenant autenticado
  const projectRow = await persistence.projects.getProject(projectContext, projectId)
  const advanced = Boolean(projectRow?.advancedChecklists)

  const [attachments, sprints, checklists] = await Promise.all([
    persistence.files.listAttachments(projectContext, projectId, itemId),
    persistence.planning.listSprints(projectContext, projectId),
    persistence.checklists.listChecklists(projectContext, projectId, itemId),
  ])
  const sprintById = new Map(sprints.map(sprint => [sprint.id, sprint]))
  const assigneeCache = new Map<string, { id: string; name: string; avatarUrl: string | null } | null>()
  const resolveAssignee = async (userId: string | null) => {
    if (!userId) return null
    if (!assigneeCache.has(userId)) {
      const user = await persistence.identity.findUser(projectContext, userId)
      assigneeCache.set(userId, user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl } : null)
    }
    return assigneeCache.get(userId) ?? null
  }

  const children = allItems.filter(candidate => candidate.parentId === itemId)
  const mappedChecklists = await Promise.all(checklists.map(async cl => ({
    id: cl.id,
    name: cl.name,
    position: cl.position,
    items: await Promise.all(cl.items.map(async ci => {
      const base = { id: ci.id, text: ci.text, checked: Boolean(ci.checked), position: ci.position }
      if (!advanced) return base
      return {
        ...base,
        dueDate: ci.dueDate ?? null,
        assigneeId: ci.assigneeId ?? null,
        assignee: await resolveAssignee(ci.assigneeId),
        description: ci.description ?? null,
      }
    })),
  })))

  const { itemSprints, ...itemFields } = item
  return c.json({
    ...itemFields,
    itemSprints: itemSprints.map(link => ({ sprintId: link.sprintId, sprint: sprintById.get(link.sprintId) ?? null })),
    attachments,
    children: children.map(child => ({ id: child.id, title: child.title, type: child.type, status: child.status, priority: child.priority, points: child.points })),
    isLeaf: children.length === 0,
    childrenCount: children.length,
    checklists: mappedChecklists,
  })
})

// POST /projects/:projectId/items
itemsRouter.post('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const parsed = await parseJson(c, createItemSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const idempotencyKey = c.req.header('Idempotency-Key') ?? (body as { idempotencyKey?: string }).idempotencyKey
  const idempotencyPayload = { projectId, body: { ...body, idempotencyKey: undefined } }
  // [T38] Hash canônico calculado ANTES da transação; a reserva/replay acontece
  // dentro do commit da mutação (UnitOfWork), não mais em find/save separados.
  const commandHash = idempotencyKey ? await payloadHash(idempotencyPayload) : null

  const audit = auditContext(c)

  // [TENANT] tenantId vem do contexto autenticado; relações, log e analytics
  // entram no mesmo comando síncrono/atômico do adapter SQLite.
  let id: string | null = null
  try {
    const mutationContext = userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST', idempotencyKey)
    mutationContext.mutation.actorType = audit.actorType
    mutationContext.mutation.actorSource = audit.source
    mutationContext.mutation.actorLabel = audit.actorLabel
    if (idempotencyKey && commandHash) {
      mutationContext.idempotency = {
        namespace: COMMAND_NAMESPACES.createItem,
        projectScope: projectId,
        key: idempotencyKey,
        payloadHash: commandHash,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS).toISOString(),
      }
    }
    const createResult = await createItemApplication({
      context: ctx,
      permissionScope: c.get('apiKeyPermissionScope'),
      projectId,
      minimumRole: 'MEMBER',
      mutationContext,
      body,
    })
    if (!createResult.ok) return c.json(createResult.body, createResult.status)
    id = createResult.record.id
  } catch (error) {
    if (isIdempotencyConflict(error)) return c.json({ code: 'IDEMPOTENCY_CONFLICT', error: 'A chave já foi usada com outro payload' }, 409)
    if (isIdempotentReplay(error)) {
      const envelope = parseEnvelope(error.record.responseJson)
      let replayBody = envelope?.body
      if (isPendingBody(replayBody)) {
        // Crash entre commit e corpo final: reconstrói pelo recurso persistido.
        const rebuilt = await loadItemWithRelations(ctx.tenantId, projectId, replayBody.__pendingOperationId)
        if (!rebuilt) return c.json({ error: 'Operação já confirmada, mas o recurso não está acessível.' }, 409)
        replayBody = { ...rebuilt, isLeaf: true, childrenCount: 0, checklistProgress: null }
        if (idempotencyKey) {
          await persistence.idempotency.complete(userPersistenceContext(ctx), {
            tool: COMMAND_NAMESPACES.createItem, key: idempotencyKey, projectScope: projectId,
            responseJson: JSON.stringify({ status: 201, body: replayBody }),
          })
        }
      }
      if (!envelope || replayBody == null) return c.json({ error: 'Resultado idempotente indisponível.' }, 409)
      const replayOperationId = await findOperationId(ctx.tenantId, ctx.userId, COMMAND_NAMESPACES.createItem, idempotencyKey!, projectId)
      if (replayOperationId) c.header('X-Operation-Id', replayOperationId)
      return c.json(replayBody, 201)
    }
    if (error instanceof Error && error.message.includes('sprint')) return c.json({ error: error.message }, 409)
    throw error
  }

  if (!id) return c.json({ error: 'Item não encontrado após criação' }, 500)
  const created = await loadItemWithRelations(ctx.tenantId, projectId, id)
  if (!created) return c.json({ error: 'Item não encontrado após criação' }, 500)
  const payload = { ...created, isLeaf: true, childrenCount: 0, checklistProgress: null }

  // Corpo final no journal após o commit; crash antes disso é retomável pela
  // referência PENDING gravada na mesma transação.
  if (idempotencyKey) {
    await persistence.idempotency.complete(userPersistenceContext(ctx), {
      tool: COMMAND_NAMESPACES.createItem, key: idempotencyKey, projectScope: projectId,
      responseJson: JSON.stringify({ status: 201, body: payload }),
    })
  }

  // [T38] Metadado aditivo de operação (commit/publicação pendente consultáveis).
  if (idempotencyKey) {
    const operationId = await findOperationId(ctx.tenantId, ctx.userId, COMMAND_NAMESPACES.createItem, idempotencyKey, projectId)
    if (operationId) c.header('X-Operation-Id', operationId)
  }
  // [T38] O evento de criação é gravado pelo adapter no mesmo commit (item.created).
  return c.json(payload, 201)
})

// PATCH /projects/:projectId/items/:itemId/move — mover card para outra coluna
itemsRouter.patch('/:itemId/move', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  const parsed = await parseJson(c, moveItemSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const projectContext = userPersistenceContext(ctx)

  // [T38] Chave idempotente opcional (agente envia Idempotency-Key estável).
  const idempotencyKey = c.req.header('Idempotency-Key')
  const commandHash = idempotencyKey ? await payloadHash({ projectId, itemId, columnId: body.columnId }) : null
  const audit = auditContext(c)
  let moveStatus: string | null = null
  try {
    const mutationContext = userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST', idempotencyKey)
    mutationContext.mutation.actorType = audit.actorType
    mutationContext.mutation.actorSource = audit.source
    mutationContext.mutation.actorLabel = audit.actorLabel
    if (idempotencyKey && commandHash) {
      mutationContext.idempotency = {
        namespace: COMMAND_NAMESPACES.moveItem,
        projectScope: projectId,
        key: idempotencyKey,
        payloadHash: commandHash,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS).toISOString(),
      }
    }
    const moveResult = await moveItemApplication({
      context: ctx,
      permissionScope: c.get('apiKeyPermissionScope'),
      projectId,
      minimumRole: 'MEMBER',
      mutationContext,
      itemId,
      columnId: body.columnId,
    })
    if (!moveResult.ok) return c.json(moveResult.body, moveResult.status)
    moveStatus = moveResult.column.baseStatus
  } catch (error) {
    if (isIdempotencyConflict(error)) return c.json({ code: 'IDEMPOTENCY_CONFLICT', error: 'A chave já foi usada com outro payload' }, 409)
    if (isIdempotentReplay(error)) {
      const envelope = parseEnvelope(error.record.responseJson)
      const replayBody = envelope?.body as { itemId: string; columnId: string; status: string } | null | undefined
      if (replayBody == null) return c.json({ error: 'Resultado idempotente indisponível.' }, 409)
      const replayItem = await persistence.items.getItem(projectContext, projectId, itemId)
      const replayOperationId = await findOperationId(ctx.tenantId, ctx.userId, COMMAND_NAMESPACES.moveItem, idempotencyKey!, projectId)
      if (replayOperationId) c.header('X-Operation-Id', replayOperationId)
      return c.json({ item: replayItem, status: replayBody.status })
    }
    throw error
  }

  if (moveStatus === null) return c.json({ error: 'Movimentação sem resultado' }, 500)
  void emitDomainEvent({ tenantId: ctx.tenantId, projectId, type: 'CARD_MOVED', payload: { itemId, columnId: body.columnId, status: moveStatus } })

  if (idempotencyKey) {
    const operationId = await findOperationId(ctx.tenantId, ctx.userId, COMMAND_NAMESPACES.moveItem, idempotencyKey, projectId)
    if (operationId) c.header('X-Operation-Id', operationId)
  }
  const updated = await persistence.items.getItem(projectContext, projectId, itemId)
  return c.json({ item: updated, status: moveStatus })
})

// PATCH /projects/:projectId/items/:itemId/claim
itemsRouter.patch('/:itemId/claim', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)
  if (item.assigneeId) return c.json({ error: 'Item já está sendo trabalhado por outro usuário' }, 409)

  const apiKeyId = c.get('apiKeyId') as string | undefined

  const audit = auditContext(c)
  const progressColumn = (await persistence.projects.listColumns(projectContext, projectId)).find(column => column.baseStatus === 'IN_PROGRESS')
  const claimed = await claimItem({ tenantId: ctx.tenantId, projectId, itemId, userId: ctx.userId, apiKeyId, actor: audit, columnId: progressColumn?.id ?? item.columnId })
  if (!claimed) return c.json({ error: 'Item já está sendo trabalhado por outro usuário' }, 409)

  void emitDomainEvent({ tenantId: ctx.tenantId, projectId: projectId, type: 'TASK_CLAIMED', payload: { itemId, assigneeId: ctx.userId, apiKeyId } })
  const updated = await persistence.items.getItem(projectContext, projectId, itemId)
  return c.json({ item: updated })
})

// PATCH /projects/:projectId/items/:itemId/release
itemsRouter.patch('/:itemId/release', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const audit = auditContext(c)
  await releaseItem({ tenantId: ctx.tenantId, projectId, itemId, userId: ctx.userId, apiKeyId: c.get('apiKeyId') as string | undefined, actor: audit })

  void emitDomainEvent({ tenantId: ctx.tenantId, projectId: projectId, type: 'CARD_UPDATED', payload: { itemId, assigneeId: null } })
  const updated = await persistence.items.getItem(projectContext, projectId, itemId)
  return c.json({ item: updated })
})

// PATCH /projects/:projectId/items/:itemId — editar campos
itemsRouter.patch('/:itemId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  const parsed = await parseJson(c, updateItemSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const mutationContext = userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST')
  const audit = auditContext(c)
  let updatedRecord: ItemRecord | null = null
  let safeBody: Record<string, unknown> = {}
  let tagIds: string[] | null = null
  try {
    const updateResult = await updateItemApplication({
      context: ctx,
      permissionScope: c.get('apiKeyPermissionScope'),
      projectId,
      minimumRole: 'MEMBER',
      mutationContext,
      itemId,
      body,
      actor: { actorType: audit.actorType, source: audit.source, actorLabel: audit.actorLabel },
    })
    if (!updateResult.ok) return c.json(updateResult.body, updateResult.status)
    updatedRecord = updateResult.record
    safeBody = updateResult.safeBody
    tagIds = updateResult.tagIds
  } catch (error) {
    if (error instanceof Error && error.message.includes('PERSISTENCE_CONFLICT')) {
      return c.json({ error: 'O item foi alterado por outra pessoa desde que você o abriu. Recarregue e tente novamente.', code: 'CONFLICT', retryable: false }, 409)
    }
    throw error
  }
  if (!updatedRecord) return c.json({ error: 'Item não encontrado' }, 404)

  const updated = await loadItemWithRelations(ctx.tenantId, projectId, itemId)
  void emitDomainEvent({ tenantId: ctx.tenantId, projectId, type: 'ITEM_UPDATED', payload: { itemId, ...safeBody, updatedAt: updatedRecord.updatedAt, ...(tagIds !== undefined ? { itemTags: updated?.itemTags ?? [] } : {}) } })
  return c.json({ item: updated })
})

// DELETE /projects/:projectId/items/:itemId — exclusão em cascata (filhos, checklists, tags)
itemsRouter.delete('/:itemId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  // [TENANT] Anti-IDOR: verificar que o item pertence ao tenant antes de qualquer operação
  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const parsedBody = await parseOptionalJson(c, confirmationSchema)
  if (!parsedBody.ok) return parsedBody.response
  const requestBody = parsedBody.data

  if (requestBody.dryRun) {
    const allIds = (await persistence.items.listSubtree(projectContext, projectId, itemId)).map(descendant => descendant.id)
    return c.json({ dryRun: true, itemId, projectId, descendantCount: allIds.length - 1, totalCount: allIds.length })
  }

  const allIds = await persistence.unitOfWork.deleteItemSubtree(
    userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST'), projectId, itemId,
  )

  // Pós-commit: limpeza dos objetos físicos de anexos via outbox (Item 12)
  triggerStorageCleanupAfterCommit()

  void emitDomainEvent({ tenantId: ctx.tenantId, projectId: projectId, type: 'ITEM_DELETED', payload: { itemId } })
  return c.json({ deleted: allIds.length })
})

// POST /projects/:projectId/items/:itemId/tags
itemsRouter.post('/:itemId/tags', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  const parsed = await parseJson(c, itemTagsSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const uniqueTagIds = [...new Set(body.tagIds)]
  try {
    await persistence.planning.setItemTags(userPersistenceContext(ctx), projectId, itemId, uniqueTagIds)
  } catch (error) {
    if (error instanceof Error && error.message === 'ITEM_NOT_FOUND') return c.json({ error: 'Item não encontrado' }, 404)
    if (error instanceof Error && error.message === 'TAG_NOT_IN_PROJECT') return c.json({ error: 'Uma ou mais tags não existem neste projeto' }, 400)
    throw error
  }

  void emitDomainEvent({ tenantId: ctx.tenantId, projectId: projectId, type: 'ITEM_UPDATED', payload: { itemIds: [itemId] } })
  return c.json({ ok: true })
})

// POST /projects/:projectId/items/:itemId/sprint
itemsRouter.post('/:itemId/sprint', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  const parsed = await parseJson(c, itemSprintSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    await persistence.planning.addItemSprint(userPersistenceContext(ctx), projectId, itemId, body.sprintId)
  } catch (error) {
    if (error instanceof Error && error.message === 'ITEM_NOT_FOUND') return c.json({ error: 'Item não encontrado' }, 404)
    if (error instanceof Error && error.message === 'SPRINT_NOT_IN_PROJECT') return c.json({ error: 'Sprint não encontrada neste projeto' }, 400)
    if (error instanceof Error && error.message === 'SPRINT_CLOSED') return c.json({ error: 'Não é possível associar itens a uma sprint fechada' }, 409)
    throw error
  }

  void emitDomainEvent({ tenantId: ctx.tenantId, projectId: projectId, type: 'ITEM_UPDATED', payload: { itemIds: [itemId] } })
  void emitDomainEvent({ tenantId: ctx.tenantId, projectId: projectId, type: 'SPRINT_CHANGED', payload: { itemId, sprintId: body.sprintId } })
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Tarefa 3.1, 3.2, 3.3 — GET filhos diretos de um item
// ---------------------------------------------------------------------------

// GET /projects/:projectId/items/:itemId/children
itemsRouter.get('/:itemId/children', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  // [TENANT] Anti-IDOR: verificar ownership do item pai
  const projectContext = userPersistenceContext(ctx)
  const parent = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!parent) return c.json({ error: 'Item não encontrado' }, 404)

  // [TENANT] filtra filhos diretos por tenantId + parentId
  const [allItems, projectColumns] = await Promise.all([
    persistence.items.listItemsWithRelations(projectContext, projectId),
    persistence.projects.listColumns(projectContext, projectId),
  ])
  const columnById = new Map(projectColumns.map(column => [column.id, { id: column.id, name: column.name }]))
  const children = allItems
    .filter(item => item.parentId === itemId)
    .sort((left, right) => left.position - right.position)
    .map(item => ({
      id: item.id, title: item.title, type: item.type, priority: item.priority, status: item.status, points: item.points,
      assigneeId: item.assigneeId, columnId: item.columnId,
      assignee: item.assignee ? { id: item.assignee.id, name: item.assignee.name, avatarUrl: item.assignee.avatarUrl } : null,
      column: item.columnId ? columnById.get(item.columnId) ?? null : null,
    }))

  return c.json({ data: children, total: children.length })
})

// ---------------------------------------------------------------------------
// Tarefas 4.1, 4.2, 4.3 — Endpoints de logs de atividade
// ---------------------------------------------------------------------------

async function listItemLogs(c: Context<HonoEnv>, type: 'auto' | 'manual') {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  const page = Number.parseInt(c.req.query('page') ?? '1', 10) || 1
  const limit = Number.parseInt(c.req.query('limit') ?? '20', 10) || 20

  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const result = await persistence.workLogs.listItemLogs(projectContext, projectId, itemId, { type, page, limit })
  return c.json({ data: result.data, total: result.total, totalDurationMin: result.totalDurationMin, page, limit })
}

// GET /projects/:projectId/items/:itemId/audit — somente auditoria automática
itemsRouter.get('/:itemId/audit', requireRole('VIEWER'), async (c) => listItemLogs(c, 'auto'))

// GET /projects/:projectId/items/:itemId/work-log — somente diário manual
itemsRouter.get('/:itemId/work-log', requireRole('VIEWER'), async (c) => listItemLogs(c, 'manual'))

// POST /projects/:projectId/items/:itemId/work-log — registrar trabalho manual
itemsRouter.post('/:itemId/work-log', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  const parsed = await parseJson(c, workLogSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  if (!body.activity?.trim()) return c.json({ error: 'Descrição do trabalho é obrigatória' }, 400)

  const durationMin = body.duration == null || body.duration === '' ? null : parseWorkDuration(body.duration)
  if (body.duration != null && body.duration !== '' && durationMin == null) {
    return c.json({ error: 'Duração inválida. Use o formato H:MM, por exemplo 2:00 ou 0:50' }, 400)
  }

  const audit = auditContext(c)
  const mutationContext = userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST')
  mutationContext.mutation.actorType = audit.actorType
  mutationContext.mutation.actorSource = audit.source
  mutationContext.mutation.actorLabel = audit.actorLabel
  let created: ItemLogRecord
  try {
    created = await persistence.workLogs.createItemLog(mutationContext, projectId, itemId, {
      type: 'manual', activity: body.activity.trim(), durationMin,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'ITEM_NOT_FOUND') return c.json({ error: 'Item não encontrado' }, 404)
    throw error
  }
  void emitDomainEvent({ tenantId: ctx.tenantId, projectId: projectId, type: 'ITEM_UPDATED', payload: { itemIds: [itemId] } })
  return c.json({ id: created.id, durationMin: created.durationMin }, 201)
})

// PATCH /projects/:projectId/items/:itemId/work-log/:logId — corrigir trabalho manual
itemsRouter.patch('/:itemId/work-log/:logId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, logId } = c.req.param()
  const memberRole = c.get('memberRole') as string
  const parsed = await parseJson(c, updateWorkLogSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)
  const log = await persistence.workLogs.getItemLog(projectContext, projectId, itemId, logId)
  if (!log || log.type !== 'manual') return c.json({ error: 'Registro de trabalho não encontrado' }, 404)
  if (log.authorId !== ctx.userId && memberRole !== 'ADMIN') return c.json({ error: 'Sem permissão para editar este registro' }, 403)

  const updates: Record<string, unknown> = {}
  if (body.activity !== undefined) {
    if (!body.activity.trim()) return c.json({ error: 'Descrição do trabalho é obrigatória' }, 400)
    updates.activity = body.activity.trim()
  }
  if (body.duration !== undefined) {
    const durationMin = body.duration == null || body.duration === '' ? null : parseWorkDuration(body.duration)
    if (body.duration != null && body.duration !== '' && durationMin == null) return c.json({ error: 'Duração inválida. Use o formato H:MM' }, 400)
    updates.durationMin = durationMin
  }
  await persistence.workLogs.updateItemLog(projectContext, projectId, itemId, logId, updates)
  void emitDomainEvent({ tenantId: ctx.tenantId, projectId: projectId, type: 'ITEM_UPDATED', payload: { itemIds: [itemId] } })
  return c.json({ ok: true })
})

// DELETE /projects/:projectId/items/:itemId/work-log/:logId — excluir trabalho manual
itemsRouter.delete('/:itemId/work-log/:logId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, logId } = c.req.param()
  const memberRole = c.get('memberRole') as string
  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)
  const log = await persistence.workLogs.getItemLog(projectContext, projectId, itemId, logId)
  if (!log || log.type !== 'manual') return c.json({ error: 'Registro de trabalho não encontrado' }, 404)
  if (log.authorId !== ctx.userId && memberRole !== 'ADMIN') return c.json({ error: 'Sem permissão para excluir este registro' }, 403)
  await persistence.workLogs.deleteItemLog(projectContext, projectId, itemId, logId)
  void emitDomainEvent({ tenantId: ctx.tenantId, projectId: projectId, type: 'ITEM_UPDATED', payload: { itemIds: [itemId] } })
  return c.json({ ok: true })
})

// GET legado: mantém leitura compatível, mas exige o filtro explícito para novos usos.
itemsRouter.get('/:itemId/logs', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  const page = Number.parseInt(c.req.query('page') ?? '1', 10) || 1
  const limit = Number.parseInt(c.req.query('limit') ?? '20', 10) || 20

  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const requestedType = c.req.query('type')
  const type = requestedType === 'auto' || requestedType === 'manual' ? requestedType : undefined
  const result = await persistence.workLogs.listItemLogs(projectContext, projectId, itemId, { type, page, limit })

  return c.json({ data: result.data, total: result.total, page, limit })
})

// POST /projects/:projectId/items/:itemId/logs — criar log manual
itemsRouter.post('/:itemId/logs', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  const parsed = await parseJson(c, itemLogSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  if (!body.activity?.trim()) return c.json({ error: 'activity é obrigatório' }, 400)

  const idempotencyKey = c.req.header('Idempotency-Key')
  const commandHash = idempotencyKey ? await payloadHash({ projectId, itemId, activity: body.activity.trim(), durationMin: body.durationMin ?? null }) : null
  const mutationContext = userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST')
  if (idempotencyKey && commandHash) {
    mutationContext.idempotency = {
      namespace: COMMAND_NAMESPACES.createItemLog,
      projectScope: projectId,
      key: idempotencyKey,
      payloadHash: commandHash,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_RETENTION_MS).toISOString(),
    }
  }
  let created: ItemLogRecord
  try {
    created = await persistence.workLogs.createItemLog(mutationContext, projectId, itemId, {
      type: 'manual', activity: body.activity.trim(), durationMin: body.durationMin ?? null,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'ITEM_NOT_FOUND') return c.json({ error: 'Item não encontrado' }, 404)
    if (isIdempotencyConflict(error)) return c.json({ code: 'IDEMPOTENCY_CONFLICT', error: 'A chave já foi usada com outro payload' }, 409)
    if (isIdempotentReplay(error)) {
      const envelope = parseEnvelope(error.record.responseJson)
      const replayBody = envelope?.body as { id: string; durationMin: number | null } | null | undefined
      if (replayBody == null) return c.json({ error: 'Resultado idempotente indisponível.' }, 409)
      const replayOperationId = await findOperationId(ctx.tenantId, ctx.userId, COMMAND_NAMESPACES.createItemLog, idempotencyKey!, projectId)
      if (replayOperationId) c.header('X-Operation-Id', replayOperationId)
      return c.json({ id: replayBody.id }, 201)
    }
    throw error
  }

  void emitDomainEvent({ tenantId: ctx.tenantId, projectId: projectId, type: 'ITEM_UPDATED', payload: { itemIds: [itemId] } })
  if (idempotencyKey) {
    const operationId = await findOperationId(ctx.tenantId, ctx.userId, COMMAND_NAMESPACES.createItemLog, idempotencyKey, projectId)
    if (operationId) c.header('X-Operation-Id', operationId)
  }
  return c.json({ id: created.id }, 201)
})

// PATCH /projects/:projectId/items/:itemId/logs/:logId — editar log manual
itemsRouter.patch('/:itemId/logs/:logId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId, logId } = c.req.param()
  const memberRole = c.get('memberRole') as string
  const parsed = await parseJson(c, updateItemLogSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const projectContext = userPersistenceContext(ctx)
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)
  const log = await persistence.workLogs.getItemLog(projectContext, projectId, itemId, logId)
  if (!log) return c.json({ error: 'Log não encontrado' }, 404)

  if (log.type === 'auto') return c.json({ error: 'Logs automáticos não podem ser editados' }, 403)
  if (log.authorId !== ctx.userId && memberRole !== 'ADMIN') {
    return c.json({ error: 'Sem permissão para editar este log' }, 403)
  }

  const updates: Record<string, unknown> = {}
  if (body.activity !== undefined) updates.activity = body.activity.trim()
  if (body.durationMin !== undefined) updates.durationMin = body.durationMin

  await persistence.workLogs.updateItemLog(projectContext, projectId, itemId, logId, updates)

  void emitDomainEvent({ tenantId: ctx.tenantId, projectId: projectId, type: 'ITEM_UPDATED', payload: { itemIds: [itemId] } })
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Arquivamento e Restauração — status ARCHIVED
// ---------------------------------------------------------------------------

// POST /projects/:projectId/items/:itemId/archive — arquivar item e descendentes em cascata
itemsRouter.post('/:itemId/archive', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  // [TENANT] Anti-IDOR: verificar ownership
  const projectContext = userPersistenceContext(ctx)
  const rootItem = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!rootItem) return c.json({ error: 'Item não encontrado' }, 404)
  if (rootItem.status === 'ARCHIVED') return c.json({ error: 'Item já está arquivado' }, 422)

  const projectItems = await persistence.items.listItems(projectContext, projectId)
  const childrenByParent = new Map<string, string[]>()
  for (const projectItem of projectItems) {
    if (!projectItem.parentId) continue
    const children = childrenByParent.get(projectItem.parentId) ?? []
    children.push(projectItem.id)
    childrenByParent.set(projectItem.parentId, children)
  }
  const allIds: string[] = []
  const queue = [itemId]
  const visited = new Set<string>()
  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)
    allIds.push(currentId)
    queue.push(...(childrenByParent.get(currentId) ?? []))
  }

  const descendantCount = allIds.length - 1
  const parsedBody = await parseOptionalJson(c, confirmationSchema)
  if (!parsedBody.ok) return parsedBody.response
  const { confirm, dryRun } = parsedBody.data
  if (dryRun) return c.json({ dryRun: true, itemId, projectId, descendantCount, totalCount: allIds.length })
  if (descendantCount > 0 && !confirm) {
    return c.json({ warning: true, descendantCount, message: `${descendantCount} item(s) descendente(s) serão arquivados junto` }, 200)
  }

  const audit = auditContext(c)
  const mutationContext = userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST')
  mutationContext.mutation.actorType = audit.actorType
  mutationContext.mutation.actorSource = audit.source
  mutationContext.mutation.actorLabel = audit.actorLabel
  await persistence.unitOfWork.archiveItemSubtree(mutationContext, projectId, itemId)

  void emitDomainEvent({ tenantId: ctx.tenantId, projectId: projectId, type: 'ITEM_UPDATED', payload: { archived: true, itemIds: allIds } })
  return c.json({ ok: true, archivedCount: allIds.length })
})

// POST /projects/:projectId/items/:itemId/unarchive — restaurar item e dependências
itemsRouter.post('/:itemId/unarchive', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  // [TENANT] Anti-IDOR: verificar ownership
  const projectContext = userPersistenceContext(ctx)
  const rootItem = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!rootItem) return c.json({ error: 'Item não encontrado' }, 404)
  if (rootItem.status !== 'ARCHIVED') return c.json({ error: 'Item não está arquivado' }, 422)

  const projectItems = await persistence.items.listItems(projectContext, projectId)
  const childrenByParent = new Map<string, string[]>()
  for (const projectItem of projectItems) {
    if (!projectItem.parentId || projectItem.status !== 'ARCHIVED') continue
    const children = childrenByParent.get(projectItem.parentId) ?? []
    children.push(projectItem.id)
    childrenByParent.set(projectItem.parentId, children)
  }
  const allIds: string[] = [itemId]
  const queue = [itemId]
  const visited = new Set<string>()
  while (queue.length > 0) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    visited.add(currentId)
    if (currentId !== itemId) allIds.push(currentId)
    queue.push(...(childrenByParent.get(currentId) ?? []))
  }

  const audit = auditContext(c)
  const mutationContext = userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST')
  mutationContext.mutation.actorType = audit.actorType
  mutationContext.mutation.actorSource = audit.source
  mutationContext.mutation.actorLabel = audit.actorLabel
  await persistence.unitOfWork.unarchiveItemSubtree(mutationContext, projectId, itemId)

  void emitDomainEvent({ tenantId: ctx.tenantId, projectId: projectId, type: 'ITEM_UPDATED', payload: { unarchived: true, itemIds: allIds } })
  return c.json({ ok: true, restoredCount: allIds.length })
})
