import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { HonoEnv } from '../types/hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import type { RequestContext } from '@azy-board/api-contracts'
import { hasGlobalGroup } from '../services/auth'
import { hasKeyPermission } from '../services/authorization'
import { triggerStorageCleanupAfterCommit } from '../services/storageCleanup'
import { confirmationSchema, createProjectSchema, parseJson, parseOptionalJson, updateProjectSchema } from '../validation'
import { addProjectMemberSchema, costCenterSchema, deleteModuleSchema, moduleSchema, projectMemberSchema, squadMemberSchema, squadSchema, updateCostCenterSchema, updateModuleSchema, updateSquadSchema } from '../validation'
import { persistence } from '../persistence/runtime'
import { userMutationContext, userPersistenceContext } from '../persistence/context'
import type { ProjectPatch } from '../persistence/ports'
import { COMMAND_NAMESPACES } from '../persistence/idempotency'
import { runMetadataMutation } from '../services/metadataIdempotency'
import { logger } from '../services/logger'

// Card T25 — erros de pré-condição/conflito das mutações de cadastros.
function metadataMutationError(c: { json: (body: unknown, status: ContentfulStatusCode) => Response }, error: unknown): Response | null {
  const message = error instanceof Error ? error.message : ''
  if (message === 'PRECONDITION_FAILED') return c.json({ error: 'Os dados mudaram desde a aprovação; refaça a prévia.', code: 'CONFLICT', retryable: false }, 409)
  if (message === 'SQUAD_NOT_IN_PROJECT') return c.json({ error: 'Squad não encontrado neste projeto' }, 400)
  if (message === 'COST_CENTER_CODE_DUPLICATE') return c.json({ error: 'Código de centro de custo já existe neste projeto' }, 409)
  return null
}

export const projectsRouter = new Hono<HonoEnv>()
projectsRouter.use('*', authMiddleware)

const DEFAULT_COLUMNS: Array<{ name: string; baseStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' }> = [
  { name: 'Backlog', baseStatus: 'NOT_STARTED' },
  { name: 'A Fazer', baseStatus: 'NOT_STARTED' },
  { name: 'Fazendo', baseStatus: 'IN_PROGRESS' },
  { name: 'A Testar', baseStatus: 'IN_PROGRESS' },
  { name: 'Testando', baseStatus: 'IN_PROGRESS' },
  { name: 'Concluídas', baseStatus: 'DONE' },
]

// Sinalizadores de visibilidade são opcionais, mas quando enviados precisam ser booleanos.
function ehBooleanoOuAusente(valor: unknown): boolean {
  return valor === undefined || typeof valor === 'boolean'
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
  const duplicate = (await persistence.projects.listProjects(userPersistenceContext(ctx), { includeHidden: true }))
    .some(project => project.name === normalizedName)
  if (duplicate) return c.json({ error: 'Já existe um projeto com esse nome' }, 409)

  const created = await persistence.unitOfWork.createProjectAggregate(
    userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST'),
    {
      project: {
        name: normalizedName,
        description: body.description ?? null,
        boardMode,
        managerUserId: body.managerUserId ?? ctx.userId,
        isRestricted,
        isHidden,
        advancedChecklists: body.advancedChecklists ?? false,
        startDate: body.startDate ?? null,
        plannedEndDate: body.plannedEndDate ?? null,
        plannedPoints: body.plannedPoints ?? null,
        plannedHours: body.plannedHours ?? null,
        scope: body.scope ?? null,
        icon: body.icon ?? null,
        color: body.color ?? null,
      },
      defaultColumns: DEFAULT_COLUMNS,
      defaultModuleName: 'Geral',
      simpleStoryTitle: 'Fluxo contínuo',
    },
  )

  return c.json({ ...created, role: 'ADMIN' as const }, 201)
})

// GET /projects — listar projetos visíveis para o usuário (membros veem os que participam)
projectsRouter.get('/', async (c) => {
  const ctx = c.get('ctx') as RequestContext
  if (!hasKeyPermission(c.get('apiKeyPermissionScope'), 'VIEWER')) return c.json({ error: 'Permissão insuficiente', code: 'FORBIDDEN', retryable: false }, 403)

  // Projetos ocultos só são retornados com includeHidden=true — qualquer outro valor é ignorado.
  const includeHidden = c.req.query('includeHidden') === 'true'

  const persistenceContext = userPersistenceContext(ctx)
  const tenantProjects = await persistence.projects.listProjects(persistenceContext, { includeHidden })
  const candidates = await Promise.all(tenantProjects.map(async project => ({
    project,
    membership: await persistence.projects.getMembership(persistenceContext, project.id, ctx.userId),
  })))
  const visibleProjects = candidates.filter(({ project, membership }) => {
    const associated = Boolean(membership || project.managerUserId === ctx.userId)
    if (project.isRestricted && !associated) return false
    return hasGlobalGroup(ctx.globalGroup, 'ADMIN') || associated
  })

  const projectScope = c.get('apiKeyProjectScope')
  const scopedProjects = projectScope
    ? visibleProjects.filter(row => projectScope.includes(row.project.id))
    : visibleProjects
  return c.json(scopedProjects.map(({ project, membership }) => ({
    ...project,
    role: membership?.role ?? (hasGlobalGroup(ctx.globalGroup, 'ADMIN') ? 'ADMIN' as const : 'MEMBER' as const),
  })))
})

// GET /projects/:id/board — contexto estruturado para agentes
projectsRouter.get('/:id/board', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!
  const projectContext = userPersistenceContext(ctx)

  const storedProject = await persistence.projects.getProject(projectContext, projectId)
  const project = storedProject ? {
    id: storedProject.id, name: storedProject.name, description: storedProject.description,
    boardMode: storedProject.boardMode, simpleStoryId: storedProject.simpleStoryId,
    advancedChecklists: storedProject.advancedChecklists, startDate: storedProject.startDate,
    plannedEndDate: storedProject.plannedEndDate, plannedPoints: storedProject.plannedPoints,
    plannedHours: storedProject.plannedHours, scope: storedProject.scope,
    icon: storedProject.icon, color: storedProject.color,
  } : null
  if (!project) return c.json({ error: 'Projeto não encontrado' }, 404)

  const [boardColumns, boardModules, boardItems] = await Promise.all([
    persistence.projects.listColumns(projectContext, projectId),
    persistence.projects.listModules(projectContext, projectId),
    persistence.items.listItems(projectContext, projectId),
  ])

  return c.json({ project, columns: boardColumns, modules: boardModules, items: boardItems })
})

// DELETE /projects/:id — excluir projeto e todos os registros dependentes
projectsRouter.delete('/:id', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!

  const projectContext = userPersistenceContext(ctx)
  const project = await persistence.projects.getProject(projectContext, projectId)
  if (!project) return c.json({ error: 'Projeto não encontrado' }, 404)

  const parsedBody = await parseOptionalJson(c, confirmationSchema)
  if (!parsedBody.ok) return parsedBody.response
  const requestBody = parsedBody.data
  if (requestBody.dryRun) {
    const [projectItems, projectModules, projectTags, projectSprints, projectVersionsRows, projectMembers, projectColumns, projectSquads, projectConversations] = await Promise.all([
      persistence.items.listItems(projectContext, projectId),
      persistence.projects.listModules(projectContext, projectId),
      persistence.planning.listTags(projectContext, projectId),
      persistence.planning.listSprints(projectContext, projectId),
      persistence.planning.listVersions(projectContext, projectId),
      persistence.projects.listProjectMembers(projectContext, projectId),
      persistence.projects.listColumns(projectContext, projectId),
      persistence.projects.listSquads(projectContext, projectId),
      persistence.agent.countProjectConversations(projectContext, projectId),
    ])
    return c.json({ dryRun: true, projectId, counts: { items: projectItems.length, modules: projectModules.length, tags: projectTags.length, sprints: projectSprints.length, versions: projectVersionsRows.length, members: projectMembers.length, columns: projectColumns.length, squads: projectSquads.length, conversations: projectConversations } })
  }

  try {
    await persistence.unitOfWork.deleteProjectAggregate(
      userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST'), projectId,
    )
  } catch (error) {
    logger.error('falha ao excluir projeto', { projectId, error: error instanceof Error ? error.message : 'erro desconhecido' })
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

  const persistenceContext = userPersistenceContext(ctx)
  const project = await persistence.projects.getProject(persistenceContext, id)

  if (!project) return c.json({ error: 'Projeto não encontrado' }, 404)

  // Incluir dados do gerente se definido
  let manager = null
  if (project.managerUserId) {
    const user = await persistence.identity.findUser(persistenceContext, project.managerUserId)
    manager = user ? { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl } : null
  }

  const projectModules = await persistence.projects.listModules(persistenceContext, id)
  return c.json({ ...project, modules: projectModules, manager })
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
  const projectContext = userPersistenceContext(ctx)
  const currentProject = await persistence.projects.getProject(projectContext, id)
  if (!currentProject) return c.json({ error: 'Projeto não encontrado' }, 404)

  let normalizedName: string | undefined
  if (body.name !== undefined) {
    normalizedName = body.name.trim()
    if (!normalizedName) return c.json({ error: 'O nome do projeto é obrigatório' }, 400)

    // [TENANT] Verifica duplicidade somente entre projetos do tenant atual.
    const duplicate = (await persistence.projects.listProjects(projectContext, { includeHidden: true }))
      .find(project => project.name === normalizedName)
    if (duplicate && duplicate.id !== id) {
      return c.json({ error: 'Já existe um projeto com esse nome' }, 409)
    }
  }

  // Validar que o gerente indicado é membro do projeto
  if (body.managerUserId) {
    // [TENANT] Anti-IDOR: verificar membership do gerente no mesmo tenant
    const membership = await persistence.projects.getMembership(projectContext, id, body.managerUserId)
    if (!membership) return c.json({ error: 'O gerente deve ser membro do projeto' }, 422)
  }

  const updates: ProjectPatch = {}
  if (normalizedName !== undefined) updates.name = normalizedName
  if (body.description !== undefined) updates.description = body.description
  if (body.managerUserId !== undefined) updates.managerUserId = body.managerUserId
  if (body.startDate !== undefined) updates.startDate = body.startDate
  if (body.plannedEndDate !== undefined) updates.plannedEndDate = body.plannedEndDate
  if (body.plannedPoints !== undefined) updates.plannedPoints = body.plannedPoints
  if (body.plannedHours !== undefined) updates.plannedHours = body.plannedHours
  if (body.scope !== undefined) updates.scope = body.scope
  if (body.icon !== undefined) updates.icon = body.icon
  if (body.color !== undefined) updates.color = body.color
  const boardModeChanged = body.boardMode !== undefined && body.boardMode !== currentProject.boardMode
  if (body.boardMode !== undefined && !boardModeChanged) updates.boardMode = body.boardMode
  if (body.isRestricted !== undefined) updates.isRestricted = body.isRestricted
  if (body.isHidden !== undefined) updates.isHidden = body.isHidden
  if (body.advancedChecklists !== undefined) updates.advancedChecklists = body.advancedChecklists

  if (boardModeChanged && body.dryRun) {
    const [projectItems, projectModules] = await Promise.all([
      persistence.items.listItems(projectContext, id),
      persistence.projects.listModules(projectContext, id),
    ])
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
      await persistence.unitOfWork.convertProjectBoardMode(
        userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST'), id, body.boardMode!, updates,
      )
    } catch {
      return c.json({ error: 'Não foi possível converter o formato do board' }, 500)
    }
  } else if (Object.keys(updates).length > 0) {
    // [TENANT] Filtra por tenantId — previne edição de projetos de outros tenants.
    await persistence.projects.updateProject(projectContext, id, updates)
  }

  const updatedProject = await persistence.projects.getProject(projectContext, id)
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

  const created = await persistence.projects.createModule(userPersistenceContext(ctx), projectId, {
    name: body.name, description: body.description ?? null,
  })


  return c.json({ id: created.id, name: created.name }, 201)
})

// GET /projects/:id/modules
projectsRouter.get('/:id/modules', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!

  const result = await persistence.projects.listModules(userPersistenceContext(ctx), projectId)

  return c.json(result)
})

// PATCH /projects/:id/modules/:moduleId
projectsRouter.patch('/:id/modules/:moduleId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, moduleId } = c.req.param()
  const parsed = await parseJson(c, updateModuleSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const projectContext = userPersistenceContext(ctx)

  const existing = await persistence.projects.getModule(projectContext, projectId, moduleId)
  if (!existing) return c.json({ error: 'Módulo não encontrado' }, 404)
  const changed = body.name !== undefined && body.name !== existing.name

  try {
    const outcome = await runMetadataMutation({
      ctx, projectId, namespace: COMMAND_NAMESPACES.updateModule,
      idempotencyKey: c.req.header('Idempotency-Key'),
      payload: { moduleId, name: body.name ?? null, position: body.position ?? null, expectedName: body.expectedName ?? null },
      execute: async () => {
        const updated = await persistence.projects.updateModule(projectContext, projectId, moduleId, {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.position !== undefined ? { position: body.position } : {}),
          ...(body.expectedName !== undefined ? { expectedName: body.expectedName } : {}),
        })
        if (!updated) throw new Error('PRECONDITION_FAILED')
        return { status: 200 as const, body: { ok: true, changed, module: { id: moduleId, name: body.name ?? existing.name }, previous: { name: existing.name } } }
      },
    })
    if (outcome.kind === 'conflict') {
      return c.json({ error: outcome.reason === 'payload' ? 'A chave já foi usada com outro payload' : 'Operação em andamento; tente novamente.', code: 'IDEMPOTENCY_CONFLICT', retryable: outcome.reason === 'in-flight' }, 409)
    }
    return c.json(outcome.body, outcome.status)
  } catch (error) {
    const response = metadataMutationError(c, error)
    if (response) return response
    throw error
  }
})

// DELETE /projects/:id/modules/:moduleId — Tarefas 2.1-2.4
projectsRouter.delete('/:id/modules/:moduleId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, moduleId } = c.req.param()

  const projectContext = userPersistenceContext(ctx)
  const mod = await persistence.projects.getModule(projectContext, projectId, moduleId)
  if (!mod) return c.json({ error: 'Módulo não encontrado' }, 404)

  const epics = await persistence.items.listItems(projectContext, projectId, { types: ['EPIC'], moduleId })

  const epicCount = epics.length

  const parsedBody = await parseOptionalJson(c, deleteModuleSchema)
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.data

  if (epicCount > 0 && !body.targetModuleId && !body.cascade) {
    return c.json({ error: 'Módulo possui épicos vinculados', epicCount }, 409)
  }

  if (epicCount > 0 && body.targetModuleId) {
    const targetModule = await persistence.projects.getModule(projectContext, projectId, body.targetModuleId)
    if (!targetModule) return c.json({ error: 'Módulo destino não encontrado' }, 400)
  }

  const outcome = await persistence.unitOfWork.deleteModuleAggregate(
    userMutationContext(ctx, c.get('apiKeyId') ? 'MCP' : 'REST'),
    projectId,
    moduleId,
    { targetModuleId: body.targetModuleId ?? null, cascade: body.cascade ?? false },
  )
  if (!outcome.deleted) return c.json({ error: 'Módulo não encontrado' }, 404)
  if (outcome.deletedItemCount > 0) triggerStorageCleanupAfterCommit()
  return c.json({ ok: true })
})

// POST /projects/:id/squads
projectsRouter.post('/:id/squads', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!
  const parsed = await parseJson(c, squadSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const created = await persistence.projects.createSquad(userPersistenceContext(ctx), projectId, { name: body.name })

  return c.json({ id: created.id, name: created.name }, 201)
})

// POST /projects/:id/squads/:squadId/members
projectsRouter.post('/:id/squads/:squadId/members', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, squadId } = c.req.param()
  const parsed = await parseJson(c, squadMemberSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const squad = await persistence.projects.getSquad(userPersistenceContext(ctx), projectId, squadId)
  if (!squad) return c.json({ error: 'Squad não encontrado' }, 404)

  await persistence.projects.addSquadMember(userPersistenceContext(ctx), projectId, squadId, { userId: body.userId, role: body.role })

  return c.json({ ok: true }, 201)
})

// PATCH /projects/:id/members/:userId
projectsRouter.patch('/:id/members/:userId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, userId } = c.req.param()
  const parsed = await parseJson(c, projectMemberSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const projectContext = userPersistenceContext(ctx)

  const existing = await persistence.projects.getMembership(projectContext, projectId, userId)
  if (!existing) return c.json({ error: 'Membro não encontrado' }, 404)
  if (body.squadId) {
    const squad = await persistence.projects.getSquad(projectContext, projectId, body.squadId)
    if (!squad) return c.json({ error: 'Squad não encontrado neste projeto' }, 400)
  }

  const nextSquadId = body.squadId !== undefined ? (body.squadId || null) : undefined
  const changed = (body.role !== undefined && body.role !== existing.role) || (nextSquadId !== undefined && nextSquadId !== existing.squadId)

  try {
    const outcome = await runMetadataMutation({
      ctx, projectId, namespace: COMMAND_NAMESPACES.setMemberSquad,
      idempotencyKey: c.req.header('Idempotency-Key'),
      payload: { userId, role: body.role ?? null, squadId: nextSquadId ?? null, expectedSquadId: body.expectedSquadId ?? null, expectedRole: body.expectedRole ?? null },
      execute: async () => {
        await persistence.projects.updateProjectMember(projectContext, projectId, userId, {
          ...(body.role !== undefined ? { role: body.role } : {}),
          ...(nextSquadId !== undefined ? { squadId: nextSquadId } : {}),
          ...(body.expectedSquadId !== undefined ? { expectedSquadId: body.expectedSquadId } : {}),
          ...(body.expectedRole !== undefined ? { expectedRole: body.expectedRole } : {}),
        })
        const updated = await persistence.projects.getMembership(projectContext, projectId, userId)
        return {
          status: 200,
          body: {
            ok: true, changed,
            member: { userId, role: updated?.role, squadId: updated?.squadId },
            previous: { role: existing.role, squadId: existing.squadId },
          },
        }
      },
    })
    if (outcome.kind === 'conflict') {
      return c.json({ error: outcome.reason === 'payload' ? 'A chave já foi usada com outro payload' : 'Operação em andamento; tente novamente.', code: 'IDEMPOTENCY_CONFLICT', retryable: outcome.reason === 'in-flight' }, 409)
    }
    return c.json(outcome.body, outcome.status)
  } catch (error) {
    const response = metadataMutationError(c, error)
    if (response) return response
    throw error
  }
})

// GET /projects/:id/members — listar membros com role, squad_id e squad_name
projectsRouter.get('/:id/members', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!

  const result = await persistence.projects.listProjectMembers(userPersistenceContext(ctx), projectId)

  return c.json(result)
})

// GET /projects/:id/squads — listar squads com contagem de membros
projectsRouter.get('/:id/squads', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!

  return c.json(await persistence.projects.listSquads(userPersistenceContext(ctx), projectId))
})

// DELETE /projects/:id/squads/:squadId/members/:userId — remover membro de squad
projectsRouter.delete('/:id/squads/:squadId/members/:userId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, squadId, userId } = c.req.param()

  await persistence.projects.removeSquadMember(userPersistenceContext(ctx), projectId, squadId, userId)

  return c.json({ ok: true })
})

// PATCH /projects/:id/squads/:squadId — renomear squad
projectsRouter.patch('/:id/squads/:squadId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, squadId } = c.req.param()
  const parsed = await parseJson(c, updateSquadSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const projectContext = userPersistenceContext(ctx)

  const squad = await persistence.projects.getSquad(projectContext, projectId, squadId)
  if (!squad) return c.json({ error: 'Squad não encontrado' }, 404)
  const changed = body.name !== squad.name

  try {
    const outcome = await runMetadataMutation({
      ctx, projectId, namespace: COMMAND_NAMESPACES.updateSquad,
      idempotencyKey: c.req.header('Idempotency-Key'),
      payload: { squadId, name: body.name, expectedName: body.expectedName ?? null },
      execute: async () => {
        const updated = await persistence.projects.updateSquad(projectContext, projectId, squadId, body.name, body.expectedName)
        if (!updated) throw new Error('PRECONDITION_FAILED')
        return { status: 200 as const, body: { ok: true, changed, squad: { id: squadId, name: body.name }, previous: { name: squad.name } } }
      },
    })
    if (outcome.kind === 'conflict') {
      return c.json({ error: outcome.reason === 'payload' ? 'A chave já foi usada com outro payload' : 'Operação em andamento; tente novamente.', code: 'IDEMPOTENCY_CONFLICT', retryable: outcome.reason === 'in-flight' }, 409)
    }
    return c.json(outcome.body, outcome.status)
  } catch (error) {
    const response = metadataMutationError(c, error)
    if (response) return response
    throw error
  }
})

// DELETE /projects/:id/squads/:squadId — excluir squad (desassocia membros)
projectsRouter.delete('/:id/squads/:squadId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, squadId } = c.req.param()

  const squad = await persistence.projects.getSquad(userPersistenceContext(ctx), projectId, squadId)
  if (!squad) return c.json({ error: 'Squad não encontrado' }, 404)

  // Contar membros associados — retornar aviso antes de excluir
  const count = (await persistence.projects.listSquads(userPersistenceContext(ctx), projectId))
    .find(candidate => candidate.id === squadId)?.memberCount ?? 0

  const parsedBody = await parseOptionalJson(c, confirmationSchema)
  if (!parsedBody.ok) return parsedBody.response
  const { confirm } = parsedBody.data
  if (count > 0 && !confirm) {
    return c.json({ warning: true, memberCount: count, message: `${count} membro(s) terão squad removido ao confirmar` }, 200)
  }

  await persistence.projects.deleteSquad(userPersistenceContext(ctx), projectId, squadId)

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
    const squad = await persistence.projects.getSquad(userPersistenceContext(ctx), projectId, body.squadId)
    if (!squad) return c.json({ error: 'Squad não encontrado neste projeto' }, 400)
  }

  // Buscar usuário por email dentro do mesmo tenant
  // [TENANT] tenant_id garante que só usuários do mesmo tenant podem ser adicionados
  const foundUser = await persistence.identity.findUserByCanonicalEmail(body.email)
  if (!foundUser || foundUser.tenantId !== ctx.tenantId) return c.json({ error: 'Usuário não encontrado no tenant' }, 404)
  const user = { id: foundUser.id, name: foundUser.name, email: foundUser.email, avatarUrl: foundUser.avatarUrl }

  // Verificar se já é membro
  const existing = await persistence.projects.getMembership(userPersistenceContext(ctx), projectId, user.id)
  if (existing) return c.json({ error: 'Usuário já é membro do projeto' }, 409)

  await persistence.projects.addProjectMember(userPersistenceContext(ctx), projectId, {
    userId: user.id, squadId: body.squadId ?? null, role: body.role,
  })

  return c.json({ ok: true, user }, 201)
})

// DELETE /projects/:id/members/:userId — remover membro do projeto
projectsRouter.delete('/:id/members/:userId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, userId } = c.req.param()

  const existingMember = await persistence.projects.getMembership(userPersistenceContext(ctx), projectId, userId)
  if (!existingMember) return c.json({ error: 'Membro não encontrado' }, 404)
  await persistence.projects.removeProjectMember(userPersistenceContext(ctx), projectId, userId)

  return c.json({ ok: true })
})

// GET /projects/:id/cost-centers — listar centros de custo ordenados por sort_order
projectsRouter.get('/:id/cost-centers', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!

  const result = await persistence.planning.listCostCenters(userPersistenceContext(ctx), projectId)

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

  const projectContext = userPersistenceContext(ctx)
  const existing = (await persistence.planning.listCostCenters(projectContext, projectId))
    .some(costCenter => costCenter.code === body.code!.trim())
  if (existing) return c.json({ error: 'Código de centro de custo já existe neste projeto' }, 409)

  const created = await persistence.planning.createCostCenter(projectContext, projectId, {
    code: body.code.trim(), description: body.description?.trim() ?? null,
  })

  return c.json({ id: created.id, code: created.code, description: created.description, sortOrder: created.sortOrder }, 201)
})

// PATCH /projects/:id/cost-centers/:ccId — editar centro de custo
projectsRouter.patch('/:id/cost-centers/:ccId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, ccId } = c.req.param()
  const parsed = await parseJson(c, updateCostCenterSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const projectContext = userPersistenceContext(ctx)
  const cc = await persistence.planning.getCostCenter(projectContext, projectId, ccId)
  if (!cc) return c.json({ error: 'Centro de custo não encontrado' }, 404)

  const nextCode = body.code !== undefined ? body.code.trim() : undefined
  const changed = (nextCode !== undefined && nextCode !== cc.code) || (body.description !== undefined && (body.description?.trim() ?? null) !== cc.description)

  try {
    const outcome = await runMetadataMutation({
      ctx, projectId, namespace: COMMAND_NAMESPACES.updateCostCenter,
      idempotencyKey: c.req.header('Idempotency-Key'),
      payload: { costCenterId: ccId, code: nextCode ?? null, description: body.description?.trim() ?? null, expectedCode: body.expectedCode ?? null },
      execute: async () => {
        if (nextCode !== undefined && nextCode !== cc.code) {
          const duplicate = (await persistence.planning.listCostCenters(projectContext, projectId)).some(costCenter => costCenter.code === nextCode)
          if (duplicate) throw new Error('COST_CENTER_CODE_DUPLICATE')
        }
        const updated = await persistence.planning.updateCostCenter(projectContext, projectId, ccId, {
          ...(nextCode !== undefined ? { code: nextCode } : {}),
          ...(body.description !== undefined ? { description: body.description?.trim() ?? null } : {}),
          ...(body.expectedCode !== undefined ? { expectedCode: body.expectedCode } : {}),
        })
        return {
          status: 200,
          body: {
            ok: true, changed,
            costCenter: { id: ccId, code: updated?.code ?? cc.code, description: updated?.description ?? cc.description },
            previous: { code: cc.code, description: cc.description },
          },
        }
      },
    })
    if (outcome.kind === 'conflict') {
      return c.json({ error: outcome.reason === 'payload' ? 'A chave já foi usada com outro payload' : 'Operação em andamento; tente novamente.', code: 'IDEMPOTENCY_CONFLICT', retryable: outcome.reason === 'in-flight' }, 409)
    }
    return c.json(outcome.body, outcome.status)
  } catch (error) {
    const response = metadataMutationError(c, error)
    if (response) return response
    throw error
  }
})

// DELETE /projects/:id/cost-centers/:ccId — excluir centro de custo
projectsRouter.delete('/:id/cost-centers/:ccId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, ccId } = c.req.param()

  const projectContext = userPersistenceContext(ctx)
  const cc = await persistence.planning.getCostCenter(projectContext, projectId, ccId)
  if (!cc) return c.json({ error: 'Centro de custo não encontrado' }, 404)

  const count = (await persistence.items.listItems(projectContext, projectId, { costCenterId: ccId })).length
  if (count > 0) {
    return c.json({ error: `Centro de custo está associado a ${count} task(s). Reatribua-as antes de excluir.` }, 409)
  }

  await persistence.planning.deleteCostCenter(projectContext, projectId, ccId)

  return c.json({ ok: true })
})
