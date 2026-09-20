import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { eq, and, or, asc, inArray, sql, isNotNull } from 'drizzle-orm'
import { db } from '../db/index'
import { projects, memberships, modules, columns, squads, users, items, itemTags, itemSprints, attachments, projectVersions, projectCostCenters, sprints, tags, checklists, checklistItems, itemLogs, assistantConversations } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import { generateId } from '../utils/id'
import { broadcast } from '../services/websocket'
import type { RequestContext, BoardMode, AncestorNode } from '@azy-board/types'
import { hasGlobalGroup } from '../services/auth'
import { hasKeyPermission } from '../services/authorization'
import { appendAnalyticsEvent, ensureCoverage, snapshotItem } from '../services/analytics'
import { deleteProjectCascade } from '../services/deletion'
import { triggerStorageCleanupAfterCommit } from '../services/storageCleanup'
import { confirmationSchema, createProjectSchema, parseJson, parseOptionalJson, updateProjectSchema } from '../validation'
import { addProjectMemberSchema, costCenterSchema, deleteModuleSchema, moduleSchema, projectMemberSchema, squadMemberSchema, squadSchema, updateCostCenterSchema, updateModuleSchema } from '../validation'

export const projectsRouter = new Hono<HonoEnv>()
projectsRouter.use('*', authMiddleware)

type ProjectTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

const DEFAULT_COLUMNS: Array<{ name: string; baseStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' }> = [
  { name: 'Backlog', baseStatus: 'NOT_STARTED' },
  { name: 'A Fazer', baseStatus: 'NOT_STARTED' },
  { name: 'Fazendo', baseStatus: 'IN_PROGRESS' },
  { name: 'A Testar', baseStatus: 'IN_PROGRESS' },
  { name: 'Testando', baseStatus: 'IN_PROGRESS' },
  { name: 'Concluídas', baseStatus: 'DONE' },
]

interface EscopoVisibilidadeProjetos {
  tenantId: string
  userId: string
  globalGroup: RequestContext['globalGroup']
  includeHidden: boolean
}

// Monta as condições de visibilidade da listagem de projetos.
// [TENANT] O tenant_id é aplicado aqui e nunca pode ser omitido pelo chamador.
// Projetos restritos sem vínculo ficam fora inclusive para ADMIN/ROOT; os demais grupos
// continuam vendo somente projetos com membership ativa.
function condicoesVisibilidadeProjetos({ tenantId, userId, globalGroup, includeHidden }: EscopoVisibilidadeProjetos) {
  // [TENANT] Vínculo é sempre avaliado dentro do tenant do chamador.
  const temVinculo = or(isNotNull(memberships.id), eq(projects.managerUserId, userId))
  const condicoes = [
    // [TENANT] Nenhuma listagem pode escapar do tenant do chamador.
    eq(projects.tenantId, tenantId),
    // Projetos restritos ficam fora da listagem de qualquer grupo sem vínculo, inclusive ADMIN/ROOT.
    or(eq(projects.isRestricted, false), temVinculo),
  ]
  // Membros de Equipe e Gerentes continuam vendo somente os projetos com vínculo.
  if (!hasGlobalGroup(globalGroup, 'ADMIN')) condicoes.push(temVinculo)
  // Projetos ocultos só entram na listagem quando a requisição pede explicitamente.
  if (!includeHidden) condicoes.push(eq(projects.isHidden, false))
  return condicoes
}

// Sinalizadores de visibilidade são opcionais, mas quando enviados precisam ser booleanos.
function ehBooleanoOuAusente(valor: unknown): boolean {
  return valor === undefined || typeof valor === 'boolean'
}

async function findOrCreateSimpleStory(tx: ProjectTransaction, tenantId: string, projectId: string, storyId?: string | null) {
  if (storyId) {
    const existing = await tx.query.items.findFirst({
      where: (item) => and(eq(item.id, storyId), eq(item.projectId, projectId), eq(item.tenantId, tenantId), eq(item.type, 'STORY')),
    })
    if (existing) return existing
  }

  const id = generateId()
  const now = new Date().toISOString()
  await tx.insert(items).values({
    id,
    tenantId,
    projectId,
    type: 'STORY',
    parentId: null,
    moduleId: null,
    title: 'Fluxo contínuo',
    ancestryPath: '[]',
    status: 'NOT_STARTED',
    priority: 'MEDIUM',
    position: 0,
    createdAt: now,
    updatedAt: now,
  })
  return (await tx.query.items.findFirst({ where: (item) => eq(item.id, id) }))!
}

function simpleStoryPath(story: { id: string; title: string; type: string }): AncestorNode[] {
  return [{ id: story.id, title: story.title, type: story.type }]
}

async function convertToSimple(tx: ProjectTransaction, tenantId: string, projectId: string, currentStoryId?: string | null, actorId = 'SYSTEM') {
  const story = await findOrCreateSimpleStory(tx, tenantId, projectId, currentStoryId)
  const allItems = await tx.select().from(items)
    .where(and(eq(items.projectId, projectId), eq(items.tenantId, tenantId)))
  const taskItems = allItems.filter(item => item.type === 'TASK' || item.type === 'BUG')
  const hierarchyItems = allItems.filter(item => item.type === 'EPIC' || item.type === 'STORY')
  const affectedParents = new Set([story.id, ...allItems.map(item => item.parentId).filter((id): id is string => Boolean(id))])
  const parentBefore = new Map<string, Awaited<ReturnType<typeof snapshotItem>>>()
  for (const id of affectedParents) parentBefore.set(id, await snapshotItem(tx, tenantId, projectId, id))
  const path = JSON.stringify(simpleStoryPath(story))

  for (const item of taskItems) {
    const itemBefore = await snapshotItem(tx, tenantId, projectId, item.id)
    await tx.update(items).set({ parentId: story.id, moduleId: null, ancestryPath: path, updatedAt: new Date().toISOString() })
      .where(and(eq(items.id, item.id), eq(items.tenantId, tenantId), eq(items.projectId, projectId)))
    await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: item.id, eventType: 'ITEM_REPARENTED', actorId, origin: 'REST', before: itemBefore, after: await snapshotItem(tx, tenantId, projectId, item.id) })
  }

  const removedIds = hierarchyItems.filter(item => item.id !== story.id).map(item => item.id)
  if (removedIds.length > 0) {
    const deletedSnapshots = new Map<string, Awaited<ReturnType<typeof snapshotItem>>>()
    for (const id of removedIds) deletedSnapshots.set(id, await snapshotItem(tx, tenantId, projectId, id))
    await tx.delete(itemTags).where(inArray(itemTags.itemId, removedIds))
    await tx.delete(itemSprints).where(inArray(itemSprints.itemId, removedIds))
    await tx.delete(attachments).where(inArray(attachments.itemId, removedIds))
    await tx.delete(items).where(and(inArray(items.id, removedIds), eq(items.tenantId, tenantId), eq(items.projectId, projectId)))
    for (const id of removedIds) await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: id, eventType: 'ITEM_DELETED', actorId, origin: 'REST', before: deletedSnapshots.get(id), after: null })
  }

  await tx.delete(modules).where(and(eq(modules.projectId, projectId), eq(modules.tenantId, tenantId)))
  await tx.update(items).set({ parentId: null, moduleId: null, ancestryPath: '[]', updatedAt: new Date().toISOString() })
    .where(and(eq(items.id, story.id), eq(items.tenantId, tenantId), eq(items.projectId, projectId)))
  await tx.update(projects).set({ boardMode: 'SIMPLE', simpleStoryId: story.id })
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
  for (const parentId of affectedParents) { const before = parentBefore.get(parentId); const after = await snapshotItem(tx, tenantId, projectId, parentId); if (before && after && JSON.stringify(before) !== JSON.stringify(after)) await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: parentId, eventType: 'LEAF_CHANGED', actorId, origin: 'REST', before, after }) }
  return story.id
}

async function convertToHierarchical(tx: ProjectTransaction, tenantId: string, projectId: string, currentStoryId?: string | null, actorId = 'SYSTEM') {
  const story = await findOrCreateSimpleStory(tx, tenantId, projectId, currentStoryId)
  const existingModule = await tx.query.modules.findFirst({
    where: (module) => and(eq(module.projectId, projectId), eq(module.tenantId, tenantId)),
    orderBy: (module, { asc }) => [asc(module.position)],
  })
  const moduleId = existingModule?.id ?? generateId()
  if (!existingModule) {
    await tx.insert(modules).values({ id: moduleId, tenantId, projectId, name: 'Geral', position: 0 })
  }

  const epic = await tx.query.items.findFirst({
    where: (item) => and(eq(item.projectId, projectId), eq(item.tenantId, tenantId), eq(item.type, 'EPIC'), eq(item.moduleId, moduleId)),
  })
  const epicId = epic?.id ?? generateId()
  if (!epic) {
    await tx.insert(items).values({
      id: epicId, tenantId, projectId, type: 'EPIC', parentId: null, moduleId,
      title: 'Fluxo contínuo', ancestryPath: '[]', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })
  }
  const storyPath = JSON.stringify([
    { id: epicId, title: epic?.title ?? 'Fluxo contínuo', type: 'EPIC' },
  ])
  const storyBefore = await snapshotItem(tx, tenantId, projectId, story.id)
  await tx.update(items).set({ parentId: epicId, moduleId: null, ancestryPath: storyPath, updatedAt: new Date().toISOString() })
    .where(and(eq(items.id, story.id), eq(items.tenantId, tenantId), eq(items.projectId, projectId)))
  const projectTasks = await tx.select({ id: items.id }).from(items)
    .where(and(eq(items.projectId, projectId), eq(items.tenantId, tenantId), inArray(items.type, ['TASK', 'BUG'])))
  for (const item of projectTasks) {
    const itemBefore = await snapshotItem(tx, tenantId, projectId, item.id)
    await tx.update(items).set({ parentId: story.id, moduleId: null, ancestryPath: JSON.stringify([
      { id: epicId, title: epic?.title ?? 'Fluxo contínuo', type: 'EPIC' },
      { id: story.id, title: story.title, type: 'STORY' },
    ]), updatedAt: new Date().toISOString() })
      .where(and(eq(items.id, item.id), eq(items.tenantId, tenantId), eq(items.projectId, projectId)))
    await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: item.id, eventType: 'ITEM_REPARENTED', actorId, origin: 'REST', before: itemBefore, after: await snapshotItem(tx, tenantId, projectId, item.id) })
  }
  await tx.update(projects).set({ boardMode: 'HIERARCHICAL', simpleStoryId: story.id })
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
  const storyAfter = await snapshotItem(tx, tenantId, projectId, story.id)
  if (storyBefore && storyAfter && JSON.stringify(storyBefore) !== JSON.stringify(storyAfter)) await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: story.id, eventType: 'LEAF_CHANGED', actorId, origin: 'REST', before: storyBefore, after: storyAfter })
  return { moduleId, epicId, storyId: story.id }
}

// POST /projects — criar projeto
projectsRouter.post('/', async (c) => {
  const ctx = c.get('ctx') as RequestContext
  if (!hasGlobalGroup(ctx.globalGroup, 'MANAGER')) return c.json({ error: 'Permissão insuficiente' }, 403)
  if (!hasKeyPermission(c.get('apiKeyPermissionScope'), 'MEMBER')) return c.json({ error: 'Permissão insuficiente', code: 'FORBIDDEN', retryable: false }, 403)
  const parsed = await parseJson(c, createProjectSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const normalizedName = body.name.trim()
  if (!normalizedName) return c.json({ error: 'O nome do projeto é obrigatório' }, 400)
  const boardMode = body.boardMode ?? 'HIERARCHICAL'
  if (!['HIERARCHICAL', 'SIMPLE'].includes(boardMode)) return c.json({ error: 'Modo de board inválido' }, 400)
  if (!ehBooleanoOuAusente(body.isRestricted) || !ehBooleanoOuAusente(body.isHidden)) {
    return c.json({ error: 'Os sinalizadores de visibilidade devem ser booleanos' }, 400)
  }
  if (body.plannedPoints !== undefined && body.plannedPoints !== null && (typeof body.plannedPoints !== 'number' || body.plannedPoints < 0)) {
    return c.json({ error: 'Total de pontos previsto deve ser um número maior ou igual a zero' }, 422)
  }
  if (body.plannedHours !== undefined && body.plannedHours !== null && (typeof body.plannedHours !== 'number' || body.plannedHours < 0)) {
    return c.json({ error: 'Total de horas previsto deve ser um número maior ou igual a zero' }, 422)
  }
  // Defaults permissivos: um projeto novo nasce visível para todos, conforme o escopo por grupo.
  const isRestricted = body.isRestricted ?? false
  const isHidden = body.isHidden ?? false

  // [TENANT] Impede nomes duplicados somente dentro do tenant autenticado.
  const duplicate = await db.query.projects.findFirst({
    where: (p) => and(eq(p.tenantId, ctx.tenantId), eq(p.name, normalizedName)),
    columns: { id: true },
  })
  if (duplicate) return c.json({ error: 'Já existe um projeto com esse nome' }, 409)

  const projectId = generateId()
  let simpleStoryId: string | null = null

  const projectResult = await db.transaction(async (tx) => {
    await tx.insert(projects).values({
     id: projectId,
     // [TENANT] Projeto sempre vinculado ao tenant do criador
     tenantId: ctx.tenantId,
     name: normalizedName,
     description: body.description,
     // [TENANT] O modo é persistido no projeto do tenant resolvido pelo middleware.
     boardMode,
     simpleStoryId: null,
      // managerUserId: validação de membership não é possível antes de criar o projeto
      // o criador se torna ADMIN logo abaixo; se managerUserId == ctx.userId é válido
      // [TENANT] Fallback para ctx.userId garante que todo projeto tenha um gerente
      managerUserId: body.managerUserId ?? ctx.userId,
     isRestricted,
     isHidden,
     advancedChecklists: body.advancedChecklists ?? false,
     startDate: body.startDate ?? null,
     plannedEndDate: body.plannedEndDate ?? null,
     plannedPoints: body.plannedPoints ?? null,
     plannedHours: body.plannedHours ?? null,
     scope: body.scope ?? null,
     createdAt: new Date().toISOString(),
    })

  // Criador se torna ADMIN automaticamente
   await tx.insert(memberships).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    projectId,
    role: 'ADMIN',
    createdAt: new Date().toISOString(),
   })

   if (boardMode === 'HIERARCHICAL') {
    // Módulo padrão "Geral" criado automaticamente
     await tx.insert(modules).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      projectId,
      name: 'Geral',
      position: 0,
    })
  } else {
    const story = await findOrCreateSimpleStory(tx, ctx.tenantId, projectId)
    simpleStoryId = story.id
    await tx.update(projects).set({ simpleStoryId }).where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)))
  }

  // Colunas padrão do board — criadas na ordem de fluxo natural de trabalho
  await tx.insert(columns).values(
    DEFAULT_COLUMNS.map((col, position) => ({
      id: generateId(),
      tenantId: ctx.tenantId,
      projectId,
      name: col.name,
      baseStatus: col.baseStatus,
      position,
    }))
  )

  // A new project starts coverage at creation, including an empty project.
  await ensureCoverage(tx, ctx.tenantId, projectId, ctx.userId, 'REST')
  return { simpleStoryId }
  })
  simpleStoryId = projectResult.simpleStoryId

  return c.json({ id: projectId, name: normalizedName, description: body.description ?? null, boardMode, simpleStoryId, managerUserId: body.managerUserId ?? ctx.userId, isRestricted, isHidden, advancedChecklists: body.advancedChecklists ?? false, startDate: body.startDate ?? null, plannedEndDate: body.plannedEndDate ?? null, plannedPoints: body.plannedPoints ?? null, plannedHours: body.plannedHours ?? null, scope: body.scope ?? null, role: 'ADMIN' as const }, 201)
})

// GET /projects — listar projetos visíveis para o usuário (membros veem os que participam)
projectsRouter.get('/', async (c) => {
  const ctx = c.get('ctx') as RequestContext
  if (!hasKeyPermission(c.get('apiKeyPermissionScope'), 'VIEWER')) return c.json({ error: 'Permissão insuficiente', code: 'FORBIDDEN', retryable: false }, 403)

  // Projetos ocultos só são retornados com includeHidden=true — qualquer outro valor é ignorado.
  const includeHidden = c.req.query('includeHidden') === 'true'

  const result = await db
    .select({ project: projects, role: memberships.role })
    .from(projects)
    .leftJoin(memberships, and(
      eq(memberships.projectId, projects.id),
      eq(memberships.userId, ctx.userId),
      // [TENANT] O vínculo só conta dentro do tenant do chamador.
      eq(memberships.tenantId, ctx.tenantId),
    ))
    .where(and(...condicoesVisibilidadeProjetos({
      // [TENANT] tenant resolvido do JWT ou da API Key pelo middleware.
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      globalGroup: ctx.globalGroup,
      includeHidden,
    })))

  const projectScope = c.get('apiKeyProjectScope')
  const scopedProjects = projectScope
    ? result.filter(r => projectScope.includes(r.project.id))
    : result
  return c.json(scopedProjects.map(r => ({
    ...r.project,
    role: r.role ?? (hasGlobalGroup(ctx.globalGroup, 'ADMIN') ? 'ADMIN' as const : 'MEMBER' as const),
  })))
})

// GET /projects/:id/board — contexto estruturado para agentes
projectsRouter.get('/:id/board', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!

  // [TENANT] Todos os dados do contexto são limitados ao projeto do tenant autenticado.
  const project = await db.query.projects.findFirst({
    where: (p) => and(eq(p.id, projectId), eq(p.tenantId, ctx.tenantId)),
    columns: { id: true, name: true, description: true, boardMode: true, simpleStoryId: true, advancedChecklists: true, startDate: true, plannedEndDate: true, plannedPoints: true, plannedHours: true, scope: true },
  })
  if (!project) return c.json({ error: 'Projeto não encontrado' }, 404)

  const [boardColumns, boardModules, boardItems] = await Promise.all([
    db.select().from(columns).where(and(eq(columns.projectId, projectId), eq(columns.tenantId, ctx.tenantId))).orderBy(asc(columns.position)),
    db.select().from(modules).where(and(eq(modules.projectId, projectId), eq(modules.tenantId, ctx.tenantId))).orderBy(asc(modules.position)),
    db.select().from(items).where(and(eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId))).orderBy(asc(items.position)),
  ])

  return c.json({ project, columns: boardColumns, modules: boardModules, items: boardItems })
})

// DELETE /projects/:id — excluir projeto e todos os registros dependentes
projectsRouter.delete('/:id', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!

  // [TENANT] requireRole valida membership ADMIN; este filtro confirma o projeto no tenant atual.
  const project = await db.query.projects.findFirst({
    where: (p) => and(eq(p.id, projectId), eq(p.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!project) return c.json({ error: 'Projeto não encontrado' }, 404)

  const parsedBody = await parseOptionalJson(c, confirmationSchema)
  if (!parsedBody.ok) return parsedBody.response
  const requestBody = parsedBody.data
  if (requestBody.dryRun) {
    const [projectItems, projectModules, projectTags, projectSprints, projectVersionsRows, projectMembers, projectColumns, projectSquads, projectConversations] = await Promise.all([
      db.select({ id: items.id }).from(items).where(and(eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId))),
      db.select({ id: modules.id }).from(modules).where(and(eq(modules.projectId, projectId), eq(modules.tenantId, ctx.tenantId))),
      db.select({ id: tags.id }).from(tags).where(and(eq(tags.projectId, projectId), eq(tags.tenantId, ctx.tenantId))),
      db.select({ id: sprints.id }).from(sprints).where(and(eq(sprints.projectId, projectId), eq(sprints.tenantId, ctx.tenantId))),
      db.select({ id: projectVersions.id }).from(projectVersions).where(and(eq(projectVersions.projectId, projectId), eq(projectVersions.tenantId, ctx.tenantId))),
      db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.projectId, projectId), eq(memberships.tenantId, ctx.tenantId))),
      db.select({ id: columns.id }).from(columns).where(and(eq(columns.projectId, projectId), eq(columns.tenantId, ctx.tenantId))),
      db.select({ id: squads.id }).from(squads).where(and(eq(squads.projectId, projectId), eq(squads.tenantId, ctx.tenantId))),
      db.select({ id: assistantConversations.id }).from(assistantConversations).where(and(eq(assistantConversations.projectId, projectId), eq(assistantConversations.tenantId, ctx.tenantId))),
    ])
    return c.json({ dryRun: true, projectId, counts: { items: projectItems.length, modules: projectModules.length, tags: projectTags.length, sprints: projectSprints.length, versions: projectVersionsRows.length, members: projectMembers.length, columns: projectColumns.length, squads: projectSquads.length, conversations: projectConversations.length } })
  }

  try {
    await db.transaction(async (tx) => {
      // Item 12: executor compartilhado reutiliza a política de exclusão de
      // itens e cobre todos os recursos de projeto; analytics/coverage são
      // removidos pela FK em cascata quando a linha do projeto sai.
      await deleteProjectCascade(tx, {
        tenantId: ctx.tenantId,
        projectId,
        actorId: ctx.userId,
        origin: c.get('apiKeyId') ? 'MCP' : 'REST',
      })
    })
  } catch (error) {
    console.error('[projects] falha ao excluir projeto', { projectId, error })
    return c.json({ error: 'Não foi possível excluir o projeto' }, 500)
  }

  // Pós-commit: limpeza dos objetos físicos de anexos via outbox (Item 12)
  triggerStorageCleanupAfterCommit()

  return c.json({ ok: true })
})

// GET /projects/:id — detalhe do projeto com gerente
projectsRouter.get('/:id', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const id = c.req.param('id')!

  // [TENANT] requireRole já verificou membership + tenantId
  const project = await db.query.projects.findFirst({
    where: (p) => and(eq(p.id, id), eq(p.tenantId, ctx.tenantId)),
    with: { modules: { orderBy: asc(modules.position) } },
  })

  if (!project) return c.json({ error: 'Projeto não encontrado' }, 404)

  // Incluir dados do gerente se definido
  let manager = null
  if (project.managerUserId) {
    manager = await db.query.users.findFirst({
      // [TENANT] O gerente exibido deve pertencer ao tenant ativo.
      where: (u) => and(eq(u.id, project.managerUserId!), eq(u.tenantId, ctx.tenantId)),
      columns: { id: true, name: true, email: true, avatarUrl: true },
    })
  }

  return c.json({ ...project, manager })
})

// PATCH /projects/:id — editar projeto (apenas ADMIN)
projectsRouter.patch('/:id', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const id = c.req.param('id')!
  const parsed = await parseJson(c, updateProjectSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  if (body.boardMode !== undefined && !['HIERARCHICAL', 'SIMPLE'].includes(body.boardMode)) {
    return c.json({ error: 'Modo de board inválido' }, 400)
  }
  if (!ehBooleanoOuAusente(body.isRestricted) || !ehBooleanoOuAusente(body.isHidden)) {
    return c.json({ error: 'Os sinalizadores de visibilidade devem ser booleanos' }, 400)
  }
  if (body.plannedPoints !== undefined && body.plannedPoints !== null && (typeof body.plannedPoints !== 'number' || body.plannedPoints < 0)) {
    return c.json({ error: 'Total de pontos previsto deve ser um número maior ou igual a zero' }, 422)
  }
  if (body.plannedHours !== undefined && body.plannedHours !== null && (typeof body.plannedHours !== 'number' || body.plannedHours < 0)) {
    return c.json({ error: 'Total de horas previsto deve ser um número maior ou igual a zero' }, 422)
  }

  // [TENANT] Lê o modo somente dentro do projeto/membership do tenant atual.
  const currentProject = await db.query.projects.findFirst({
    where: (project) => and(eq(project.id, id), eq(project.tenantId, ctx.tenantId)),
    columns: { boardMode: true, simpleStoryId: true },
  })
  if (!currentProject) return c.json({ error: 'Projeto não encontrado' }, 404)

  let normalizedName: string | undefined
  if (body.name !== undefined) {
    normalizedName = body.name.trim()
    if (!normalizedName) return c.json({ error: 'O nome do projeto é obrigatório' }, 400)

    // [TENANT] Verifica duplicidade somente entre projetos do tenant atual.
    const duplicate = await db.query.projects.findFirst({
      where: (p) => and(eq(p.tenantId, ctx.tenantId), eq(p.name, normalizedName!)),
      columns: { id: true },
    })
    if (duplicate && duplicate.id !== id) {
      return c.json({ error: 'Já existe um projeto com esse nome' }, 409)
    }
  }

  // Validar que o gerente indicado é membro do projeto
  if (body.managerUserId) {
    // [TENANT] Anti-IDOR: verificar membership do gerente no mesmo tenant
    const membership = await db.query.memberships.findFirst({
      where: (m) => and(eq(m.projectId, id), eq(m.userId, body.managerUserId!), eq(m.tenantId, ctx.tenantId)),
      columns: { id: true },
    })
    if (!membership) return c.json({ error: 'O gerente deve ser membro do projeto' }, 422)
  }

  const updates: Record<string, unknown> = {}
  if (normalizedName !== undefined) updates.name = normalizedName
  if (body.description !== undefined) updates.description = body.description
  if (body.managerUserId !== undefined) updates.managerUserId = body.managerUserId
  if (body.startDate !== undefined) updates.startDate = body.startDate
  if (body.plannedEndDate !== undefined) updates.plannedEndDate = body.plannedEndDate
  if (body.plannedPoints !== undefined) updates.plannedPoints = body.plannedPoints
  if (body.plannedHours !== undefined) updates.plannedHours = body.plannedHours
  if (body.scope !== undefined) updates.scope = body.scope
  const boardModeChanged = body.boardMode !== undefined && body.boardMode !== currentProject.boardMode
  if (body.boardMode !== undefined && !boardModeChanged) updates.boardMode = body.boardMode
  if (body.isRestricted !== undefined) updates.isRestricted = body.isRestricted
  if (body.isHidden !== undefined) updates.isHidden = body.isHidden
  if (body.advancedChecklists !== undefined) updates.advancedChecklists = body.advancedChecklists

  if (boardModeChanged && body.dryRun) {
    const projectItems = await db.select({ type: items.type }).from(items)
      .where(and(eq(items.projectId, id), eq(items.tenantId, ctx.tenantId)))
    const projectModules = await db.select({ id: modules.id }).from(modules)
      .where(and(eq(modules.projectId, id), eq(modules.tenantId, ctx.tenantId)))
    return c.json({
      dryRun: true,
      projectId: id,
      from: currentProject.boardMode,
      to: body.boardMode,
      counts: {
        items: projectItems.length,
        tasks: projectItems.filter(item => item.type === 'TASK' || item.type === 'BUG').length,
        epicsToRemove: body.boardMode === 'SIMPLE' ? projectItems.filter(item => item.type === 'EPIC').length : 0,
        storiesToPreserve: body.boardMode === 'SIMPLE' ? 1 : 0,
        modulesToRemove: body.boardMode === 'SIMPLE' ? projectModules.length : 0,
      },
    })
  }

  if (boardModeChanged) {
    try {
      await db.transaction(async (tx) => {
        // [TENANT] Nome, gerente e conversão são confirmados atomicamente no tenant atual.
        if (Object.keys(updates).length > 0) {
          await tx.update(projects).set(updates).where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)))
        }
        if (body.boardMode === 'SIMPLE') {
          await convertToSimple(tx, ctx.tenantId, id, currentProject.simpleStoryId, ctx.userId)
        } else {
          await convertToHierarchical(tx, ctx.tenantId, id, currentProject.simpleStoryId, ctx.userId)
        }
      })
    } catch {
      return c.json({ error: 'Não foi possível converter o formato do board' }, 500)
    }
  } else if (Object.keys(updates).length > 0) {
    // [TENANT] Filtra por tenantId — previne edição de projetos de outros tenants.
    await db.update(projects).set(updates).where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)))
  }

  const updatedProject = await db.query.projects.findFirst({
    // [TENANT] Retorna somente o projeto atualizado dentro do tenant autenticado.
    where: (p) => and(eq(p.id, id), eq(p.tenantId, ctx.tenantId)),
  })
  if (!updatedProject) return c.json({ error: 'Projeto não encontrado' }, 404)

  return c.json({ ...updatedProject, role: c.get('memberRole') })
})

// POST /projects/:id/modules
projectsRouter.post('/:id/modules', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!
  const parsed = await parseJson(c, moduleSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const moduleId = generateId()
  const existing = await db.select().from(modules)
    .where(and(eq(modules.projectId, projectId), eq(modules.tenantId, ctx.tenantId)))
  const position = existing.length

  await db.insert(modules).values({
    id: moduleId,
    tenantId: ctx.tenantId,
    projectId,
    name: body.name,
    description: body.description,
    position,
  })

  broadcast(projectId, { type: 'MODULE_CREATED', projectId, payload: { id: moduleId, name: body.name, position, description: body.description ?? null } })

  return c.json({ id: moduleId, name: body.name }, 201)
})

// GET /projects/:id/modules
projectsRouter.get('/:id/modules', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!

  // [TENANT] Duplo filtro: tenantId + projectId
  const result = await db.select().from(modules)
    .where(and(eq(modules.projectId, projectId), eq(modules.tenantId, ctx.tenantId)))
    .orderBy(asc(modules.position))

  return c.json(result)
})

// PATCH /projects/:id/modules/:moduleId
projectsRouter.patch('/:id/modules/:moduleId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, moduleId } = c.req.param()
  const parsed = await parseJson(c, updateModuleSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const existing = await db.query.modules.findFirst({
    where: (module) => and(eq(module.id, moduleId), eq(module.projectId, projectId), eq(module.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!existing) return c.json({ error: 'Módulo não encontrado' }, 404)

  await db.update(modules)
    .set({ ...(body.name && { name: body.name }), ...(body.position !== undefined && { position: body.position }) })
    .where(and(eq(modules.id, moduleId), eq(modules.projectId, projectId), eq(modules.tenantId, ctx.tenantId)))

  return c.json({ ok: true })
})

// DELETE /projects/:id/modules/:moduleId — Tarefas 2.1-2.4
projectsRouter.delete('/:id/modules/:moduleId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, moduleId } = c.req.param()

  // [TENANT] Anti-IDOR: verificar ownership do módulo
  const mod = await db.query.modules.findFirst({
    where: (m) => and(eq(m.id, moduleId), eq(m.projectId, projectId), eq(m.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!mod) return c.json({ error: 'Módulo não encontrado' }, 404)

  const epics = await db.select({ id: items.id })
    .from(items)
    .where(and(eq(items.moduleId, moduleId), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))

  const epicCount = epics.length

  const parsedBody = await parseOptionalJson(c, deleteModuleSchema)
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.data

  if (epicCount > 0 && !body.targetModuleId && !body.cascade) {
    return c.json({ error: 'Módulo possui épicos vinculados', epicCount }, 409)
  }

  if (epicCount > 0 && body.targetModuleId) {
    const targetModule = await db.query.modules.findFirst({
      where: (m) => and(eq(m.id, body.targetModuleId!), eq(m.projectId, projectId), eq(m.tenantId, ctx.tenantId)),
      columns: { id: true },
    })
    if (!targetModule) return c.json({ error: 'Módulo destino não encontrado' }, 400)

    // [TENANT] mover épicos para módulo destino
    await db.update(items)
      .set({ moduleId: body.targetModuleId })
      .where(and(eq(items.moduleId, moduleId), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))
  } else if (epicCount > 0 && body.cascade) {
    // excluir em cascata via BFS
    const allIds: string[] = epics.map(e => e.id)
    const queue = [...allIds]
    while (queue.length > 0) {
      const parentId = queue.shift()!
      const children = await db.select({ id: items.id })
        .from(items)
        .where(and(eq(items.parentId, parentId), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))
      for (const child of children) { allIds.push(child.id); queue.push(child.id) }
    }
    await db.transaction(async (tx) => {
      await tx.delete(itemTags).where(inArray(itemTags.itemId, allIds))
      await tx.delete(itemSprints).where(inArray(itemSprints.itemId, allIds))
      await tx.delete(attachments).where(inArray(attachments.itemId, allIds))
      await tx.delete(items).where(and(inArray(items.id, allIds), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))
    })
  }

  await db.delete(modules).where(and(eq(modules.id, moduleId), eq(modules.projectId, projectId), eq(modules.tenantId, ctx.tenantId)))
  return c.json({ ok: true })
})

// POST /projects/:id/squads
projectsRouter.post('/:id/squads', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!
  const parsed = await parseJson(c, squadSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const squadId = generateId()
  await db.insert(squads).values({
    id: squadId,
    tenantId: ctx.tenantId,
    projectId,
    name: body.name,
  })

  return c.json({ id: squadId, name: body.name }, 201)
})

// POST /projects/:id/squads/:squadId/members
projectsRouter.post('/:id/squads/:squadId/members', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, squadId } = c.req.param()
  const parsed = await parseJson(c, squadMemberSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const squad = await db.query.squads.findFirst({
    where: (candidate) => and(eq(candidate.id, squadId), eq(candidate.projectId, projectId), eq(candidate.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!squad) return c.json({ error: 'Squad não encontrado' }, 404)

  await db.insert(memberships).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: body.userId,
    projectId,
    squadId,
    role: body.role,
    createdAt: new Date().toISOString(),
  })

  return c.json({ ok: true }, 201)
})

// PATCH /projects/:id/members/:userId
projectsRouter.patch('/:id/members/:userId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, userId } = c.req.param()
  const parsed = await parseJson(c, projectMemberSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  // [TENANT] Filtra por tenantId — não permite alterar membros de projetos de outros tenants
  await db.update(memberships)
    .set({ role: body.role, squadId: body.squadId !== undefined ? (body.squadId || null) : undefined })
    .where(
      and(
        eq(memberships.tenantId, ctx.tenantId),
        eq(memberships.projectId, projectId),
        eq(memberships.userId, userId)
      )
    )

  return c.json({ ok: true })
})

// GET /projects/:id/members — listar membros com role, squad_id e squad_name
projectsRouter.get('/:id/members', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!

  // [TENANT] Join memberships + users + squads filtrado por tenantId + projectId
  const result = await db
    .select({
      userId: memberships.userId,
      role: memberships.role,
      squadId: memberships.squadId,
      squadName: squads.name,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(squads, and(eq(squads.id, memberships.squadId), eq(squads.projectId, projectId), eq(squads.tenantId, ctx.tenantId)))
    .where(and(eq(memberships.projectId, projectId), eq(memberships.tenantId, ctx.tenantId)))

  return c.json(result)
})

// GET /projects/:id/squads — listar squads com contagem de membros
projectsRouter.get('/:id/squads', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!

  // [TENANT] Duplo filtro: tenantId + projectId
  const projectSquads = await db.select().from(squads)
    .where(and(eq(squads.projectId, projectId), eq(squads.tenantId, ctx.tenantId)))
    .orderBy(asc(squads.createdAt))

  // Contar membros por squad sem N+1
  const memberCounts = await db.select({
    squadId: memberships.squadId,
    count: sql<number>`COUNT(*)`,
  })
    .from(memberships)
    .where(and(eq(memberships.projectId, projectId), eq(memberships.tenantId, ctx.tenantId)))
    .groupBy(memberships.squadId)

  const countMap = new Map(memberCounts.map(r => [r.squadId, r.count]))

  return c.json(projectSquads.map(sq => ({
    ...sq,
    memberCount: countMap.get(sq.id) ?? 0,
  })))
})

// DELETE /projects/:id/squads/:squadId/members/:userId — remover membro de squad
projectsRouter.delete('/:id/squads/:squadId/members/:userId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, squadId, userId } = c.req.param()

  await db.update(memberships)
    .set({ squadId: null })
    .where(
      and(
        eq(memberships.tenantId, ctx.tenantId),
        eq(memberships.projectId, projectId),
        eq(memberships.squadId, squadId),
        eq(memberships.userId, userId),
      )
    )

  return c.json({ ok: true })
})

// PATCH /projects/:id/squads/:squadId — renomear squad
projectsRouter.patch('/:id/squads/:squadId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, squadId } = c.req.param()
  const parsed = await parseJson(c, squadSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  // [TENANT] Anti-IDOR: verificar que squad pertence ao projeto do tenant
  const squad = await db.query.squads.findFirst({
    where: (s) => and(eq(s.id, squadId), eq(s.projectId, projectId), eq(s.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!squad) return c.json({ error: 'Squad não encontrado' }, 404)

  await db.update(squads)
    .set({ name: body.name })
    .where(and(eq(squads.id, squadId), eq(squads.projectId, projectId), eq(squads.tenantId, ctx.tenantId)))

  return c.json({ ok: true })
})

// DELETE /projects/:id/squads/:squadId — excluir squad (desassocia membros)
projectsRouter.delete('/:id/squads/:squadId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, squadId } = c.req.param()

  // [TENANT] Anti-IDOR: verificar que squad pertence ao tenant
  const squad = await db.query.squads.findFirst({
    where: (s) => and(eq(s.id, squadId), eq(s.projectId, projectId), eq(s.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!squad) return c.json({ error: 'Squad não encontrado' }, 404)

  // Contar membros associados — retornar aviso antes de excluir
  const memberCount = await db.select({ count: sql<number>`COUNT(*)` })
    .from(memberships)
    .where(and(eq(memberships.squadId, squadId), eq(memberships.tenantId, ctx.tenantId)))
  const count = memberCount[0]?.count ?? 0

  const parsedBody = await parseOptionalJson(c, confirmationSchema)
  if (!parsedBody.ok) return parsedBody.response
  const { confirm } = parsedBody.data
  if (count > 0 && !confirm) {
    return c.json({ warning: true, memberCount: count, message: `${count} membro(s) terão squad removido ao confirmar` }, 200)
  }

  await db.transaction(async (tx) => {
    // Desassociar membros do squad antes de excluir
    // [TENANT] filtra por tenantId para não afetar squads de outros tenants
    if (count > 0) {
      await tx.update(memberships)
        .set({ squadId: null })
        .where(and(eq(memberships.squadId, squadId), eq(memberships.tenantId, ctx.tenantId)))
    }
     await tx.delete(squads).where(and(eq(squads.id, squadId), eq(squads.projectId, projectId), eq(squads.tenantId, ctx.tenantId)))
  })

  return c.json({ ok: true })
})

// PATCH /projects/:id/members/:userId — atualizar squad e/ou papel do membro
projectsRouter.patch('/:id/members/:userId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, userId } = c.req.param()
  const parsed = await parseJson(c, projectMemberSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  if (body.squadId) {
    const squad = await db.query.squads.findFirst({
      where: (candidate) => and(eq(candidate.id, body.squadId!), eq(candidate.projectId, projectId), eq(candidate.tenantId, ctx.tenantId)),
      columns: { id: true },
    })
    if (!squad) return c.json({ error: 'Squad não encontrado neste projeto' }, 400)
  }

  const updates: Record<string, unknown> = {}
  if (body.role) updates.role = body.role
  if (body.squadId !== undefined) updates.squadId = body.squadId

  // [TENANT] Filtra por tenantId — não permite alterar membros de projetos de outros tenants
  const existingMember = await db.query.memberships.findFirst({
    where: (membership) => and(eq(membership.tenantId, ctx.tenantId), eq(membership.projectId, projectId), eq(membership.userId, userId)),
    columns: { id: true },
  })
  if (!existingMember) return c.json({ error: 'Membro não encontrado' }, 404)
  await db.update(memberships)
    .set(updates)
    .where(
      and(
        eq(memberships.tenantId, ctx.tenantId),
        eq(memberships.projectId, projectId),
        eq(memberships.userId, userId)
      )
    )

  return c.json({ ok: true })
})

// POST /projects/:id/members — adicionar membro ao projeto com role e squad opcionais
projectsRouter.post('/:id/members', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!
  const parsed = await parseJson(c, addProjectMemberSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  if (body.squadId) {
    const squad = await db.query.squads.findFirst({
      where: (candidate) => and(eq(candidate.id, body.squadId!), eq(candidate.projectId, projectId), eq(candidate.tenantId, ctx.tenantId)),
      columns: { id: true },
    })
    if (!squad) return c.json({ error: 'Squad não encontrado neste projeto' }, 400)
  }

  // Buscar usuário por email dentro do mesmo tenant
  // [TENANT] tenant_id garante que só usuários do mesmo tenant podem ser adicionados
  const user = await db.query.users.findFirst({
    where: (u) => and(eq(u.email, body.email), eq(u.tenantId, ctx.tenantId)),
    columns: { id: true, name: true, email: true, avatarUrl: true },
  })
  if (!user) return c.json({ error: 'Usuário não encontrado no tenant' }, 404)

  // Verificar se já é membro
  const existing = await db.query.memberships.findFirst({
    where: (m) => and(eq(m.userId, user.id), eq(m.projectId, projectId), eq(m.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (existing) return c.json({ error: 'Usuário já é membro do projeto' }, 409)

  await db.insert(memberships).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: user.id,
    projectId,
    squadId: body.squadId ?? null,
    role: body.role,
    createdAt: new Date().toISOString(),
  })

  return c.json({ ok: true, user }, 201)
})

// DELETE /projects/:id/members/:userId — remover membro do projeto
projectsRouter.delete('/:id/members/:userId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, userId } = c.req.param()

  // [TENANT] Anti-IDOR: verificar membership antes de remover
  const existingMember = await db.query.memberships.findFirst({
    where: (membership) => and(eq(membership.tenantId, ctx.tenantId), eq(membership.projectId, projectId), eq(membership.userId, userId)),
    columns: { id: true },
  })
  if (!existingMember) return c.json({ error: 'Membro não encontrado' }, 404)
  await db.delete(memberships)
    .where(
      and(
        eq(memberships.tenantId, ctx.tenantId),
        eq(memberships.projectId, projectId),
        eq(memberships.userId, userId)
      )
    )

  return c.json({ ok: true })
})

// GET /projects/:id/cost-centers — listar centros de custo ordenados por sort_order
projectsRouter.get('/:id/cost-centers', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!

  // [TENANT] Duplo filtro: tenantId + projectId
  const result = await db.select()
    .from(projectCostCenters)
    .where(and(eq(projectCostCenters.projectId, projectId), eq(projectCostCenters.tenantId, ctx.tenantId)))
    .orderBy(asc(projectCostCenters.sortOrder))

  return c.json(result)
})

// POST /projects/:id/cost-centers — criar centro de custo
projectsRouter.post('/:id/cost-centers', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!
  const parsed = await parseJson(c, costCenterSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  if (!body.code?.trim()) return c.json({ error: 'Código é obrigatório' }, 400)

  // Verificar unicidade de código por projeto
  // [TENANT] Anti-IDOR: garante que o código é único dentro do projeto do tenant
  const existing = await db.query.projectCostCenters.findFirst({
    where: (cc) => and(eq(cc.projectId, projectId), eq(cc.tenantId, ctx.tenantId), eq(cc.code, body.code.trim())),
    columns: { id: true },
  })
  if (existing) return c.json({ error: 'Código de centro de custo já existe neste projeto' }, 409)

  const currentList = await db.select({ sortOrder: projectCostCenters.sortOrder })
    .from(projectCostCenters)
    .where(and(eq(projectCostCenters.projectId, projectId), eq(projectCostCenters.tenantId, ctx.tenantId)))
    .orderBy(asc(projectCostCenters.sortOrder))

  const nextOrder = currentList.length > 0 ? (currentList[currentList.length - 1]!.sortOrder + 1) : 0

  const id = generateId()
  const now = new Date().toISOString()
  await db.insert(projectCostCenters).values({
    id,
    tenantId: ctx.tenantId,
    projectId,
    code: body.code.trim(),
    description: body.description?.trim(),
    sortOrder: nextOrder,
    createdAt: now,
  })

  return c.json({ id, code: body.code.trim(), description: body.description?.trim(), sortOrder: nextOrder }, 201)
})

// PATCH /projects/:id/cost-centers/:ccId — editar centro de custo
projectsRouter.patch('/:id/cost-centers/:ccId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, ccId } = c.req.param()
  const parsed = await parseJson(c, updateCostCenterSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  // [TENANT] Anti-IDOR: verificar ownership antes de atualizar
  const cc = await db.query.projectCostCenters.findFirst({
    where: (cc) => and(eq(cc.id, ccId), eq(cc.projectId, projectId), eq(cc.tenantId, ctx.tenantId)),
    columns: { id: true, code: true },
  })
  if (!cc) return c.json({ error: 'Centro de custo não encontrado' }, 404)

  if (body.code && body.code.trim() !== cc.code) {
    const duplicate = await db.query.projectCostCenters.findFirst({
      where: (c2) => and(eq(c2.projectId, projectId), eq(c2.tenantId, ctx.tenantId), eq(c2.code, body.code!.trim())),
      columns: { id: true },
    })
    if (duplicate) return c.json({ error: 'Código de centro de custo já existe neste projeto' }, 409)
  }

  const updates: Record<string, unknown> = {}
  if (body.code) updates.code = body.code.trim()
  if (body.description !== undefined) updates.description = body.description?.trim()

  await db.update(projectCostCenters)
    .set(updates)
    .where(and(eq(projectCostCenters.id, ccId), eq(projectCostCenters.projectId, projectId), eq(projectCostCenters.tenantId, ctx.tenantId)))

  return c.json({ ok: true })
})

// DELETE /projects/:id/cost-centers/:ccId — excluir centro de custo
projectsRouter.delete('/:id/cost-centers/:ccId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, ccId } = c.req.param()

  // [TENANT] Anti-IDOR: verificar ownership
  const cc = await db.query.projectCostCenters.findFirst({
    where: (cc) => and(eq(cc.id, ccId), eq(cc.projectId, projectId), eq(cc.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!cc) return c.json({ error: 'Centro de custo não encontrado' }, 404)

  // Verificar se há tasks associadas — não excluir se sim
  // [TENANT] filtra items pelo tenant para evitar contagem cross-tenant
  const associated = await db.select({ count: sql<number>`COUNT(*)` })
    .from(items)
    .where(and(eq(items.costCenterId, ccId), eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))
  const count = associated[0]?.count ?? 0
  if (count > 0) {
    return c.json({ error: `Centro de custo está associado a ${count} task(s). Reatribua-as antes de excluir.` }, 409)
  }

  await db.delete(projectCostCenters)
    .where(and(eq(projectCostCenters.id, ccId), eq(projectCostCenters.projectId, projectId), eq(projectCostCenters.tenantId, ctx.tenantId)))

  return c.json({ ok: true })
})
