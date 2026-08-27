import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { eq, and, inArray, asc, desc, sql } from 'drizzle-orm'
import { db } from '../db/index'
import { projects, items, columns, itemTags, itemSprints, modules, checklists, checklistItems, attachments, itemLogs, projectVersions, projectCostCenters, tags, sprints, memberships, users } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import { generateId } from '../utils/id'
import { buildAncestryPath, calculateProgress, calculatePoints, updateDescendantAncestry } from '../services/ancestry'
import { broadcast } from '../services/websocket'
import { addTreeProgress, type TreeProgressNode } from '../services/treeProgress'
import type { RequestContext, Priority, ItemType } from '@azy-board/types'
import { getIdempotent, saveIdempotent } from '../services/idempotency'

export const itemsRouter = new Hono<HonoEnv>()
itemsRouter.use('*', authMiddleware)

// Tarefa 4.4 — cria log automático de atividade em operações do sistema
// [TENANT] tenantId obrigatório para isolamento cross-tenant
async function createAutoLog(itemId: string, tenantId: string, authorId: string, activity: string) {
  const now = new Date().toISOString()
  await db.insert(itemLogs).values({
    id: generateId(),
    tenantId,
    itemId,
    authorId,
    type: 'auto',
    activity,
    durationMin: null,
    createdAt: now,
    updatedAt: now,
  })
}

// Verifica se item é folha (sem filhos) — Leaf Rule
async function isLeaf(tenantId: string, projectId: string, itemId: string): Promise<boolean> {
  const children = await db.query.items.findMany({
    where: (i) => and(eq(i.parentId, itemId), eq(i.projectId, projectId), eq(i.tenantId, tenantId)),
    columns: { id: true },
  })
  return children.length === 0
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
  // STORY exige pai EPIC; TASK/BUG podem ser órfãos (sem parentId = card direto no projeto)
  if (type === 'STORY' && !parentId) return 'STORY requer parentId apontando para um EPIC — use GET /projects/:id/items?type=EPIC para listar os EPICs'
  if (!parentId) return null  // TASK/BUG sem pai = item órfão — permitido

  const parent = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, parentId), eq(i.projectId, projectId), eq(i.tenantId, tenantId)),
    columns: { id: true, type: true, title: true },
  })
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
  const body = await c.req.json<{ columnId: string; order: string[] }>()

  const targetColumn = await db.query.columns.findFirst({
    where: (column) => and(eq(column.id, body.columnId), eq(column.projectId, projectId), eq(column.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!targetColumn) return c.json({ error: 'Coluna não encontrada neste projeto' }, 404)
  const uniqueOrder = [...new Set(body.order)]
  const orderedItems = uniqueOrder.length > 0
    ? await db.select({ id: items.id }).from(items).where(and(inArray(items.id, uniqueOrder), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId), eq(items.columnId, body.columnId)))
    : []
  if (orderedItems.length !== uniqueOrder.length) return c.json({ error: 'A ordem contém cards que não pertencem à coluna' }, 400)

  // [DB-SWAP] usar transaction do PostgreSQL em produção
  await db.transaction(async (tx) => {
    for (let i = 0; i < body.order.length; i++) {
      const itemId = body.order[i]!
      await tx.update(items)
        .set({ position: i })
        // [TENANT] Anti-IDOR: filtra por tenantId + itemId + columnId
        .where(and(eq(items.id, itemId), eq(items.tenantId, ctx.tenantId), eq(items.columnId, body.columnId)))
    }
  })

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
  const [allModules, allItems] = await Promise.all([
    db.select().from(modules)
      .where(and(eq(modules.projectId, projectId), eq(modules.tenantId, ctx.tenantId)))
      .orderBy(asc(modules.position)),
    db.select().from(items)
      .where(and(eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId), sql`${items.status} != 'ARCHIVED'`))
      .orderBy(asc(items.position)),
  ])

  const assigneeIds = [...new Set(allItems.map(item => item.assigneeId).filter((id): id is string => id !== null))]
  const assignees = assigneeIds.length > 0
    ? await db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      // [TENANT] Responsáveis são resolvidos somente dentro do tenant atual.
      .where(and(inArray(users.id, assigneeIds), eq(users.tenantId, ctx.tenantId)))
    : []
  const assigneeMap = new Map(assignees.map(assignee => [assignee.id, assignee]))
  const treeItems = allItems.map(item => ({
    ...item,
    assignee: item.assigneeId ? assigneeMap.get(item.assigneeId) ?? null : null,
  }))

  // [TENANT] O modo e a STORY fixa são resolvidos dentro do projeto do tenant atual.
  const project = await db.query.projects.findFirst({
    where: (p) => and(eq(p.id, projectId), eq(p.tenantId, ctx.tenantId)),
    columns: { boardMode: true, simpleStoryId: true },
  })

  let sprintItemIds: Set<string> | null = null
  if (filterSprintId) {
    const rows = await db.select({ itemId: itemSprints.itemId })
      .from(itemSprints)
      .where(eq(itemSprints.sprintId, filterSprintId))
    sprintItemIds = new Set(rows.map(r => r.itemId))
  }

  let tagItemIds: Set<string> | null = null
  if (filterTagIds.length > 0) {
    const rows = await db.select({ itemId: itemTags.itemId })
      .from(itemTags)
      .where(inArray(itemTags.tagId, filterTagIds))
    tagItemIds = new Set(rows.map(r => r.itemId))
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
  let allItems = await db.query.items.findMany({
    where: (i) => and(eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
    with: {
      itemTags: { with: { tag: true } },
      itemSprints: { columns: { sprintId: true } },
      assignee: { columns: { id: true, name: true, avatarUrl: true } },
      assigneeApiKey: { columns: { id: true, name: true, aiModelName: true } },
      author: { columns: { id: true, name: true, avatarUrl: true } },
      version: { columns: { id: true, name: true, status: true } },
    },
    orderBy: (i, { asc }) => [asc(i.position)],
  })

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
    const sprint = await db.query.sprints.findFirst({
      where: (s) => and(eq(s.id, sprintIdFilter), eq(s.projectId, projectId), eq(s.tenantId, ctx.tenantId)),
      columns: { id: true },
    })
    const sprintItemIds = sprint
      ? (await db.select({ itemId: itemSprints.itemId }).from(itemSprints).where(eq(itemSprints.sprintId, sprint.id))).map(r => r.itemId)
      : []
    allItems = allItems.filter(i => sprintItemIds.includes(i.id))
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

  // Progresso de checklists por item — subquery agregada (sem N+1)
  // [DB-SWAP] GROUP BY funciona igual em SQLite e PostgreSQL
  const itemIds = allItems.map(i => i.id)
  const progressRows = itemIds.length > 0
    ? await db.select({
        itemId: checklists.itemId,
        total: sql<number>`COUNT(${checklistItems.id})`,
        checked: sql<number>`SUM(CASE WHEN ${checklistItems.checked} = 1 THEN 1 ELSE 0 END)`,
      })
      .from(checklists)
      .leftJoin(checklistItems, eq(checklistItems.checklistId, checklists.id))
      .where(and(inArray(checklists.itemId, itemIds), eq(checklists.tenantId, ctx.tenantId)))
      .groupBy(checklists.itemId)
    : []

  const progressMap = new Map(progressRows.map(r => [r.itemId, { checked: r.checked, total: r.total }]))

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

  // [TENANT] Filtra por tenantId + projectId — anti-IDOR
  const archived = await db
    .select({
      id: items.id,
      type: items.type,
      title: items.title,
      ancestryPath: items.ancestryPath,
      statusBeforeArchive: items.statusBeforeArchive,
      columnId: items.columnId,
      updatedAt: items.updatedAt,
    })
    .from(items)
    .where(and(
      eq(items.projectId, projectId),
      eq(items.tenantId, ctx.tenantId),
      sql`${items.status} = 'ARCHIVED'`
    ))
    .orderBy(desc(items.updatedAt))

  // Incluir nome da coluna original (via statusBeforeArchive mapeado para nome de coluna)
  const allColumns = await db.select({ id: columns.id, name: columns.name })
    .from(columns)
    .where(and(eq(columns.projectId, projectId), eq(columns.tenantId, ctx.tenantId)))
  const colMap = new Map(allColumns.map(c => [c.id, c.name]))

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
  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
    with: {
      itemTags: { with: { tag: true } },
      itemSprints: { with: { sprint: true } },
      attachments: true,
      assignee: { columns: { id: true, name: true, avatarUrl: true } },
      assigneeApiKey: { columns: { id: true, name: true, aiModelName: true } },
      author: { columns: { id: true, name: true, avatarUrl: true } },
      version: { columns: { id: true, name: true, status: true } },
      children: { columns: { id: true, title: true, type: true, status: true, priority: true, points: true } },
      checklists: {
        with: { checklistItems: { orderBy: (ci) => [asc(ci.position)] } },
        orderBy: (cl) => [asc(cl.position)],
      },
    },
  })

  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const leaf = item.children.length === 0
  const mappedChecklists = item.checklists.map(cl => ({
    id: cl.id,
    name: cl.name,
    position: cl.position,
    items: cl.checklistItems.map(ci => ({
      id: ci.id,
      text: ci.text,
      checked: Boolean(ci.checked),
      position: ci.position,
    })),
  }))

  return c.json({ ...item, isLeaf: leaf, childrenCount: item.children.length, checklists: mappedChecklists })
})

// POST /projects/:projectId/items
itemsRouter.post('/', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const body = await c.req.json<{
    title: string
    type?: ItemType
    parentId?: string | null
    moduleId?: string | null
    columnId?: string | null
    priority?: Priority
    points?: number
    description?: string
    persona?: string
    goal?: string
    benefit?: string
    acceptanceCriteria?: string
    notes?: string
    assigneeId?: string | null
    startDate?: string | null
    dueDate?: string | null
    versionId?: string | null
    costCenterId?: string | null
    sprintId?: string | null
  }>()
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
  // [TENANT] O projeto e a STORY fixa são buscados no tenant autenticado; o cliente não escolhe outro projeto.
  const project = await db.query.projects.findFirst({
    where: (p) => and(eq(p.id, projectId), eq(p.tenantId, ctx.tenantId)),
    columns: { boardMode: true, simpleStoryId: true },
  })
  if (!project) return c.json({ error: 'Projeto não encontrado' }, 404)

  const effectiveParentId = project.boardMode === 'SIMPLE' && ['TASK', 'BUG'].includes(type)
    ? project.simpleStoryId
    : (body.parentId ?? null)
  if (project.boardMode === 'SIMPLE' && ['TASK', 'BUG'].includes(type) && !effectiveParentId) {
    return c.json({ error: 'Projeto simples não possui história fixa configurada' }, 409)
  }

  const validationError = await validateHierarchy(ctx.tenantId, projectId, type, effectiveParentId, project.boardMode === 'SIMPLE' ? null : body.moduleId)
  if (validationError) return c.json({ error: validationError }, 400)

  const [module, column, version, costCenter, assignee] = await Promise.all([
    body.moduleId
      ? db.query.modules.findFirst({ where: (m) => and(eq(m.id, body.moduleId!), eq(m.projectId, projectId), eq(m.tenantId, ctx.tenantId)), columns: { id: true } })
      : null,
    body.columnId
      ? db.query.columns.findFirst({ where: (col) => and(eq(col.id, body.columnId!), eq(col.projectId, projectId), eq(col.tenantId, ctx.tenantId)), columns: { id: true } })
      : null,
    body.versionId
      ? db.query.projectVersions.findFirst({ where: (v) => and(eq(v.id, body.versionId!), eq(v.projectId, projectId), eq(v.tenantId, ctx.tenantId)), columns: { id: true } })
      : null,
    body.costCenterId
      ? db.query.projectCostCenters.findFirst({ where: (cc) => and(eq(cc.id, body.costCenterId!), eq(cc.projectId, projectId), eq(cc.tenantId, ctx.tenantId)), columns: { id: true } })
      : null,
    body.assigneeId
      ? db.query.memberships.findFirst({ where: (m) => and(eq(m.userId, body.assigneeId!), eq(m.projectId, projectId), eq(m.tenantId, ctx.tenantId)), columns: { userId: true } })
      : null,
  ])
  if (body.moduleId && !module) return c.json({ error: 'Módulo não encontrado neste projeto' }, 400)
  if (body.columnId && !column) return c.json({ error: 'Coluna não encontrada neste projeto' }, 400)
  if (body.versionId && !version) return c.json({ error: 'Versão não encontrada neste projeto' }, 400)
  if (body.costCenterId && !costCenter) return c.json({ error: 'Centro de custo não encontrado neste projeto' }, 400)
  if (body.assigneeId && !assignee) return c.json({ error: 'Responsável não é membro deste projeto' }, 400)

  const sprint = body.sprintId
    ? await db.query.sprints.findFirst({ where: (s) => and(eq(s.id, body.sprintId!), eq(s.projectId, projectId), eq(s.tenantId, ctx.tenantId)) })
    : null
  if (body.sprintId && !sprint) return c.json({ error: 'Sprint não encontrada neste projeto' }, 400)
  if (sprint?.status === 'CLOSED') return c.json({ error: 'Não é possível associar itens a uma sprint fechada' }, 409)

  // Para TASK/BUG sem coluna: buscar primeira coluna do projeto
  let columnId = body.columnId ?? null
  if (!columnId && ['TASK', 'BUG'].includes(type)) {
    const firstCol = await db.query.columns.findFirst({
      where: (col) => and(eq(col.projectId, projectId), eq(col.tenantId, ctx.tenantId)),
      orderBy: (col, { asc }) => [asc(col.position)],
    })
    columnId = firstCol?.id ?? null
  }

  const id = generateId()
  const now = new Date().toISOString()

  const ancestryPath = effectiveParentId
    ? await buildAncestryPath(ctx.tenantId, effectiveParentId)
    : []

  // Auto-preenchimento do centro de custo: se o body não informou, buscar o primeiro do projeto
  // [TENANT] filtra cost centers pelo tenantId + projectId para isolamento cross-tenant
  let costCenterId = body.costCenterId ?? null
  if (costCenterId === null) {
    const firstCostCenter = await db.query.projectCostCenters.findFirst({
      where: (cc) => and(eq(cc.projectId, projectId), eq(cc.tenantId, ctx.tenantId)),
      orderBy: (cc, { asc }) => [asc(cc.sortOrder)],
      columns: { id: true },
    })
    costCenterId = firstCostCenter?.id ?? null
  }

  // [TENANT] tenantId vem do JWT — nunca do body
  // authorId capturado do contexto de autenticação (humano ou agente de IA)
  try {
    await db.transaction(async (tx) => {
      if (body.sprintId) {
        const currentSprint = await tx.query.sprints.findFirst({ where: (s) => and(eq(s.id, body.sprintId!), eq(s.projectId, projectId), eq(s.tenantId, ctx.tenantId)) })
        if (!currentSprint) throw new Error('Sprint não encontrada neste projeto')
        if (currentSprint.status === 'CLOSED') throw new Error('Não é possível associar itens a uma sprint fechada')
      }
      await tx.insert(items).values({
    id,
    tenantId: ctx.tenantId,
    projectId,
    type,
    parentId: effectiveParentId,
    moduleId: project.boardMode === 'SIMPLE' ? null : (body.moduleId ?? null),
    columnId,
    title: body.title,
    description: body.description,
    persona: body.persona,
    goal: body.goal,
    benefit: body.benefit,
    acceptanceCriteria: body.acceptanceCriteria,
    notes: body.notes,
    ancestryPath: JSON.stringify(ancestryPath),
    status: 'NOT_STARTED',
    priority: body.priority ?? 'MEDIUM',
    points: body.points,
    assigneeId: body.assigneeId ?? null,
    authorId: ctx.userId,
    versionId: body.versionId ?? null,
    costCenterId,
    startDate: body.startDate ?? null,
    dueDate: body.dueDate ?? null,
    position: 0,
    createdAt: now,
    updatedAt: now,
      })
      if (body.sprintId) await tx.insert(itemSprints).values({ itemId: id, sprintId: body.sprintId })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('sprint')) return c.json({ error: error.message }, 409)
    throw error
  }

  const payload = { id, title: body.title, type, projectId, columnId, status: 'NOT_STARTED', versionId: body.versionId ?? null, sprintId: body.sprintId ?? null }

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
  const body = await c.req.json<{ columnId: string }>()

  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
    columns: { id: true, type: true, columnId: true, status: true },
  })
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

  const col = await db.query.columns.findFirst({
    where: (col) => and(eq(col.id, body.columnId), eq(col.projectId, projectId), eq(col.tenantId, ctx.tenantId)),
  })
  if (!col) return c.json({ error: 'Coluna não encontrada' }, 404)

  // Buscar nome da coluna de origem para log — [TENANT] filtro por tenantId
  let fromColName = 'desconhecida'
  if (item.columnId) {
    const fromCol = await db.query.columns.findFirst({
      where: (c) => and(eq(c.id, item.columnId!), eq(c.projectId, projectId), eq(c.tenantId, ctx.tenantId)),
      columns: { name: true },
    })
    fromColName = fromCol?.name ?? fromColName
  }

  await db.update(items)
    .set({ columnId: body.columnId, status: col.baseStatus, updatedAt: new Date().toISOString() })
    .where(and(eq(items.id, itemId), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))

  // Tarefa 5.2 — log automático de movimentação de coluna
  await createAutoLog(itemId, ctx.tenantId, ctx.userId, `Movido de '${fromColName}' para '${col.name}'`)

  broadcast(projectId, {
    type: 'CARD_MOVED',
    projectId,
    payload: { itemId, columnId: body.columnId, status: col.baseStatus },
  })

  const updated = await db.query.items.findFirst({ where: (i) => and(eq(i.id, itemId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)) })
  return c.json({ item: updated, status: col.baseStatus })
})

// PATCH /projects/:projectId/items/:itemId/claim
itemsRouter.patch('/:itemId/claim', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
  })
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)
  if (item.assigneeId) return c.json({ error: 'Item já está sendo trabalhado por outro usuário' }, 409)

  const apiKeyId = c.get('apiKeyId') as string | undefined

  await db.update(items)
    .set({ assigneeId: ctx.userId, assigneeApiKeyId: apiKeyId ?? null, status: 'IN_PROGRESS', updatedAt: new Date().toISOString() })
    .where(and(eq(items.id, itemId), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))

  broadcast(projectId, { type: 'TASK_CLAIMED', projectId, payload: { itemId, assigneeId: ctx.userId, apiKeyId } })
  const updated = await db.query.items.findFirst({ where: (i) => and(eq(i.id, itemId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)) })
  return c.json({ item: updated })
})

// PATCH /projects/:projectId/items/:itemId/release
itemsRouter.patch('/:itemId/release', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  const item = await db.query.items.findFirst({
    where: (candidate) => and(eq(candidate.id, itemId), eq(candidate.projectId, projectId), eq(candidate.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  await db.update(items)
    .set({ assigneeId: null, assigneeApiKeyId: null, status: 'NOT_STARTED', updatedAt: new Date().toISOString() })
    .where(and(eq(items.id, itemId), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))

  broadcast(projectId, { type: 'CARD_UPDATED', projectId, payload: { itemId, assigneeId: null } })
  const updated = await db.query.items.findFirst({ where: (i) => and(eq(i.id, itemId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)) })
  return c.json({ item: updated })
})

// PATCH /projects/:projectId/items/:itemId — editar campos
itemsRouter.patch('/:itemId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  const body = await c.req.json<{
    title?: string
    description?: string
    priority?: Priority
    type?: 'TASK' | 'BUG'
    status?: string
    points?: number | null
    assigneeId?: string | null
    columnId?: string | null
    parentId?: string | null
    moduleId?: string | null
    startDate?: string | null
    dueDate?: string | null
    blockedReason?: string | null
    persona?: string | null
    goal?: string | null
    benefit?: string | null
    acceptanceCriteria?: string | null
    notes?: string | null
     authorId?: unknown
     versionId?: string | null
    costCenterId?: string | null
    sprintId?: string | null
   }>()

  // Identidade, tenant e relações de autorização são sempre derivados do
  // contexto/rota; nunca aceitamos esses campos do agente.
  const writableFields = new Set([
    'title', 'description', 'priority', 'type', 'status', 'points', 'assigneeId',
    'columnId', 'parentId', 'moduleId', 'startDate', 'dueDate', 'blockedReason',
    'persona', 'goal', 'benefit', 'acceptanceCriteria', 'notes', 'versionId', 'costCenterId', 'sprintId',
  ])
  const safeBody = Object.fromEntries(Object.entries(body).filter(([field]) => writableFields.has(field))) as Omit<typeof body, 'authorId'>
  const updates: Record<string, unknown> = { ...safeBody, updatedAt: new Date().toISOString() }

  // [TENANT] O modo do projeto e a STORY fixa são resolvidos no mesmo tenant do item.
  const project = await db.query.projects.findFirst({
    where: (p) => and(eq(p.id, projectId), eq(p.tenantId, ctx.tenantId)),
    columns: { boardMode: true, simpleStoryId: true },
  })
  if (!project) return c.json({ error: 'Projeto não encontrado' }, 404)

  // Tarefa 5.1 — buscar estado anterior para gerar log automático
  const LOGGABLE_FIELDS = ['title', 'description', 'priority', 'assigneeId', 'points', 'startDate', 'dueDate', 'status'] as const
  type LoggableField = typeof LOGGABLE_FIELDS[number]
  const prevItem = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
    columns: { title: true, description: true, priority: true, assigneeId: true, points: true, startDate: true, dueDate: true, status: true, type: true },
  })
  if (!prevItem) return c.json({ error: 'Item não encontrado' }, 404)

  if (project.boardMode === 'SIMPLE' && prevItem && ['TASK', 'BUG'].includes(prevItem.type)) {
    if (!project.simpleStoryId) return c.json({ error: 'Projeto simples não possui história fixa configurada' }, 409)
    updates.parentId = project.simpleStoryId
    updates.moduleId = null
  }

  if (safeBody.parentId !== undefined || safeBody.moduleId !== undefined || safeBody.columnId !== undefined || safeBody.versionId !== undefined || safeBody.costCenterId !== undefined || safeBody.assigneeId !== undefined) {
    const nextType = (safeBody.type as ItemType | undefined) ?? prevItem?.type
    if (nextType && safeBody.parentId !== undefined) {
      const hierarchyError = await validateHierarchy(ctx.tenantId, projectId, nextType, updates.parentId as string | null | undefined, updates.moduleId as string | null | undefined)
      if (hierarchyError) return c.json({ error: hierarchyError }, 400)
    }
    const [parent, module, column, version, costCenter, assignee] = await Promise.all([
      updates.parentId
        ? db.query.items.findFirst({ where: (item) => and(eq(item.id, updates.parentId as string), eq(item.projectId, projectId), eq(item.tenantId, ctx.tenantId)), columns: { id: true } })
        : null,
      updates.moduleId
        ? db.query.modules.findFirst({ where: (module) => and(eq(module.id, updates.moduleId as string), eq(module.projectId, projectId), eq(module.tenantId, ctx.tenantId)), columns: { id: true } })
        : null,
      safeBody.columnId
        ? db.query.columns.findFirst({ where: (column) => and(eq(column.id, safeBody.columnId as string), eq(column.projectId, projectId), eq(column.tenantId, ctx.tenantId)), columns: { id: true } })
        : null,
      safeBody.versionId
        ? db.query.projectVersions.findFirst({ where: (version) => and(eq(version.id, safeBody.versionId as string), eq(version.projectId, projectId), eq(version.tenantId, ctx.tenantId)), columns: { id: true } })
        : null,
      safeBody.costCenterId
        ? db.query.projectCostCenters.findFirst({ where: (cc) => and(eq(cc.id, safeBody.costCenterId as string), eq(cc.projectId, projectId), eq(cc.tenantId, ctx.tenantId)), columns: { id: true } })
        : null,
      safeBody.assigneeId
        ? db.query.memberships.findFirst({ where: (membership) => and(eq(membership.userId, safeBody.assigneeId as string), eq(membership.projectId, projectId), eq(membership.tenantId, ctx.tenantId)), columns: { userId: true } })
        : null,
    ])
    if (updates.parentId && !parent) return c.json({ error: 'Item pai não encontrado neste projeto' }, 400)
    if (updates.moduleId && !module) return c.json({ error: 'Módulo não encontrado neste projeto' }, 400)
    if (safeBody.columnId && !column) return c.json({ error: 'Coluna não encontrada neste projeto' }, 400)
    if (safeBody.versionId && !version) return c.json({ error: 'Versão não encontrada neste projeto' }, 400)
    if (safeBody.costCenterId && !costCenter) return c.json({ error: 'Centro de custo não encontrado neste projeto' }, 400)
    if (safeBody.assigneeId && !assignee) return c.json({ error: 'Responsável não é membro deste projeto' }, 400)
  }

  if (safeBody.sprintId !== undefined) {
    const sprint = safeBody.sprintId
      ? await db.query.sprints.findFirst({ where: (s) => and(eq(s.id, safeBody.sprintId as string), eq(s.projectId, projectId), eq(s.tenantId, ctx.tenantId)) })
      : null
    if (safeBody.sprintId && !sprint) return c.json({ error: 'Sprint não encontrada neste projeto' }, 400)
    if (sprint?.status === 'CLOSED') return c.json({ error: 'Não é possível associar itens a uma sprint fechada' }, 409)
  }

  // Se parentId mudou, recalcular ancestryPath
  if (safeBody.parentId !== undefined || (project.boardMode === 'SIMPLE' && prevItem && ['TASK', 'BUG'].includes(prevItem.type))) {
    const newParentId = (updates.parentId as string | null | undefined) ?? safeBody.parentId
    const newPath = newParentId
      ? await buildAncestryPath(ctx.tenantId, newParentId)
      : []
    updates.ancestryPath = JSON.stringify(newPath)
    // Atualizar descendentes em cascata
    await updateDescendantAncestry(ctx.tenantId, itemId)
  }

  await db.update(items)
    .set(updates)
    // [TENANT] Anti-IDOR: filtra por tenantId + projectId + itemId.
    .where(and(eq(items.id, itemId), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))

  if (safeBody.sprintId !== undefined) {
    await db.transaction(async (tx) => {
      await tx.delete(itemSprints).where(eq(itemSprints.itemId, itemId))
      if (safeBody.sprintId) await tx.insert(itemSprints).values({ itemId, sprintId: safeBody.sprintId as string })
    })
  }

  // Se título mudou, atualizar ancestryPath dos filhos
  if (safeBody.title) {
    await updateDescendantAncestry(ctx.tenantId, itemId)
  }

  // Tarefa 5.1 — gerar log automático apenas se algum campo loggável mudou
  if (prevItem) {
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
    if (changes.length > 0) {
      await createAutoLog(itemId, ctx.tenantId, ctx.userId, `Campos alterados: ${changes.join('; ')}`)
    }
  }

  broadcast(projectId, { type: 'ITEM_UPDATED', projectId, payload: { itemId, ...safeBody } })
  const updated = await db.query.items.findFirst({ where: (i) => and(eq(i.id, itemId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)) })
  return c.json({ item: updated })
})

// DELETE /projects/:projectId/items/:itemId — exclusão em cascata (filhos, checklists, tags)
itemsRouter.delete('/:itemId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  // [TENANT] Anti-IDOR: verificar que o item pertence ao tenant antes de qualquer operação
  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  let requestBody: { dryRun?: boolean } = {}
  try { requestBody = await c.req.json() } catch { /* corpo opcional */ }

  // Coletar IDs de todos os descendentes via BFS
  // [TENANT] filtragem por tenantId em cada nível garante isolamento cross-tenant
  const allIds: string[] = [itemId]
  const queue = [itemId]
  while (queue.length > 0) {
    const parentId = queue.shift()!
      const children = await db.select({ id: items.id })
        .from(items)
        .where(and(eq(items.parentId, parentId), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))
    for (const child of children) {
      allIds.push(child.id)
      queue.push(child.id)
    }
  }

  if (requestBody.dryRun) {
    return c.json({ dryRun: true, itemId, projectId, descendantCount: allIds.length - 1, totalCount: allIds.length })
  }

  // [DB-SWAP] no PostgreSQL, usar ON DELETE CASCADE no schema em vez de exclusão manual aqui
  await db.transaction(async (tx) => {
    // itemTags e itemSprints têm FK para items.id sem cascade — excluir antes
    await tx.delete(itemTags).where(inArray(itemTags.itemId, allIds))
    await tx.delete(itemSprints).where(inArray(itemSprints.itemId, allIds))
    await tx.delete(attachments).where(inArray(attachments.itemId, allIds))
    // checklists e checklistItems têm onDelete:'cascade' — serão excluídos automaticamente com items
    // items.parentId não tem FK constraint no schema, então podemos excluir todos de uma vez
    await tx.delete(items).where(and(inArray(items.id, allIds), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))
  })

  broadcast(projectId, { type: 'ITEM_DELETED', projectId, payload: { itemId } })
  return c.json({ deleted: allIds.length })
})

// POST /projects/:projectId/items/:itemId/tags
itemsRouter.post('/:itemId/tags', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  const body = await c.req.json<{ tagIds: string[] }>()

  // Verificar que item pertence ao tenant — [TENANT] Anti-IDOR
  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const uniqueTagIds = [...new Set(body.tagIds)]
  if (uniqueTagIds.length > 0) {
    const validTags = await db.select({ id: tags.id })
      .from(tags)
      .where(and(
        inArray(tags.id, uniqueTagIds),
        eq(tags.projectId, projectId),
        eq(tags.tenantId, ctx.tenantId)
      ))

    if (validTags.length !== uniqueTagIds.length) {
      return c.json({ error: 'Uma ou mais tags não existem neste projeto' }, 400)
    }
  }

  await db.transaction(async (tx) => {
    // item_tags não possui tenantId; o item acima já foi validado por tenant + projeto.
    await tx.delete(itemTags).where(eq(itemTags.itemId, itemId))
    if (uniqueTagIds.length > 0) {
      await tx.insert(itemTags).values(uniqueTagIds.map(tagId => ({ itemId, tagId })))
    }
  })

  return c.json({ ok: true })
})

// POST /projects/:projectId/items/:itemId/sprint
itemsRouter.post('/:itemId/sprint', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  const body = await c.req.json<{ sprintId: string }>()

  // [TENANT] Verificar ownership antes de inserir
  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const sprint = await db.query.sprints.findFirst({
    where: (s) => and(eq(s.id, body.sprintId), eq(s.projectId, projectId), eq(s.tenantId, ctx.tenantId)),
    columns: { id: true, status: true },
  })
  if (!sprint) return c.json({ error: 'Sprint não encontrada neste projeto' }, 400)
  if (sprint.status === 'CLOSED') return c.json({ error: 'Não é possível associar itens a uma sprint fechada' }, 409)

  await db.insert(itemSprints)
    .values({ itemId, sprintId: body.sprintId })
    .onConflictDoNothing()

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
  const parent = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!parent) return c.json({ error: 'Item não encontrado' }, 404)

  // [TENANT] filtra filhos diretos por tenantId + parentId
  const children = await db.query.items.findMany({
    where: (i) => and(eq(i.parentId, itemId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
    with: {
      assignee: { columns: { id: true, name: true, avatarUrl: true } },
      column: { columns: { id: true, name: true } },
    },
    columns: {
      id: true, title: true, type: true, priority: true, status: true, points: true,
      assigneeId: true, columnId: true,
    },
    orderBy: (i, { asc }) => [asc(i.position)],
  })

  return c.json({ data: children, total: children.length })
})

// ---------------------------------------------------------------------------
// Tarefas 4.1, 4.2, 4.3 — Endpoints de logs de atividade
// ---------------------------------------------------------------------------

// GET /projects/:projectId/items/:itemId/logs
itemsRouter.get('/:itemId/logs', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  const page = parseInt(c.req.query('page') ?? '1')
  const limit = parseInt(c.req.query('limit') ?? '20')
  const offset = (page - 1) * limit

  // [TENANT] Anti-IDOR
  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  // [TENANT] filtra logs por tenantId + itemId
  const logs = await db.query.itemLogs.findMany({
    where: (l) => and(eq(l.itemId, itemId), eq(l.tenantId, ctx.tenantId)),
    with: { author: { columns: { id: true, name: true, avatarUrl: true } } },
    orderBy: (l) => [desc(l.createdAt)],
    limit,
    offset,
  })

  const totalRow = await db.select({ count: sql<number>`COUNT(*)` })
    .from(itemLogs)
    .where(and(eq(itemLogs.itemId, itemId), eq(itemLogs.tenantId, ctx.tenantId)))
  const total = totalRow[0]?.count ?? 0

  return c.json({ data: logs, total, page, limit })
})

// POST /projects/:projectId/items/:itemId/logs — criar log manual
itemsRouter.post('/:itemId/logs', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  const body = await c.req.json<{ activity: string; durationMin?: number | null }>()

  if (!body.activity?.trim()) return c.json({ error: 'activity é obrigatório' }, 400)

  // [TENANT] Anti-IDOR
  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  const now = new Date().toISOString()
  const id = generateId()
  // [TENANT] tenantId vem do middleware JWT
  await db.insert(itemLogs).values({
    id,
    tenantId: ctx.tenantId,
    itemId,
    authorId: ctx.userId,
    type: 'manual',
    activity: body.activity.trim(),
    durationMin: body.durationMin ?? null,
    createdAt: now,
    updatedAt: now,
  })

  return c.json({ id }, 201)
})

// PATCH /projects/:projectId/items/:itemId/logs/:logId — editar log manual
itemsRouter.patch('/:itemId/logs/:logId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { itemId, logId } = c.req.param()
  const memberRole = c.get('memberRole') as string
  const body = await c.req.json<{ activity?: string; durationMin?: number | null }>()

  // [TENANT] Anti-IDOR: buscar log verificando tenantId
  const log = await db.query.itemLogs.findFirst({
    where: (l) => and(eq(l.id, logId), eq(l.itemId, itemId), eq(l.tenantId, ctx.tenantId)),
  })
  if (!log) return c.json({ error: 'Log não encontrado' }, 404)

  if (log.type === 'auto') return c.json({ error: 'Logs automáticos não podem ser editados' }, 403)
  if (log.authorId !== ctx.userId && memberRole !== 'ADMIN') {
    return c.json({ error: 'Sem permissão para editar este log' }, 403)
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (body.activity !== undefined) updates.activity = body.activity.trim()
  if (body.durationMin !== undefined) updates.durationMin = body.durationMin

  await db.update(itemLogs)
    .set(updates)
    .where(and(eq(itemLogs.id, logId), eq(itemLogs.tenantId, ctx.tenantId)))

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
  const rootItem = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, ctx.tenantId), eq(i.projectId, projectId)),
    columns: { id: true, status: true },
  })
  if (!rootItem) return c.json({ error: 'Item não encontrado' }, 404)
  if (rootItem.status === 'ARCHIVED') return c.json({ error: 'Item já está arquivado' }, 422)

  // Coletar todos os descendentes via BFS (ancestry_path desnormalizado é String JSON)
  // [TENANT] filtra descendentes pelo tenantId para isolamento cross-tenant
  const allIds: string[] = [itemId]
  const queue = [itemId]
  while (queue.length > 0) {
    const parentId = queue.shift()!
      const children = await db.select({ id: items.id })
        .from(items)
        .where(and(eq(items.parentId, parentId), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))
    for (const child of children) { allIds.push(child.id); queue.push(child.id) }
  }

  const descendantCount = allIds.length - 1
  const { confirm, dryRun } = await c.req.json<{ confirm?: boolean; dryRun?: boolean }>().catch(() => ({ confirm: false, dryRun: false }))
  if (dryRun) return c.json({ dryRun: true, itemId, projectId, descendantCount, totalCount: allIds.length })
  if (descendantCount > 0 && !confirm) {
    return c.json({ warning: true, descendantCount, message: `${descendantCount} item(s) descendente(s) serão arquivados junto` }, 200)
  }

  const now = new Date().toISOString()
  await db.transaction(async (tx) => {
    // Buscar status atual de cada item antes de arquivar — preservar em status_before_archive
    // [DB-SWAP] no PostgreSQL usar UPDATE ... FROM ... RETURNING ou CTE para evitar N queries
    for (const id of allIds) {
      const current = await tx.query.items.findFirst({
        where: (i) => and(eq(i.id, id), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
        columns: { status: true },
      })
      if (current && current.status !== 'ARCHIVED') {
        await tx.update(items)
          .set({ status: 'ARCHIVED', statusBeforeArchive: current.status, updatedAt: now })
          .where(and(eq(items.id, id), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))
      }
    }
  })

  broadcast(projectId, { type: 'ITEM_UPDATED', projectId, payload: { archived: true, ids: allIds } })
  return c.json({ ok: true, archivedCount: allIds.length })
})

// POST /projects/:projectId/items/:itemId/unarchive — restaurar item e dependências
itemsRouter.post('/:itemId/unarchive', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  // [TENANT] Anti-IDOR: verificar ownership
  const rootItem = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, ctx.tenantId), eq(i.projectId, projectId)),
    columns: { id: true, status: true, statusBeforeArchive: true, ancestryPath: true, parentId: true },
  })
  if (!rootItem) return c.json({ error: 'Item não encontrado' }, 404)
  if (rootItem.status !== 'ARCHIVED') return c.json({ error: 'Item não está arquivado' }, 422)

  // Coletar todos os descendentes arquivados para restaurar em cascata
  const allIds: string[] = [itemId]
  const queue = [itemId]
  while (queue.length > 0) {
    const parentId = queue.shift()!
      const children = await db.select({ id: items.id })
        .from(items)
        .where(and(eq(items.parentId, parentId), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId), sql`${items.status} = 'ARCHIVED'`))
    for (const child of children) { allIds.push(child.id); queue.push(child.id) }
  }

  // Restaurar também ancestrais arquivados na cadeia até a raiz
  const ancestorPath: Array<{ id: string }> = (() => {
    try { return JSON.parse(rootItem.ancestryPath || '[]') } catch { return [] }
  })()
  const ancestorIds = ancestorPath.map(a => a.id)

  const now = new Date().toISOString()
  await db.transaction(async (tx) => {
    // Restaurar item raiz + descendentes arquivados
    // [DB-SWAP] no PostgreSQL usar UPDATE ... WHERE id = ANY($1) para operação em bulk
    for (const id of allIds) {
      const current = await tx.query.items.findFirst({
        where: (i) => and(eq(i.id, id), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
        columns: { statusBeforeArchive: true },
      })
      const restoreStatus = current?.statusBeforeArchive ?? 'NOT_STARTED'
      await tx.update(items)
        .set({ status: restoreStatus, statusBeforeArchive: null, updatedAt: now })
        .where(and(eq(items.id, id), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))
    }

    // Restaurar ancestrais arquivados para que o item seja visível na hierarquia
    for (const ancestorId of ancestorIds) {
      const ancestor = await tx.query.items.findFirst({
        where: (i) => and(eq(i.id, ancestorId), eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
        columns: { status: true, statusBeforeArchive: true },
      })
      if (ancestor?.status === 'ARCHIVED') {
        const restoreStatus = ancestor.statusBeforeArchive ?? 'NOT_STARTED'
        await tx.update(items)
          .set({ status: restoreStatus, statusBeforeArchive: null, updatedAt: now })
          .where(and(eq(items.id, ancestorId), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))
      }
    }
  })

  broadcast(projectId, { type: 'ITEM_UPDATED', projectId, payload: { unarchived: true, ids: allIds } })
  return c.json({ ok: true, restoredCount: allIds.length })
})
