import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { eq, and, asc, inArray, sql } from 'drizzle-orm'
import { db } from '../db/index'
import { projects, memberships, modules, columns, squads, users, items, itemTags, itemSprints, attachments, projectVersions, projectCostCenters, sprints, tags, checklists, checklistItems, itemLogs } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import { generateId } from '../utils/id'
import type { RequestContext, BoardMode, AncestorNode } from '@azy-board/types'

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

async function convertToSimple(tx: ProjectTransaction, tenantId: string, projectId: string, currentStoryId?: string | null) {
  const story = await findOrCreateSimpleStory(tx, tenantId, projectId, currentStoryId)
  const allItems = await tx.select().from(items)
    .where(and(eq(items.projectId, projectId), eq(items.tenantId, tenantId)))
  const taskItems = allItems.filter(item => item.type === 'TASK' || item.type === 'BUG')
  const hierarchyItems = allItems.filter(item => item.type === 'EPIC' || item.type === 'STORY')
  const path = JSON.stringify(simpleStoryPath(story))

  for (const item of taskItems) {
    await tx.update(items).set({ parentId: story.id, moduleId: null, ancestryPath: path, updatedAt: new Date().toISOString() })
      .where(and(eq(items.id, item.id), eq(items.tenantId, tenantId), eq(items.projectId, projectId)))
  }

  const removedIds = hierarchyItems.filter(item => item.id !== story.id).map(item => item.id)
  if (removedIds.length > 0) {
    await tx.delete(itemTags).where(inArray(itemTags.itemId, removedIds))
    await tx.delete(itemSprints).where(inArray(itemSprints.itemId, removedIds))
    await tx.delete(attachments).where(inArray(attachments.itemId, removedIds))
    await tx.delete(items).where(and(inArray(items.id, removedIds), eq(items.tenantId, tenantId), eq(items.projectId, projectId)))
  }

  await tx.delete(modules).where(and(eq(modules.projectId, projectId), eq(modules.tenantId, tenantId)))
  await tx.update(items).set({ parentId: null, moduleId: null, ancestryPath: '[]', updatedAt: new Date().toISOString() })
    .where(and(eq(items.id, story.id), eq(items.tenantId, tenantId), eq(items.projectId, projectId)))
  await tx.update(projects).set({ boardMode: 'SIMPLE', simpleStoryId: story.id })
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
  return story.id
}

async function convertToHierarchical(tx: ProjectTransaction, tenantId: string, projectId: string, currentStoryId?: string | null) {
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
  await tx.update(items).set({ parentId: epicId, moduleId: null, ancestryPath: storyPath, updatedAt: new Date().toISOString() })
    .where(and(eq(items.id, story.id), eq(items.tenantId, tenantId), eq(items.projectId, projectId)))
  const projectTasks = await tx.select({ id: items.id }).from(items)
    .where(and(eq(items.projectId, projectId), eq(items.tenantId, tenantId), inArray(items.type, ['TASK', 'BUG'])))
  for (const item of projectTasks) {
    await tx.update(items).set({ parentId: story.id, moduleId: null, ancestryPath: JSON.stringify([
      { id: epicId, title: epic?.title ?? 'Fluxo contínuo', type: 'EPIC' },
      { id: story.id, title: story.title, type: 'STORY' },
    ]), updatedAt: new Date().toISOString() })
      .where(and(eq(items.id, item.id), eq(items.tenantId, tenantId), eq(items.projectId, projectId)))
  }
  await tx.update(projects).set({ boardMode: 'HIERARCHICAL', simpleStoryId: story.id })
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
  return { moduleId, epicId, storyId: story.id }
}

// POST /projects — criar projeto
projectsRouter.post('/', async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const body = await c.req.json<{ name: string; description?: string; managerUserId?: string; boardMode?: BoardMode }>()
  const normalizedName = body.name.trim()
  if (!normalizedName) return c.json({ error: 'O nome do projeto é obrigatório' }, 400)
  const boardMode = body.boardMode ?? 'HIERARCHICAL'
  if (!['HIERARCHICAL', 'SIMPLE'].includes(boardMode)) return c.json({ error: 'Modo de board inválido' }, 400)

  // [TENANT] Impede nomes duplicados somente dentro do tenant autenticado.
  const duplicate = await db.query.projects.findFirst({
    where: (p) => and(eq(p.tenantId, ctx.tenantId), eq(p.name, normalizedName)),
    columns: { id: true },
  })
  if (duplicate) return c.json({ error: 'Já existe um projeto com esse nome' }, 409)

  const projectId = generateId()

  await db.insert(projects).values({
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
    managerUserId: body.managerUserId ?? null,
    createdAt: new Date().toISOString(),
  })

  // Criador se torna ADMIN automaticamente
  await db.insert(memberships).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    projectId,
    role: 'ADMIN',
    createdAt: new Date().toISOString(),
  })

  let simpleStoryId: string | null = null
  if (boardMode === 'HIERARCHICAL') {
    // Módulo padrão "Geral" criado automaticamente
    await db.insert(modules).values({
      id: generateId(),
      tenantId: ctx.tenantId,
      projectId,
      name: 'Geral',
      position: 0,
    })
  } else {
    const story = await findOrCreateSimpleStory(db as unknown as ProjectTransaction, ctx.tenantId, projectId)
    simpleStoryId = story.id
    await db.update(projects).set({ simpleStoryId }).where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)))
  }

  // Colunas padrão do board — criadas na ordem de fluxo natural de trabalho
  await db.insert(columns).values(
    DEFAULT_COLUMNS.map((col, position) => ({
      id: generateId(),
      tenantId: ctx.tenantId,
      projectId,
      name: col.name,
      baseStatus: col.baseStatus,
      position,
    }))
  )

  return c.json({ id: projectId, name: normalizedName, description: body.description ?? null, boardMode, simpleStoryId, role: 'ADMIN' as const }, 201)
})

// GET /projects — listar projetos do usuário (apenas os que é membro)
projectsRouter.get('/', async (c) => {
  const ctx = c.get('ctx') as RequestContext

  // [TENANT] Filtra por tenantId + userId — anti-IDOR: usuário só vê seus projetos
  const result = await db
    .select({ project: projects, role: memberships.role })
    .from(projects)
    .innerJoin(
      memberships,
      and(
        eq(memberships.projectId, projects.id),
        eq(memberships.userId, ctx.userId),
        eq(memberships.tenantId, ctx.tenantId)
      )
    )
    // [TENANT] Filtro adicional no projeto para garantir isolamento
    .where(eq(projects.tenantId, ctx.tenantId))

  const projectScope = c.get('apiKeyProjectScope')
  const scopedProjects = projectScope
    ? result.filter(r => projectScope.includes(r.project.id))
    : result
  return c.json(scopedProjects.map(r => ({ ...r.project, role: r.role })))
})

// GET /projects/:id/board — contexto estruturado para agentes
projectsRouter.get('/:id/board', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!

  // [TENANT] Todos os dados do contexto são limitados ao projeto do tenant autenticado.
  const project = await db.query.projects.findFirst({
    where: (p) => and(eq(p.id, projectId), eq(p.tenantId, ctx.tenantId)),
    columns: { id: true, name: true, description: true, boardMode: true, simpleStoryId: true },
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

  let requestBody: { dryRun?: boolean } = {}
  try { requestBody = await c.req.json() } catch { /* corpo opcional */ }
  if (requestBody.dryRun) {
    const [projectItems, projectModules, projectTags, projectSprints, projectVersionsRows, projectMembers, projectColumns, projectSquads] = await Promise.all([
      db.select({ id: items.id }).from(items).where(and(eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId))),
      db.select({ id: modules.id }).from(modules).where(and(eq(modules.projectId, projectId), eq(modules.tenantId, ctx.tenantId))),
      db.select({ id: tags.id }).from(tags).where(and(eq(tags.projectId, projectId), eq(tags.tenantId, ctx.tenantId))),
      db.select({ id: sprints.id }).from(sprints).where(and(eq(sprints.projectId, projectId), eq(sprints.tenantId, ctx.tenantId))),
      db.select({ id: projectVersions.id }).from(projectVersions).where(and(eq(projectVersions.projectId, projectId), eq(projectVersions.tenantId, ctx.tenantId))),
      db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.projectId, projectId), eq(memberships.tenantId, ctx.tenantId))),
      db.select({ id: columns.id }).from(columns).where(and(eq(columns.projectId, projectId), eq(columns.tenantId, ctx.tenantId))),
      db.select({ id: squads.id }).from(squads).where(and(eq(squads.projectId, projectId), eq(squads.tenantId, ctx.tenantId))),
    ])
    return c.json({ dryRun: true, projectId, counts: { items: projectItems.length, modules: projectModules.length, tags: projectTags.length, sprints: projectSprints.length, versions: projectVersionsRows.length, members: projectMembers.length, columns: projectColumns.length, squads: projectSquads.length } })
  }

  try {
    await db.transaction(async (tx) => {
      // [TENANT] IDs são obtidos exclusivamente do projeto do tenant autenticado.
      const projectItems = await tx.select({ id: items.id })
        .from(items)
        .where(and(eq(items.projectId, projectId), eq(items.tenantId, ctx.tenantId)))
      const itemIds = projectItems.map(item => item.id)

      if (itemIds.length > 0) {
        const projectChecklists = await tx.select({ id: checklists.id })
          .from(checklists)
          .where(and(inArray(checklists.itemId, itemIds), eq(checklists.tenantId, ctx.tenantId)))
        const checklistIds = projectChecklists.map(checklist => checklist.id)

        await tx.delete(itemTags).where(inArray(itemTags.itemId, itemIds))
        await tx.delete(itemSprints).where(inArray(itemSprints.itemId, itemIds))
        await tx.delete(attachments).where(inArray(attachments.itemId, itemIds))
        if (checklistIds.length > 0) {
          await tx.delete(checklistItems).where(and(inArray(checklistItems.checklistId, checklistIds), eq(checklistItems.tenantId, ctx.tenantId)))
          await tx.delete(checklists).where(and(inArray(checklists.id, checklistIds), eq(checklists.tenantId, ctx.tenantId)))
        }
        await tx.delete(itemLogs).where(and(inArray(itemLogs.itemId, itemIds), eq(itemLogs.tenantId, ctx.tenantId)))
        await tx.delete(items).where(and(inArray(items.id, itemIds), eq(items.tenantId, ctx.tenantId)))
      }

      // [TENANT] Todas as entidades são limitadas ao projeto e tenant antes da exclusão.
      const projectTags = await tx.select({ id: tags.id }).from(tags)
        .where(and(eq(tags.projectId, projectId), eq(tags.tenantId, ctx.tenantId)))
      const tagIds = projectTags.map(tag => tag.id)
      if (tagIds.length > 0) await tx.delete(itemTags).where(inArray(itemTags.tagId, tagIds))

      const projectSprints = await tx.select({ id: sprints.id }).from(sprints)
        .where(and(eq(sprints.projectId, projectId), eq(sprints.tenantId, ctx.tenantId)))
      const sprintIds = projectSprints.map(sprint => sprint.id)
      if (sprintIds.length > 0) await tx.delete(itemSprints).where(inArray(itemSprints.sprintId, sprintIds))
      await tx.delete(memberships).where(and(eq(memberships.projectId, projectId), eq(memberships.tenantId, ctx.tenantId)))
      await tx.delete(tags).where(and(eq(tags.projectId, projectId), eq(tags.tenantId, ctx.tenantId)))
      await tx.delete(sprints).where(and(eq(sprints.projectId, projectId), eq(sprints.tenantId, ctx.tenantId)))
      await tx.delete(projectVersions).where(and(eq(projectVersions.projectId, projectId), eq(projectVersions.tenantId, ctx.tenantId)))
      await tx.delete(projectCostCenters).where(and(eq(projectCostCenters.projectId, projectId), eq(projectCostCenters.tenantId, ctx.tenantId)))
      await tx.delete(modules).where(and(eq(modules.projectId, projectId), eq(modules.tenantId, ctx.tenantId)))
      await tx.delete(columns).where(and(eq(columns.projectId, projectId), eq(columns.tenantId, ctx.tenantId)))
      await tx.delete(squads).where(and(eq(squads.projectId, projectId), eq(squads.tenantId, ctx.tenantId)))
      await tx.delete(projects).where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)))
    })
  } catch {
    return c.json({ error: 'Não foi possível excluir o projeto' }, 500)
  }

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
      where: (u) => eq(u.id, project.managerUserId!),
      columns: { id: true, name: true, email: true, avatarUrl: true },
    })
  }

  return c.json({ ...project, manager })
})

// PATCH /projects/:id — editar projeto (apenas ADMIN)
projectsRouter.patch('/:id', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const id = c.req.param('id')!
  const body = await c.req.json<{ name?: string; description?: string; managerUserId?: string | null; boardMode?: BoardMode; dryRun?: boolean }>()

  if (body.boardMode !== undefined && !['HIERARCHICAL', 'SIMPLE'].includes(body.boardMode)) {
    return c.json({ error: 'Modo de board inválido' }, 400)
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
  const boardModeChanged = body.boardMode !== undefined && body.boardMode !== currentProject.boardMode
  if (body.boardMode !== undefined && !boardModeChanged) updates.boardMode = body.boardMode

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
          await convertToSimple(tx, ctx.tenantId, id, currentProject.simpleStoryId)
        } else {
          await convertToHierarchical(tx, ctx.tenantId, id, currentProject.simpleStoryId)
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
  const body = await c.req.json<{ name: string; description?: string }>()

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
  const body = await c.req.json<{ name?: string; position?: number }>()

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

  let body: { targetModuleId?: string; cascade?: boolean } = {}
  try { body = await c.req.json() } catch { /* body vazio */ }

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
  const body = await c.req.json<{ name: string }>()

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
  const body = await c.req.json<{ userId: string; role: 'ADMIN' | 'MEMBER' | 'VIEWER' }>()

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
  const body = await c.req.json<{ role: 'ADMIN' | 'MEMBER' | 'VIEWER'; squadId?: string | null }>()

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
  const body = await c.req.json<{ name: string }>()

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

  const { confirm } = await c.req.json<{ confirm?: boolean }>().catch(() => ({ confirm: false }))
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
  const body = await c.req.json<{ role?: 'ADMIN' | 'MEMBER' | 'VIEWER'; squadId?: string | null }>()

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
  const body = await c.req.json<{ email: string; role: 'ADMIN' | 'MEMBER' | 'VIEWER'; squadId?: string | null }>()

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
  const body = await c.req.json<{ code: string; description?: string }>()

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
  const body = await c.req.json<{ code?: string; description?: string }>()

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
