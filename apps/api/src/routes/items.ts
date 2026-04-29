import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { eq, and, inArray, asc, sql, desc } from 'drizzle-orm'
import { db } from '../db/index'
import { items, columns, itemTags, itemSprints, modules, checklists, checklistItems, attachments, itemLogs, projectVersions } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import { generateId } from '../utils/id'
import { buildAncestryPath, calculateProgress, calculatePoints, updateDescendantAncestry } from '../services/ancestry'
import { broadcast } from '../services/websocket'
import type { RequestContext, Priority, ItemType } from '@azy-board/types'

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
async function isLeaf(tenantId: string, itemId: string): Promise<boolean> {
  const children = await db.query.items.findMany({
    where: (i) => and(eq(i.parentId, itemId), eq(i.tenantId, tenantId)),
    columns: { id: true },
  })
  return children.length === 0
}

// Valida que a hierarquia de tipos é coerente
// EPIC → parentId null; STORY → pai é EPIC; TASK/BUG → pai é STORY, TASK ou BUG
async function validateHierarchy(
  tenantId: string,
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
    where: (i) => and(eq(i.id, parentId), eq(i.tenantId, tenantId)),
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

// Resolve o epicId ancestral de um item (para agrupar em swimlanes)
async function resolveEpicAncestor(tenantId: string, itemId: string): Promise<string | null> {
  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, tenantId)),
    columns: { id: true, type: true, parentId: true },
  })
  if (!item) return null
  if (item.type === 'EPIC') return item.id
  if (!item.parentId) return null
  return resolveEpicAncestor(tenantId, item.parentId)
}

// PATCH /projects/:projectId/items/reorder — antes de /:itemId para não colidir
itemsRouter.patch('/reorder', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('projectId')!
  const body = await c.req.json<{ columnId: string; order: string[] }>()

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

  // [TENANT] Filtra por tenantId + projectId
  const [allModules, allItems] = await Promise.all([
    db.select().from(modules)
      .where(and(eq(modules.projectId, projectId), eq(modules.tenantId, ctx.tenantId)))
      .orderBy(asc(modules.position)),
    db.select().from(items)
      .where(and(eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))
      .orderBy(asc(items.position)),
  ])

  let sprintItemIds: Set<string> | null = null
  if (filterSprintId) {
    const rows = await db.select({ itemId: itemSprints.itemId })
      .from(itemSprints)
      .where(eq(itemSprints.sprintId, filterSprintId))
    sprintItemIds = new Set(rows.map(r => r.itemId))
  }

  const epics = allItems.filter(i =>
    i.type === 'EPIC' &&
    (!filterModuleId || i.moduleId === filterModuleId)
  )

  function buildChildren(parentId: string, depth: number): unknown[] {
    const children = allItems
      .filter(i => i.parentId === parentId)
      .sort((a, b) => a.position - b.position)

    return children.map(child => {
      const nested = buildChildren(child.id, depth + 1)
      const leafItems = nested.length === 0 && ['TASK', 'BUG'].includes(child.type)

      if (filterAssigneeId && leafItems && child.assigneeId !== filterAssigneeId) return null
      if (sprintItemIds && leafItems && !sprintItemIds.has(child.id)) return null

      return {
        ...child,
        ancestryPath: (() => { try { return JSON.parse(child.ancestryPath) } catch { return [] } })(),
        isLeaf: nested.length === 0,
        children: nested.filter(Boolean),
      }
    }).filter(Boolean)
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

  return c.json(tree)
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

  // [TENANT] Filtra por tenantId + projectId
  let allItems = await db.query.items.findMany({
    where: (i) => and(eq(i.projectId, projectId), eq(i.tenantId, ctx.tenantId)),
    with: {
      itemTags: { with: { tag: true } },
      assignee: { columns: { id: true, name: true, avatarUrl: true } },
      assigneeApiKey: { columns: { id: true, name: true, aiModelName: true } },
      author: { columns: { id: true, name: true, avatarUrl: true } },
      version: { columns: { id: true, name: true, status: true } },
    },
    orderBy: (i, { asc }) => [asc(i.position)],
  })

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
  if (sprintIdFilter) {
    const sprintItemIds = (await db.select({ itemId: itemSprints.itemId })
      .from(itemSprints)
      .where(eq(itemSprints.sprintId, sprintIdFilter)))
      .map(r => r.itemId)
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
    return c.json(withProgress.filter(i => i.isLeaf))
  }

  return c.json(withProgress)
})

// GET /projects/:projectId/items/:itemId
itemsRouter.get('/:itemId', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { itemId } = c.req.param()

  // [TENANT] Anti-IDOR: filtra por tenantId + itemId
  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, ctx.tenantId)),
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
  }>()

  const type: ItemType = body.type ?? 'TASK'

  const validationError = await validateHierarchy(ctx.tenantId, type, body.parentId, body.moduleId)
  if (validationError) return c.json({ error: validationError }, 400)

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

  const ancestryPath = body.parentId
    ? await buildAncestryPath(ctx.tenantId, body.parentId)
    : []

  // [TENANT] tenantId vem do JWT — nunca do body
  // authorId capturado do contexto de autenticação (humano ou agente de IA)
  await db.insert(items).values({
    id,
    tenantId: ctx.tenantId,
    projectId,
    type,
    parentId: body.parentId ?? null,
    moduleId: body.moduleId ?? null,
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
    startDate: body.startDate ?? null,
    dueDate: body.dueDate ?? null,
    position: 0,
    createdAt: now,
    updatedAt: now,
  })

  const payload = { id, title: body.title, type, projectId, columnId, status: 'NOT_STARTED' }

  if (body.parentId) {
    broadcast(projectId, { type: 'SUBTASK_CREATED', projectId, payload: { parentId: body.parentId, item: payload } })
  } else {
    broadcast(projectId, { type: 'ITEM_CREATED', projectId, payload })
  }

  return c.json(payload, 201)
})

// PATCH /projects/:projectId/items/:itemId/move — mover card para outra coluna
itemsRouter.patch('/:itemId/move', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()
  const body = await c.req.json<{ columnId: string }>()

  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, ctx.tenantId)),
    columns: { id: true, type: true, columnId: true },
  })
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  // Leaf Rule: apenas TASK e BUG são movíveis — [TENANT] Anti-IDOR: projectId + tenantId
  if (!['TASK', 'BUG'].includes(item.type)) {
    return c.json({ error: `Items do tipo ${item.type} não são movíveis no Kanban` }, 422)
  }

  if (!(await isLeaf(ctx.tenantId, itemId))) {
    return c.json({ error: 'Este item possui filhos — mova os itens filhos individualmente' }, 422)
  }

  const col = await db.query.columns.findFirst({
    where: (col) => and(eq(col.id, body.columnId), eq(col.tenantId, ctx.tenantId)),
  })
  if (!col) return c.json({ error: 'Coluna não encontrada' }, 404)

  // Buscar nome da coluna de origem para log — [TENANT] filtro por tenantId
  let fromColName = 'desconhecida'
  if (item.columnId) {
    const fromCol = await db.query.columns.findFirst({
      where: (c) => and(eq(c.id, item.columnId!), eq(c.tenantId, ctx.tenantId)),
      columns: { name: true },
    })
    fromColName = fromCol?.name ?? fromColName
  }

  await db.update(items)
    .set({ columnId: body.columnId, status: col.baseStatus, updatedAt: new Date().toISOString() })
    .where(and(eq(items.id, itemId), eq(items.tenantId, ctx.tenantId)))

  // Tarefa 5.2 — log automático de movimentação de coluna
  await createAutoLog(itemId, ctx.tenantId, ctx.userId, `Movido de '${fromColName}' para '${col.name}'`)

  broadcast(projectId, {
    type: 'CARD_MOVED',
    projectId,
    payload: { itemId, columnId: body.columnId, status: col.baseStatus },
  })

  return c.json({ ok: true, status: col.baseStatus })
})

// PATCH /projects/:projectId/items/:itemId/claim
itemsRouter.patch('/:itemId/claim', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, ctx.tenantId)),
  })
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)
  if (item.assigneeId) return c.json({ error: 'Item já está sendo trabalhado por outro usuário' }, 409)

  const apiKeyId = c.get('apiKeyId') as string | undefined

  await db.update(items)
    .set({ assigneeId: ctx.userId, assigneeApiKeyId: apiKeyId ?? null, status: 'IN_PROGRESS', updatedAt: new Date().toISOString() })
    .where(and(eq(items.id, itemId), eq(items.tenantId, ctx.tenantId)))

  broadcast(projectId, { type: 'TASK_CLAIMED', projectId, payload: { itemId, assigneeId: ctx.userId, apiKeyId } })
  return c.json({ ok: true })
})

// PATCH /projects/:projectId/items/:itemId/release
itemsRouter.patch('/:itemId/release', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  await db.update(items)
    .set({ assigneeId: null, assigneeApiKeyId: null, status: 'NOT_STARTED', updatedAt: new Date().toISOString() })
    .where(and(eq(items.id, itemId), eq(items.tenantId, ctx.tenantId)))

  broadcast(projectId, { type: 'CARD_UPDATED', projectId, payload: { itemId, assigneeId: null } })
  return c.json({ ok: true })
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
  }>()

  // Tarefa 2.2 — authorId nunca é alterado via PATCH
  const { authorId: _ignoredAuthorId, ...safeBody } = body
  const updates: Record<string, unknown> = { ...safeBody, updatedAt: new Date().toISOString() }

  // Tarefa 5.1 — buscar estado anterior para gerar log automático
  const LOGGABLE_FIELDS = ['title', 'description', 'priority', 'assigneeId', 'points', 'startDate', 'dueDate', 'status'] as const
  type LoggableField = typeof LOGGABLE_FIELDS[number]
  const prevItem = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, ctx.tenantId)),
    columns: { title: true, description: true, priority: true, assigneeId: true, points: true, startDate: true, dueDate: true, status: true },
  })

  // Se parentId mudou, recalcular ancestryPath
  if (safeBody.parentId !== undefined) {
    const newPath = safeBody.parentId
      ? await buildAncestryPath(ctx.tenantId, safeBody.parentId)
      : []
    updates.ancestryPath = JSON.stringify(newPath)
    // Atualizar descendentes em cascata
    await updateDescendantAncestry(ctx.tenantId, itemId)
  }

  await db.update(items)
    .set(updates)
    // [TENANT] Anti-IDOR: filtra por tenantId + itemId
    .where(and(eq(items.id, itemId), eq(items.tenantId, ctx.tenantId)))

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
  return c.json({ ok: true })
})

// DELETE /projects/:projectId/items/:itemId — exclusão em cascata (filhos, checklists, tags)
itemsRouter.delete('/:itemId', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { projectId, itemId } = c.req.param()

  // [TENANT] Anti-IDOR: verificar que o item pertence ao tenant antes de qualquer operação
  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  // Coletar IDs de todos os descendentes via BFS
  // [TENANT] filtragem por tenantId em cada nível garante isolamento cross-tenant
  const allIds: string[] = [itemId]
  const queue = [itemId]
  while (queue.length > 0) {
    const parentId = queue.shift()!
    const children = await db.select({ id: items.id })
      .from(items)
      .where(and(eq(items.parentId, parentId), eq(items.tenantId, ctx.tenantId)))
    for (const child of children) {
      allIds.push(child.id)
      queue.push(child.id)
    }
  }

  // [DB-SWAP] no PostgreSQL, usar ON DELETE CASCADE no schema em vez de exclusão manual aqui
  await db.transaction(async (tx) => {
    // itemTags e itemSprints têm FK para items.id sem cascade — excluir antes
    await tx.delete(itemTags).where(inArray(itemTags.itemId, allIds))
    await tx.delete(itemSprints).where(inArray(itemSprints.itemId, allIds))
    await tx.delete(attachments).where(inArray(attachments.itemId, allIds))
    // checklists e checklistItems têm onDelete:'cascade' — serão excluídos automaticamente com items
    // items.parentId não tem FK constraint no schema, então podemos excluir todos de uma vez
    await tx.delete(items).where(and(inArray(items.id, allIds), eq(items.tenantId, ctx.tenantId)))
  })

  broadcast(projectId, { type: 'ITEM_DELETED', projectId, payload: { itemId } })
  return c.json({ deleted: allIds.length })
})

// POST /projects/:projectId/items/:itemId/tags
itemsRouter.post('/:itemId/tags', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const itemId = c.req.param('itemId')!
  const body = await c.req.json<{ tagIds: string[] }>()

  // Verificar que item pertence ao tenant — [TENANT] Anti-IDOR
  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

  await db.transaction(async (tx) => {
    await tx.delete(itemTags).where(eq(itemTags.itemId, itemId))
    if (body.tagIds.length > 0) {
      await tx.insert(itemTags).values(body.tagIds.map(tagId => ({ itemId, tagId })))
    }
  })

  return c.json({ ok: true })
})

// POST /projects/:projectId/items/:itemId/sprint
itemsRouter.post('/:itemId/sprint', requireRole('MEMBER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const itemId = c.req.param('itemId')!
  const body = await c.req.json<{ sprintId: string }>()

  // [TENANT] Verificar ownership antes de inserir
  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!item) return c.json({ error: 'Item não encontrado' }, 404)

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
  const { itemId } = c.req.param()

  // [TENANT] Anti-IDOR: verificar ownership do item pai
  const parent = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!parent) return c.json({ error: 'Item não encontrado' }, 404)

  // [TENANT] filtra filhos diretos por tenantId + parentId
  const children = await db.query.items.findMany({
    where: (i) => and(eq(i.parentId, itemId), eq(i.tenantId, ctx.tenantId)),
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
  const { itemId } = c.req.param()
  const page = parseInt(c.req.query('page') ?? '1')
  const limit = parseInt(c.req.query('limit') ?? '20')
  const offset = (page - 1) * limit

  // [TENANT] Anti-IDOR
  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, ctx.tenantId)),
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
  const { itemId } = c.req.param()
  const body = await c.req.json<{ activity: string; durationMin?: number | null }>()

  if (!body.activity?.trim()) return c.json({ error: 'activity é obrigatório' }, 400)

  // [TENANT] Anti-IDOR
  const item = await db.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, ctx.tenantId)),
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
