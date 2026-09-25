import { Hono, type Context } from 'hono'
import type { HonoEnv } from '../types/hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import { generateId } from '../utils/id'
import { broadcast } from '../services/websocket'
import { addTreeProgress, type TreeProgressNode } from '../services/treeProgress'
import type { RequestContext } from '@azy-board/api-contracts'
import type { ActivityActorType, ActivitySource, ItemType } from '@azy-board/domain'
import { parseWorkDuration } from '@azy-board/ui-contracts'
import { getIdempotent, saveIdempotent } from '../services/idempotency'
import { claimItem, moveItem, releaseItem } from '../services/itemMutations'
import { triggerStorageCleanupAfterCommit } from '../services/storageCleanup'
import { confirmationSchema, createItemSchema, itemLogSchema, itemSprintSchema, itemTagsSchema, moveItemSchema, parseJson, parseOptionalJson, reorderItemsSchema, updateItemLogSchema, updateItemSchema, updateWorkLogSchema, workLogSchema } from '../validation'
import { persistence } from '../persistence/runtime'
import { userMutationContext, userPersistenceContext } from '../persistence/context'
import type { ItemPatch } from '../persistence/ports'
import type { ItemLogRecord, ItemRecord } from '../persistence/models'

export const itemsRouter = new Hono<HonoEnv>()
itemsRouter.use('*', authMiddleware)

function auditContext(c: Context<HonoEnv>): { actorType: ActivityActorType; source: ActivitySource; actorLabel: string | null } {
  const apiKeyId = c.get('apiKeyId')
  return {
    actorType: apiKeyId ? 'AGENT' : 'HUMAN',
    source: apiKeyId ? 'MCP' : 'REST',
    actorLabel: apiKeyId ? c.get('apiKeyName') : null,
  }
}

function normalizeAuditText(value: unknown): string {
  return String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const SEQUENCE_PREFIX: Record<string, string> = { EPIC: 'E', STORY: 'S', TASK: 'T', BUG: 'B' }
const MAX_ANCESTRY_DEPTH = 50

function systemContext(tenantId: string) {
  return { tenantId, actorUserId: null, actorKind: 'SYSTEM' as const }
}

// Constrói o ancestry_path de um item a partir do pai imediato usando o caminho
// desnormalizado já existente no pai.
async function buildAncestryPath(tenantId: string, projectId: string, parentId: string) {
  const parent = await persistence.items.getItem(systemContext(tenantId), projectId, parentId)
  if (!parent) return []
  let parentPath: Array<{ id: string; title: string; type: string }> = []
  try { parentPath = JSON.parse(parent.ancestryPath || '[]') } catch { parentPath = [] }
  return [...parentPath, { id: parent.id, title: parent.title, type: parent.type }]
}

// Detecta ciclo ANTES da escrita: sobe a cadeia de pais a partir de newParentId.
async function detectReparentCycle(tenantId: string, projectId: string, itemId: string, newParentId: string): Promise<boolean> {
  let currentId: string | null = newParentId
  const visited = new Set<string>()
  for (let depth = 0; currentId && depth < MAX_ANCESTRY_DEPTH; depth++) {
    if (currentId === itemId) return true
    if (visited.has(currentId)) return true
    visited.add(currentId)
    const node = await persistence.items.getItem(systemContext(tenantId), projectId, currentId)
    currentId = node?.parentId ?? null
  }
  return currentId !== null
}

// Gera o próximo sequenceCode disponível para o tipo no projeto
// [TENANT] filtrado por tenantId + projectId
async function nextSequenceCode(tenantId: string, projectId: string, type: string): Promise<string> {
  const prefix = SEQUENCE_PREFIX[type] ?? 'T'
  const rows = await persistence.items.listItems({ tenantId, actorUserId: null, actorKind: 'SYSTEM' }, projectId)
  let max = 0
  for (const row of rows) {
    if (row.sequenceCode && row.sequenceCode.startsWith(prefix)) {
      const num = parseInt(row.sequenceCode.slice(prefix.length), 10)
      if (!Number.isNaN(num) && num > max) max = num
    }
  }
  return `${prefix}${max + 1}`
}

// Verifica se item é folha (sem filhos) — Leaf Rule
async function isLeaf(tenantId: string, projectId: string, itemId: string): Promise<boolean> {
  const projectItems = await persistence.items.listItems({ tenantId, actorUserId: null, actorKind: 'SYSTEM' }, projectId)
  return !projectItems.some(item => item.parentId === itemId)
}

// [TENANT] Valida que todas as tags pertencem ao projeto do tenant. Retorna os
// ids únicos ou null quando alguma tag é inválida (rollback total no chamador).
async function resolveProjectTagIds(tenantId: string, projectId: string, tagIds: string[] | undefined): Promise<string[] | null> {
  const unique = [...new Set(tagIds ?? [])]
  if (unique.length === 0) return []
  const valid = await persistence.planning.listTags({ tenantId, actorUserId: null, actorKind: 'SYSTEM' }, projectId)
  const validIds = new Set(valid.map(tag => tag.id))
  return unique.every(id => validIds.has(id)) ? unique : null
}

// Carrega o item com as relações que o board consome (tags, sprint, responsável),
// garantindo que a resposta e o broadcast reconciliem o cache sem refetch.
async function loadItemWithRelations(tenantId: string, projectId: string, itemId: string) {
  const rows = await persistence.items.listItemsWithRelations({ tenantId, actorUserId: null, actorKind: 'SYSTEM' }, projectId)
  return rows.find(item => item.id === itemId) ?? null
}

// Valida que a hierarquia de tipos é coerente
// EPIC → parentId null; STORY → pai é EPIC; TASK/BUG → pai é STORY, TASK ou BUG
async function validateHierarchy(
  tenantId: string,
  projectId: string,
  type: ItemType,
  parentId: string | null | undefined,
  moduleId: string | null | undefined
): Promise<string | null> {
  if (type === 'EPIC') {
    if (parentId) return 'EPIC não pode ter parentId — EPICs são raiz da hierarquia'
    if (!moduleId) return 'EPIC requer moduleId — use GET /projects/:id/modules para listar os módulos disponíveis'
    return null
  }
  // STORY exige pai EPIC. TASK/BUG sem pai são rejeitadas nas rotas de projeto hierárquico
  // (POST/PATCH têm guards HIERARCHY_REQUIRED próprios); aqui só validamos pais informados.
  if (type === 'STORY' && !parentId) return 'STORY requer parentId apontando para um EPIC — use GET /projects/:id/items?type=EPIC para listar os EPICs'
  if (!parentId) return null

  const parent = await persistence.items.getItem({ tenantId, actorUserId: null, actorKind: 'SYSTEM' }, projectId, parentId)
  if (!parent) return `parentId "${parentId}" não encontrado neste projeto`

  if (type === 'STORY' && parent.type !== 'EPIC') {
    return `STORY deve ser filha de EPIC, mas "${parent.title}" (${parentId}) é ${parent.type}`
  }
  if ((type === 'TASK' || type === 'BUG') && !['STORY', 'TASK', 'BUG'].includes(parent.type)) {
    return (
      `${type} não pode ser filho direto de ${parent.type} ("${parent.title}"). ` +
      `Hierarquia: EPIC → STORY → TASK/BUG. ` +
      `Crie uma STORY filha do EPIC e use o ID da STORY como parentId.`
    )
  }
  return null
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

  broadcast(projectId, { type: 'CARD_UPDATED', projectId, payload: { reordered: true, columnId: body.columnId } })
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
  const treeItems = activeItems.map(item => ({
    ...item,
    assignee: item.assigneeId ? assigneeMap.get(item.assigneeId) ?? null : null,
  }))

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
      const leafItems = !hasChildren && ['TASK', 'BUG'].includes(child.type)

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
  const requestedPage = c.req.query('page')
  const requestedLimit = c.req.query('limit')
  const cursor = c.req.query('cursor')
  const page = Math.max(1, Number.parseInt(requestedPage ?? '1', 10) || 1)
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

  if (leafOnly) {
    const leafItems = withProgress.filter(i => i.isLeaf)
    if (requestedPage || requestedLimit || cursor) {
      const offset = cursor ? cursorOffset : (page - 1) * limit
      const end = offset + limit
      return c.json({ data: leafItems.slice(offset, end), page, limit, total: leafItems.length, hasMore: end < leafItems.length, nextCursor: end < leafItems.length ? Buffer.from(String(end)).toString('base64url') : null })
    }
    return c.json(leafItems)
  }

  if (requestedPage || requestedLimit || cursor) {
    const offset = cursor ? cursorOffset : (page - 1) * limit
    const end = offset + limit
    return c.json({ data: withProgress.slice(offset, end), page, limit, total: withProgress.length, hasMore: end < withProgress.length, nextCursor: end < withProgress.length ? Buffer.from(String(end)).toString('base64url') : null })
  }
  return c.json(withProgress)
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
  if (idempotencyKey) {
    try {
      const cached = await getIdempotent(ctx, 'create_item', idempotencyKey, idempotencyPayload)
      if (cached) return c.json(cached)
    } catch {
      return c.json({ code: 'IDEMPOTENCY_CONFLICT', error: 'A chave já foi usada com outro payload' }, 409)
    }
  }

  const type: ItemType = body.type ?? 'TASK'
  const projectContext = userPersistenceContext(ctx)
  // [TENANT] O projeto e a STORY fixa são buscados no tenant autenticado; o cliente não escolhe outro projeto.
  const project = await persistence.projects.getProject(projectContext, projectId)
  if (!project) return c.json({ error: 'Projeto não encontrado' }, 404)

  const effectiveParentId = project.boardMode === 'SIMPLE' && ['TASK', 'BUG'].includes(type)
    ? project.simpleStoryId
    : (body.parentId ?? null)
  if (project.boardMode === 'SIMPLE' && ['TASK', 'BUG'].includes(type) && !effectiveParentId) {
    return c.json({ error: 'Projeto simples não possui história fixa configurada' }, 409)
  }
  // [HIERARQUIA] Em projetos hierárquicos TASK/BUG sem pai ficam invisíveis no board — proibido.
  if (project.boardMode !== 'SIMPLE' && ['TASK', 'BUG'].includes(type) && !effectiveParentId) {
    return c.json({ error: 'TASK/BUG requerem parentId apontando para uma STORY, TASK ou BUG neste projeto. Use GET /projects/:id/items?type=STORY para listar as histórias disponíveis.', code: 'HIERARCHY_REQUIRED', retryable: false }, 400)
  }

  const validationError = await validateHierarchy(ctx.tenantId, projectId, type, effectiveParentId, project.boardMode === 'SIMPLE' ? null : body.moduleId)
  if (validationError) return c.json({ error: validationError }, 400)

  // [TENANT] Tags precisam pertencer ao projeto; inválidas abortam a criação inteira.
  const tagIds = await resolveProjectTagIds(ctx.tenantId, projectId, body.tagIds)
  if (tagIds === null) return c.json({ error: 'Uma ou mais tags não existem neste projeto' }, 400)

  const [module, column, version, costCenter, assignee] = await Promise.all([
    body.moduleId ? persistence.projects.getModule(projectContext, projectId, body.moduleId) : null,
    body.columnId ? persistence.projects.getColumn(projectContext, projectId, body.columnId) : null,
    body.versionId ? persistence.planning.getVersion(projectContext, projectId, body.versionId) : null,
    body.costCenterId ? persistence.planning.getCostCenter(projectContext, projectId, body.costCenterId) : null,
    body.assigneeId ? persistence.projects.getMembership(projectContext, projectId, body.assigneeId) : null,
  ])
  if (body.moduleId && !module) return c.json({ error: 'Módulo não encontrado neste projeto' }, 400)
  if (body.columnId && !column) return c.json({ error: 'Coluna não encontrada neste projeto' }, 400)
  if (body.versionId && !version) return c.json({ error: 'Versão não encontrada neste projeto' }, 400)
  if (body.costCenterId && !costCenter) return c.json({ error: 'Centro de custo não encontrado neste projeto' }, 400)
  if (body.assigneeId && !assignee) return c.json({ error: 'Responsável não é membro deste projeto' }, 400)

  const sprint = body.sprintId
    ? await persistence.planning.getSprint(projectContext, projectId, body.sprintId)
    : null
  if (body.sprintId && !sprint) return c.json({ error: 'Sprint não encontrada neste projeto' }, 400)
  if (sprint?.status === 'CLOSED') return c.json({ error: 'Não é possível associar itens a uma sprint fechada' }, 409)

  // Para TASK/BUG sem coluna: buscar primeira coluna do projeto
  let columnId = body.columnId ?? null
  if (!columnId && ['TASK', 'BUG'].includes(type)) {
    const projectColumns = await persistence.projects.listColumns(projectContext, projectId)
    columnId = projectColumns[0]?.id ?? null
  }

  const audit = auditContext(c)

  const ancestryPath = effectiveParentId
    ? await buildAncestryPath(ctx.tenantId, projectId, effectiveParentId)
    : []

  // Auto-preenchimento do centro de custo: se o body não informou, buscar o primeiro do projeto
  // [TENANT] filtra cost centers pelo tenantId + projectId para isolamento cross-tenant
  let costCenterId = body.costCenterId ?? null
  if (costCenterId === null) {
    const projectCostCenters = await persistence.planning.listCostCenters(projectContext, projectId)
    costCenterId = projectCostCenters[0]?.id ?? null
  }

  // Gerar sequenceCode automaticamente se não informado
  // [TENANT] nextSequenceCode já filtra por tenantId + projectId
  let sequenceCode = body.sequenceCode ?? null
  if (sequenceCode === null) {
    sequenceCode = await nextSequenceCode(ctx.tenantId, projectId, type)
  } else {
    // Validar unicidade se informado explicitamente
    const projectItems = await persistence.items.listItems(projectContext, projectId)
    if (projectItems.some(candidate => candidate.sequenceCode === sequenceCode)) return c.json({ error: `Código "${sequenceCode}" já existe neste projeto` }, 409)
  }

  // [TENANT] tenantId vem do contexto autenticado; relações, log e analytics
  // entram no mesmo comando síncrono/atômico do adapter SQLite.
  let id: string | null = null
  try {
    const mutationContext = userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST', idempotencyKey)
    mutationContext.mutation.actorType = audit.actorType
    mutationContext.mutation.actorSource = audit.source
    mutationContext.mutation.actorLabel = audit.actorLabel
    const createdRecord = await persistence.unitOfWork.createItemWithRelations(mutationContext, {
      projectId,
      type,
      sequenceCode,
      parentId: effectiveParentId,
      moduleId: project.boardMode === 'SIMPLE' ? null : (body.moduleId ?? null),
      columnId,
      title: body.title,
      description: body.description ?? null,
      persona: body.persona ?? null,
      goal: body.goal ?? null,
      benefit: body.benefit ?? null,
      acceptanceCriteria: body.acceptanceCriteria ?? null,
      notes: body.notes ?? null,
      ancestryPath: JSON.stringify(ancestryPath),
      status: 'NOT_STARTED',
      priority: body.priority ?? 'MEDIUM',
      points: body.points ?? null,
      assigneeId: body.assigneeId ?? null,
      authorId: ctx.userId,
      versionId: body.versionId ?? null,
      costCenterId,
      startDate: body.startDate ?? null,
      dueDate: body.dueDate ?? null,
      position: 0,
    }, {
      tagIds,
      ...(body.sprintId ? { sprintIds: [body.sprintId] } : {}),
      activity: `Card criado: ${normalizeAuditText(body.title)}`,
    })
    id = createdRecord.id
  } catch (error) {
    if (error instanceof Error && error.message.includes('sprint')) return c.json({ error: error.message }, 409)
    throw error
  }

  if (!id) return c.json({ error: 'Item não encontrado após criação' }, 500)
  const created = await loadItemWithRelations(ctx.tenantId, projectId, id)
  if (!created) return c.json({ error: 'Item não encontrado após criação' }, 500)
  const payload = { ...created, isLeaf: true, childrenCount: 0, checklistProgress: null }

  if (effectiveParentId) {
    broadcast(projectId, { type: 'SUBTASK_CREATED', projectId, payload: { parentId: effectiveParentId, item: payload } })
  } else {
    broadcast(projectId, { type: 'ITEM_CREATED', projectId, payload })
  }

  if (idempotencyKey) await saveIdempotent(ctx, 'create_item', idempotencyKey, idempotencyPayload, payload)
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
  const item = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  // Item arquivado não pode ser movido de coluna
  if (item.status === 'ARCHIVED') {
    return c.json({ error: 'Item arquivado não pode ser movido' }, 422)
  }

  // Leaf Rule: TASK, BUG e STORY sem filhos são movíveis — EPIC nunca é movível
  if (!['TASK', 'BUG', 'STORY'].includes(item.type)) {
    return c.json({ error: `Items do tipo ${item.type} não são movíveis no Kanban` }, 422)
  }

  if (!(await isLeaf(ctx.tenantId, projectId, itemId))) {
    return c.json({ error: 'Este item possui tarefas filhas — mova as tarefas individualmente' }, 422)
  }

  const col = await persistence.projects.getColumn(projectContext, projectId, body.columnId)
  if (!col) return c.json({ error: 'Coluna não encontrada' }, 404)

  // Buscar nome da coluna de origem para log — [TENANT] filtro por tenantId
  let fromColName = 'desconhecida'
  if (item.columnId) {
    const fromCol = await persistence.projects.getColumn(projectContext, projectId, item.columnId)
    fromColName = fromCol?.name ?? fromColName
  }

  const audit = auditContext(c)
  await moveItem({ tenantId: ctx.tenantId, projectId, itemId, userId: ctx.userId, apiKeyId: c.get('apiKeyId') as string | undefined, actor: audit, columnId: body.columnId, columnName: col.name, baseStatus: col.baseStatus, fromColumnName: fromColName })

  broadcast(projectId, {
    type: 'CARD_MOVED',
    projectId,
    payload: { itemId, columnId: body.columnId, status: col.baseStatus },
  })

  const updated = await persistence.items.getItem(projectContext, projectId, itemId)
  return c.json({ item: updated, status: col.baseStatus })
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

  broadcast(projectId, { type: 'TASK_CLAIMED', projectId, payload: { itemId, assigneeId: ctx.userId, apiKeyId } })
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

  broadcast(projectId, { type: 'CARD_UPDATED', projectId, payload: { itemId, assigneeId: null } })
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

  // Concorrência otimista: a versão lida pelo cliente é comparada no update.
  const expectedUpdatedAt = body.expectedUpdatedAt
  // [TENANT] Tags precisam pertencer ao projeto; inválidas abortam a edição inteira.
  const tagIds = await resolveProjectTagIds(ctx.tenantId, projectId, body.tagIds)
  if (tagIds === null) return c.json({ error: 'Uma ou mais tags não existem neste projeto' }, 400)

  // Identidade, tenant e relações de autorização são sempre derivados do
  // contexto/rota; nunca aceitamos esses campos do agente.
  const writableFields = new Set([
    'title', 'description', 'priority', 'type', 'status', 'points', 'assigneeId',
    'columnId', 'parentId', 'moduleId', 'startDate', 'dueDate', 'blockedReason',
    'persona', 'goal', 'benefit', 'acceptanceCriteria', 'notes', 'versionId', 'costCenterId', 'sprintId', 'sequenceCode',
  ])
  const safeBody = Object.fromEntries(Object.entries(body).filter(([field]) => writableFields.has(field))) as Omit<typeof body, 'authorId'>
  const updates: Record<string, unknown> = { ...safeBody, updatedAt: new Date().toISOString() }

  const projectContext = userPersistenceContext(ctx)
  // [TENANT] O modo do projeto e a STORY fixa são resolvidos no mesmo tenant do item.
  const project = await persistence.projects.getProject(projectContext, projectId)
  if (!project) return c.json({ error: 'Projeto não encontrado' }, 404)

  // Tarefa 5.1 — buscar estado anterior para gerar log automático
  const LOGGABLE_FIELDS = ['title', 'description', 'priority', 'assigneeId', 'points', 'startDate', 'dueDate', 'status'] as const
  type LoggableField = typeof LOGGABLE_FIELDS[number]
  const prevItem = await persistence.items.getItem(projectContext, projectId, itemId)
  if (!prevItem) return c.json({ error: 'Item não encontrado' }, 404)

  // Validar unicidade do sequenceCode se mudou
  // [TENANT] filtrado por tenantId + projectId
  if (updates.sequenceCode !== undefined && updates.sequenceCode !== null && updates.sequenceCode !== prevItem.sequenceCode) {
    const projectItems = await persistence.items.listItems(projectContext, projectId)
    if (projectItems.some(candidate => candidate.id !== itemId && candidate.sequenceCode === updates.sequenceCode)) return c.json({ error: `Código "${updates.sequenceCode}" já existe neste projeto` }, 409)
  }

  if (project.boardMode === 'SIMPLE' && prevItem && ['TASK', 'BUG'].includes(prevItem.type)) {
    if (!project.simpleStoryId) return c.json({ error: 'Projeto simples não possui história fixa configurada' }, 409)
    updates.parentId = project.simpleStoryId
    updates.moduleId = null
  }

  if (safeBody.parentId !== undefined || safeBody.moduleId !== undefined || safeBody.columnId !== undefined || safeBody.versionId !== undefined || safeBody.costCenterId !== undefined || safeBody.assigneeId !== undefined || safeBody.type !== undefined) {
    const nextType = (safeBody.type as ItemType | undefined) ?? prevItem?.type
    if (nextType && (safeBody.parentId !== undefined || safeBody.type !== undefined)) {
      const effectiveParentId = updates.parentId !== undefined ? updates.parentId as string | null : prevItem?.parentId ?? null
      const effectiveModuleId = updates.moduleId !== undefined ? updates.moduleId as string | null : prevItem?.moduleId ?? null
      const hierarchyError = await validateHierarchy(ctx.tenantId, projectId, nextType, effectiveParentId, project.boardMode === 'SIMPLE' ? null : effectiveModuleId)
      if (hierarchyError) return c.json({ error: hierarchyError }, 400)
    }
    const [parent, module, column, version, costCenter, assignee] = await Promise.all([
      updates.parentId ? persistence.items.getItem(projectContext, projectId, updates.parentId as string) : null,
      updates.moduleId ? persistence.projects.getModule(projectContext, projectId, updates.moduleId as string) : null,
      safeBody.columnId ? persistence.projects.getColumn(projectContext, projectId, safeBody.columnId as string) : null,
      safeBody.versionId ? persistence.planning.getVersion(projectContext, projectId, safeBody.versionId as string) : null,
      safeBody.costCenterId ? persistence.planning.getCostCenter(projectContext, projectId, safeBody.costCenterId as string) : null,
      safeBody.assigneeId ? persistence.projects.getMembership(projectContext, projectId, safeBody.assigneeId as string) : null,
    ])
    if (updates.parentId && !parent) return c.json({ error: 'Item pai não encontrado neste projeto' }, 400)
    if (updates.moduleId && !module) return c.json({ error: 'Módulo não encontrado neste projeto' }, 400)
    if (safeBody.columnId && !column) return c.json({ error: 'Coluna não encontrada neste projeto' }, 400)
    if (safeBody.versionId && !version) return c.json({ error: 'Versão não encontrada neste projeto' }, 400)
    if (safeBody.costCenterId && !costCenter) return c.json({ error: 'Centro de custo não encontrado neste projeto' }, 400)
    if (safeBody.assigneeId && !assignee) return c.json({ error: 'Responsável não é membro deste projeto' }, 400)
  }

  // [HIERARQUIA] Bloqueia requisições que deixariam TASK/BUG órfã em projeto hierárquico
  // (desvincular pai ou mudar tipo para TASK/BUG sem pai). Edições em itens legacy já órfãos continuam permitidas.
  {
    const finalType = (safeBody.type as ItemType | undefined) ?? prevItem.type
    const finalParentId = safeBody.parentId !== undefined ? (updates.parentId as string | null | undefined) : prevItem.parentId
    const introducesOrphan = ['TASK', 'BUG'].includes(finalType) && !finalParentId &&
      (safeBody.parentId !== undefined || (safeBody.type !== undefined && safeBody.type !== prevItem.type))
    if (project.boardMode !== 'SIMPLE' && introducesOrphan) {
      return c.json({ error: 'TASK/BUG não podem ficar sem pai em projeto hierárquico — vincule a uma STORY, TASK ou BUG.', code: 'HIERARCHY_REQUIRED', retryable: false }, 400)
    }
  }

  if (safeBody.sprintId !== undefined) {
    const sprint = safeBody.sprintId
      ? await persistence.planning.getSprint(projectContext, projectId, safeBody.sprintId as string)
      : null
    if (safeBody.sprintId && !sprint) return c.json({ error: 'Sprint não encontrada neste projeto' }, 400)
    if (sprint?.status === 'CLOSED') return c.json({ error: 'Não é possível associar itens a uma sprint fechada' }, 409)
  }

  // [HIERARQUIA] Reparenting: valida ciclo/profundidade ANTES de qualquer escrita
  // e recalcula ancestryPath do item e dos descendentes DENTRO da transação.
  const reparenting = safeBody.parentId !== undefined || (project.boardMode === 'SIMPLE' && prevItem && ['TASK', 'BUG'].includes(prevItem.type))
  const requestedParent = updates.parentId as string | null | undefined
  if (reparenting) {
    const newParentId = requestedParent ?? safeBody.parentId
    if (newParentId && newParentId !== prevItem.parentId) {
      if (newParentId === itemId) {
        return c.json({ error: 'Item não pode ser pai de si mesmo', code: 'HIERARCHY_CYCLE', retryable: false }, 400)
      }
      if (await detectReparentCycle(ctx.tenantId, projectId, itemId, newParentId)) {
        return c.json({ error: 'Reparenting recusado: o novo pai é descendente deste item, o que criaria um ciclo na hierarquia.', code: 'HIERARCHY_CYCLE', retryable: false }, 400)
      }
    }
  }
  const fieldLabels: Record<LoggableField, string> = {
    title: 'Título', description: 'Descrição', priority: 'Prioridade',
    assigneeId: 'Responsável', points: 'Pontos', startDate: 'Início', dueDate: 'Fim', status: 'Status',
  }
  const changes: string[] = []
  for (const field of LOGGABLE_FIELDS) {
    if (field in safeBody && String(safeBody[field]) !== String(prevItem[field])) {
      changes.push(`${fieldLabels[field]}: "${prevItem[field] ?? ''}" → "${safeBody[field] ?? ''}"`)
    }
  }
  const activity = changes.length > 0
    ? `Campos alterados: ${changes.map(change => normalizeAuditText(change)).join('; ')}`
    : undefined
  const itemPatch = { ...updates } as ItemPatch & { sprintId?: string | null; updatedAt?: string }
  delete itemPatch.sprintId
  delete itemPatch.updatedAt
  const mutationContext = userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST')
  const audit = auditContext(c)
  mutationContext.mutation.actorType = audit.actorType
  mutationContext.mutation.actorSource = audit.source
  mutationContext.mutation.actorLabel = audit.actorLabel

  let updatedRecord: ItemRecord | null = null
  try {
    updatedRecord = await persistence.unitOfWork.updateItemWithRelations(mutationContext, projectId, itemId, itemPatch, {
      ...(body.tagIds !== undefined ? { tagIds } : {}),
      ...(safeBody.sprintId !== undefined ? { sprintIds: safeBody.sprintId ? [safeBody.sprintId as string] : [] } : {}),
      ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
      ...(activity ? { activity } : {}),
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('PERSISTENCE_CONFLICT')) {
      return c.json({ error: 'O item foi alterado por outra pessoa desde que você o abriu. Recarregue e tente novamente.', code: 'CONFLICT', retryable: false }, 409)
    }
    throw error
  }
  if (!updatedRecord) return c.json({ error: 'Item não encontrado' }, 404)

  const updated = await loadItemWithRelations(ctx.tenantId, projectId, itemId)
  broadcast(projectId, {
    type: 'ITEM_UPDATED',
    projectId,
    payload: { itemId, ...safeBody, updatedAt: updatedRecord.updatedAt, ...(tagIds !== undefined ? { itemTags: updated?.itemTags ?? [] } : {}) },
  })
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

  // A lista vem isolada pelo port; a contagem é calculada em memória para o dry-run.
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

  if (requestBody.dryRun) {
    return c.json({ dryRun: true, itemId, projectId, descendantCount: allIds.length - 1, totalCount: allIds.length })
  }

  await persistence.unitOfWork.deleteItemSubtree(
    userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST'), projectId, itemId,
  )

  // Pós-commit: limpeza dos objetos físicos de anexos via outbox (Item 12)
  triggerStorageCleanupAfterCommit()

  broadcast(projectId, { type: 'ITEM_DELETED', projectId, payload: { itemId } })
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

  const mutationContext = userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST')
  let created: ItemLogRecord
  try {
    created = await persistence.workLogs.createItemLog(mutationContext, projectId, itemId, {
      type: 'manual', activity: body.activity.trim(), durationMin: body.durationMin ?? null,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'ITEM_NOT_FOUND') return c.json({ error: 'Item não encontrado' }, 404)
    throw error
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

  broadcast(projectId, { type: 'ITEM_UPDATED', projectId, payload: { archived: true, ids: allIds } })
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

  broadcast(projectId, { type: 'ITEM_UPDATED', projectId, payload: { unarchived: true, ids: allIds } })
  return c.json({ ok: true, restoredCount: allIds.length })
})
