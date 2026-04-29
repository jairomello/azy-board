import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { eq, and, asc, inArray } from 'drizzle-orm'
import { db } from '../db/index'
import { projects, memberships, modules, squads, users, items, itemTags, itemSprints, attachments, projectVersions } from '../db/schema'
import { authMiddleware, requireRole } from '../middleware/auth'
import { generateId } from '../utils/id'
import type { RequestContext } from '@azy-board/types'

export const projectsRouter = new Hono<HonoEnv>()
projectsRouter.use('*', authMiddleware)

// POST /projects — criar projeto
projectsRouter.post('/', async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const body = await c.req.json<{ name: string; description?: string }>()

  const projectId = generateId()

  await db.insert(projects).values({
    id: projectId,
    // [TENANT] Projeto sempre vinculado ao tenant do criador
    tenantId: ctx.tenantId,
    name: body.name,
    description: body.description,
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

// GET /projects/:id — detalhe do projeto
projectsRouter.get('/:id', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const id = c.req.param('id')!

  // [TENANT] requireRole já verificou membership + tenantId
  const project = await db.query.projects.findFirst({
    where: (p) => and(eq(p.id, id), eq(p.tenantId, ctx.tenantId)),
    with: { modules: { orderBy: asc(modules.position) } },
  })

  if (!project) return c.json({ error: 'Projeto não encontrado' }, 404)
  return c.json(project)
})

// PATCH /projects/:id — editar projeto (apenas ADMIN)
projectsRouter.patch('/:id', requireRole('ADMIN'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const id = c.req.param('id')!
  const body = await c.req.json<{ name?: string; description?: string }>()

  // [TENANT] Filtra por tenantId — previne edição de projetos de outros tenants
  await db
    .update(projects)
    .set({ ...(body.name && { name: body.name }), ...(body.description !== undefined && { description: body.description }) })
    .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)))

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
  const body = await c.req.json<{ role: 'ADMIN' | 'MEMBER' | 'VIEWER' }>()

  // [TENANT] Filtra por tenantId — não permite alterar membros de projetos de outros tenants
  await db.update(memberships)
    .set({ role: body.role })
    .where(
      and(
        eq(memberships.tenantId, ctx.tenantId),
        eq(memberships.projectId, projectId),
        eq(memberships.userId, userId)
      )
    )

  return c.json({ ok: true })
})

// GET /projects/:id/members — listar membros do projeto com info do usuário
projectsRouter.get('/:id/members', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!

  // [TENANT] Join memberships + users filtrado por tenantId + projectId
  const result = await db
    .select({
      userId: memberships.userId,
      role: memberships.role,
      squadId: memberships.squadId,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.projectId, projectId), eq(memberships.tenantId, ctx.tenantId)))

  return c.json(result)
})

// GET /projects/:id/squads — listar squads com seus membros
projectsRouter.get('/:id/squads', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.param('id')!

  const projectSquads = await db.select().from(squads)
    .where(and(eq(squads.projectId, projectId), eq(squads.tenantId, ctx.tenantId)))

  const members = await db
    .select({
      userId: memberships.userId,
      role: memberships.role,
      squadId: memberships.squadId,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.projectId, projectId), eq(memberships.tenantId, ctx.tenantId)))

  return c.json(projectSquads.map(sq => ({
    ...sq,
    members: members.filter(m => m.squadId === sq.id),
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
