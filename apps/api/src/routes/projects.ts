import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { eq, and, asc, inArray, sql } from 'drizzle-orm'
import { db } from '../db/index'
import { projects, memberships, modules, columns, squads, users, items, itemTags, itemSprints, attachments, projectVersions, projectCostCenters } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import { generateId } from '../utils/id'
import type { RequestContext } from '@azy-board/types'

export const projectsRouter = new Hono<HonoEnv>()
projectsRouter.use('*', authMiddleware)

// POST /projects — criar projeto
projectsRouter.post('/', async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const body = await c.req.json<{ name: string; description?: string; managerUserId?: string }>()

  const projectId = generateId()

  await db.insert(projects).values({
    id: projectId,
    // [TENANT] Projeto sempre vinculado ao tenant do criador
    tenantId: ctx.tenantId,
    name: body.name,
    description: body.description,
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

  // Módulo padrão "Geral" criado automaticamente
  await db.insert(modules).values({
    id: generateId(),
    tenantId: ctx.tenantId,
    projectId,
    name: 'Geral',
    position: 0,
  })

  // Colunas padrão do board — criadas na ordem de fluxo natural de trabalho
  const defaultColumns: Array<{ name: string; baseStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' }> = [
    { name: 'Backlog',     baseStatus: 'NOT_STARTED' },
    { name: 'A Fazer',     baseStatus: 'NOT_STARTED' },
    { name: 'Fazendo',     baseStatus: 'IN_PROGRESS' },
    { name: 'A Testar',    baseStatus: 'IN_PROGRESS' },
    { name: 'Testando',    baseStatus: 'IN_PROGRESS' },
    { name: 'Concluídas',  baseStatus: 'DONE'        },
  ]
  await db.insert(columns).values(
    defaultColumns.map((col, position) => ({
      id: generateId(),
      tenantId: ctx.tenantId,
      projectId,
      name: col.name,
      baseStatus: col.baseStatus,
      position,
    }))
  )

  return c.json({ id: projectId, name: body.name }, 201)
})

// GET /projects — listar projetos do usuário (apenas os que é membro)
projectsRouter.get('/', async (c) => {
  const ctx = c.get('ctx') as RequestContext

  // [TENANT] Filtra por tenantId + userId — anti-IDOR: usuário só vê seus projetos
  const result = await db
    .select({ project: projects })
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

  return c.json(result.map(r => r.project))
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
  const body = await c.req.json<{ name?: string; description?: string; managerUserId?: string | null }>()

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
  if (body.name) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description
  if (body.managerUserId !== undefined) updates.managerUserId = body.managerUserId

  // [TENANT] Filtra por tenantId — previne edição de projetos de outros tenants
  await db.update(projects).set(updates).where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)))

  return c.json({ ok: true })
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
  const { moduleId } = c.req.param()
  const body = await c.req.json<{ name?: string; position?: number }>()

  await db.update(modules)
    .set({ ...(body.name && { name: body.name }), ...(body.position !== undefined && { position: body.position }) })
    .where(and(eq(modules.id, moduleId), eq(modules.tenantId, ctx.tenantId)))

  return c.json({ ok: true })
})

// DELETE /projects/:id/modules/:moduleId — Tarefas 2.1-2.4
projectsRouter.delete('/:id/modules/:moduleId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { moduleId } = c.req.param()

  // [TENANT] Anti-IDOR: verificar ownership do módulo
  const mod = await db.query.modules.findFirst({
    where: (m) => and(eq(m.id, moduleId), eq(m.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!mod) return c.json({ error: 'Módulo não encontrado' }, 404)

  const epics = await db.select({ id: items.id })
    .from(items)
    .where(and(eq(items.moduleId, moduleId), eq(items.tenantId, ctx.tenantId)))

  const epicCount = epics.length

  let body: { targetModuleId?: string; cascade?: boolean } = {}
  try { body = await c.req.json() } catch { /* body vazio */ }

  if (epicCount > 0 && !body.targetModuleId && !body.cascade) {
    return c.json({ error: 'Módulo possui épicos vinculados', epicCount }, 409)
  }

  if (epicCount > 0 && body.targetModuleId) {
    // [TENANT] mover épicos para módulo destino
    await db.update(items)
      .set({ moduleId: body.targetModuleId })
      .where(and(eq(items.moduleId, moduleId), eq(items.tenantId, ctx.tenantId)))
  } else if (epicCount > 0 && body.cascade) {
    // excluir em cascata via BFS
    const allIds: string[] = epics.map(e => e.id)
    const queue = [...allIds]
    while (queue.length > 0) {
      const parentId = queue.shift()!
      const children = await db.select({ id: items.id })
        .from(items)
        .where(and(eq(items.parentId, parentId), eq(items.tenantId, ctx.tenantId)))
      for (const child of children) { allIds.push(child.id); queue.push(child.id) }
    }
    await db.transaction(async (tx) => {
      await tx.delete(itemTags).where(inArray(itemTags.itemId, allIds))
      await tx.delete(itemSprints).where(inArray(itemSprints.itemId, allIds))
      await tx.delete(attachments).where(inArray(attachments.itemId, allIds))
      await tx.delete(items).where(and(inArray(items.id, allIds), eq(items.tenantId, ctx.tenantId)))
    })
  }

  await db.delete(modules).where(and(eq(modules.id, moduleId), eq(modules.tenantId, ctx.tenantId)))
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
    .leftJoin(squads, eq(squads.id, memberships.squadId))
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
  const { squadId, userId } = c.req.param()

  await db.update(memberships)
    .set({ squadId: null })
    .where(
      and(
        eq(memberships.tenantId, ctx.tenantId),
        eq(memberships.squadId, squadId),
        eq(memberships.userId, userId),
      )
    )

  return c.json({ ok: true })
})

// PATCH /projects/:id/squads/:squadId — renomear squad
projectsRouter.patch('/:id/squads/:squadId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { squadId } = c.req.param()
  const body = await c.req.json<{ name: string }>()

  // [TENANT] Anti-IDOR: verificar que squad pertence ao projeto do tenant
  const squad = await db.query.squads.findFirst({
    where: (s) => and(eq(s.id, squadId), eq(s.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!squad) return c.json({ error: 'Squad não encontrado' }, 404)

  await db.update(squads)
    .set({ name: body.name })
    .where(and(eq(squads.id, squadId), eq(squads.tenantId, ctx.tenantId)))

  return c.json({ ok: true })
})

// DELETE /projects/:id/squads/:squadId — excluir squad (desassocia membros)
projectsRouter.delete('/:id/squads/:squadId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { squadId } = c.req.param()

  // [TENANT] Anti-IDOR: verificar que squad pertence ao tenant
  const squad = await db.query.squads.findFirst({
    where: (s) => and(eq(s.id, squadId), eq(s.tenantId, ctx.tenantId)),
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
    await tx.delete(squads).where(and(eq(squads.id, squadId), eq(squads.tenantId, ctx.tenantId)))
  })

  return c.json({ ok: true })
})

// PATCH /projects/:id/members/:userId — atualizar squad e/ou papel do membro
projectsRouter.patch('/:id/members/:userId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { id: projectId, userId } = c.req.param()
  const body = await c.req.json<{ role?: 'ADMIN' | 'MEMBER' | 'VIEWER'; squadId?: string | null }>()

  const updates: Record<string, unknown> = {}
  if (body.role) updates.role = body.role
  if (body.squadId !== undefined) updates.squadId = body.squadId

  // [TENANT] Filtra por tenantId — não permite alterar membros de projetos de outros tenants
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
    where: (cc) => and(eq(cc.id, ccId), eq(cc.tenantId, ctx.tenantId)),
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
    .where(and(eq(projectCostCenters.id, ccId), eq(projectCostCenters.tenantId, ctx.tenantId)))

  return c.json({ ok: true })
})

// DELETE /projects/:id/cost-centers/:ccId — excluir centro de custo
projectsRouter.delete('/:id/cost-centers/:ccId', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const { ccId } = c.req.param()

  // [TENANT] Anti-IDOR: verificar ownership
  const cc = await db.query.projectCostCenters.findFirst({
    where: (cc) => and(eq(cc.id, ccId), eq(cc.tenantId, ctx.tenantId)),
    columns: { id: true },
  })
  if (!cc) return c.json({ error: 'Centro de custo não encontrado' }, 404)

  // Verificar se há tasks associadas — não excluir se sim
  // [TENANT] filtra items pelo tenant para evitar contagem cross-tenant
  const associated = await db.select({ count: sql<number>`COUNT(*)` })
    .from(items)
    .where(and(eq(items.costCenterId, ccId), eq(items.tenantId, ctx.tenantId)))
  const count = associated[0]?.count ?? 0
  if (count > 0) {
    return c.json({ error: `Centro de custo está associado a ${count} task(s). Reatribua-as antes de excluir.` }, 409)
  }

  await db.delete(projectCostCenters)
    .where(and(eq(projectCostCenters.id, ccId), eq(projectCostCenters.tenantId, ctx.tenantId)))

  return c.json({ ok: true })
})
