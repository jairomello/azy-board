import { and, asc, eq, inArray, max } from 'drizzle-orm'
import { db } from '../db/index'
import { columns, itemEvents, itemLogs, itemSprints, items, memberships, modules, projectAnalyticsCoverage, projectVersions, projects, squads, sprintCycleItems, sprintCycles, sprints, users } from '../db/schema'
import { generateId } from '../utils/id'

const project = await db.query.projects.findFirst({ where: (row) => eq(row.name, 'Azy Board') })
if (!project) throw new Error('Projeto "Azy Board" não encontrado.')
const admin = await db.query.users.findFirst({ where: (row) => eq(row.tenantId, project.tenantId) })
if (!admin) throw new Error('Usuário do tenant não encontrado.')

const marker = 'Dashboard Demo / '
const existing = await db.query.items.findFirst({ where: (row) => and(eq(row.projectId, project.id), eq(row.tenantId, project.tenantId), eq(row.title, `${marker}API gateway`)) })
if (existing) {
  console.log('Dados de demonstração do Dashboard já existem.')
  process.exit(0)
}

const now = Date.now()
const iso = (offsetDays: number) => new Date(now + offsetDays * 86400000).toISOString()
const date = (offsetDays: number) => iso(offsetDays).slice(0, 10)
const tenantId = project.tenantId

await db.transaction(async (tx) => {
  const existingModules = await tx.select().from(modules).where(and(eq(modules.projectId, project.id), eq(modules.tenantId, tenantId))).orderBy(asc(modules.position))
  const moduleRows = existingModules.length >= 2 ? existingModules : [
    ...existingModules,
    { id: generateId(), tenantId, projectId: project.id, name: 'Platform', description: null, position: existingModules.length, } as typeof modules.$inferSelect,
    { id: generateId(), tenantId, projectId: project.id, name: 'Experience', description: null, position: existingModules.length + 1, } as typeof modules.$inferSelect,
  ]
  if (existingModules.length < 2) await tx.insert(modules).values(moduleRows.slice(existingModules.length).map(row => ({ id: row.id, tenantId, projectId: project.id, name: row.name, position: row.position })))

  const existingColumns = await tx.select().from(columns).where(and(eq(columns.projectId, project.id), eq(columns.tenantId, tenantId))).orderBy(asc(columns.position))
  const columnFor = (status: string) => existingColumns.find(column => column.baseStatus === status)?.id ?? existingColumns[0]?.id ?? null
  if (!columnFor('IN_PROGRESS')) throw new Error('Projeto não possui colunas para os dados de demonstração.')

  const existingSquads = await tx.select().from(squads).where(and(eq(squads.projectId, project.id), eq(squads.tenantId, tenantId)))
  const squadRows = existingSquads.length >= 2 ? existingSquads : [
    ...existingSquads,
    { id: generateId(), tenantId, projectId: project.id, name: 'Platform', createdAt: iso(-20) } as typeof squads.$inferSelect,
    { id: generateId(), tenantId, projectId: project.id, name: 'Experience', createdAt: iso(-20) } as typeof squads.$inferSelect,
  ]
  if (existingSquads.length < 2) await tx.insert(squads).values(squadRows.slice(existingSquads.length).map(row => ({ id: row.id, tenantId, projectId: project.id, name: row.name, createdAt: row.createdAt })))
  const platformSquad = squadRows[0]
  await tx.update(memberships).set({ squadId: platformSquad.id }).where(and(eq(memberships.tenantId, tenantId), eq(memberships.projectId, project.id), eq(memberships.userId, admin.id)))

  const versions = [
    { name: 'v1.0 Foundation', status: 'RELEASED' as const, releaseDate: date(-2) },
    { name: 'v1.1 Collaboration', status: 'IN_DEV' as const, releaseDate: date(14) },
    { name: 'v2.0 Insights', status: 'PLANNED' as const, releaseDate: date(45) },
  ]
  const versionRows = versions.map((version, position) => ({ id: generateId(), tenantId, projectId: project.id, ...version, description: null, position, createdAt: iso(-18) }))
  await tx.insert(projectVersions).values(versionRows)

  const sprintRows = [
    { id: generateId(), tenantId, projectId: project.id, name: 'Sprint 14 · Foundation', status: 'CLOSED' as const, startDate: date(-21), endDate: date(-8), createdAt: iso(-25) },
    { id: generateId(), tenantId, projectId: project.id, name: 'Sprint 15 · Dashboard', status: 'OPEN' as const, startDate: date(-7), endDate: date(7), createdAt: iso(-8) },
    { id: generateId(), tenantId, projectId: project.id, name: 'Sprint 16 · Next', status: 'PROPOSED' as const, startDate: date(8), endDate: date(21), createdAt: iso(-2) },
  ]
  await tx.insert(sprints).values(sprintRows)

  const specs = [
    ['API gateway', 'TASK', 'DONE', 8, 0, -2, 0],
    ['Relatórios de auditoria', 'TASK', 'DONE', 5, 1, -1, 0],
    ['Login social', 'TASK', 'DONE', 3, 0, -3, 0],
    ['Telemetria do board', 'TASK', 'IN_PROGRESS', 8, 0, 5, 1],
    ['Exportação CSV', 'TASK', 'IN_PROGRESS', 5, 1, 6, 1],
    ['Filtro de squads', 'BUG', 'IN_PROGRESS', 3, 0, 8, 1],
    ['Webhook quebrado', 'BUG', 'BLOCKED', 5, 0, -4, 1],
    ['Permissão de convidado', 'TASK', 'BLOCKED', 3, 1, -2, 1],
    ['Documentação pública', 'TASK', 'NOT_STARTED', 2, 0, -6, 2],
    ['Teste de carga', 'TASK', 'NOT_STARTED', null, 1, 10, 2],
    ['Compatibilidade mobile', 'BUG', 'CANCELLED', 3, 0, -9, 2],
    ['Revisão de acessibilidade', 'TASK', 'IN_PROGRESS', 5, 1, 12, 0],
  ] as const
  // [HIERARQUIA] Itens de demonstração vivem sob o EPIC "Dashboard" / STORY "Dashboard Demo" — nunca órfãos.
  const allProjectItems = await tx.select().from(items).where(and(eq(items.projectId, project.id), eq(items.tenantId, tenantId)))
  let dashboardEpic = allProjectItems.find(row => row.type === 'EPIC' && row.title === 'Dashboard')
  if (!dashboardEpic) {
    const epicId = generateId()
    await tx.insert(items).values({ id: epicId, tenantId, projectId: project.id, type: 'EPIC', parentId: null, moduleId: moduleRows[0]!.id, ancestryPath: '[]', title: 'Dashboard', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, authorId: admin.id, createdAt: iso(-15), updatedAt: iso(-15) })
    dashboardEpic = (await tx.select().from(items).where(and(eq(items.projectId, project.id), eq(items.tenantId, tenantId)))).find(row => row.id === epicId)!
  }
  let demoStory = allProjectItems.find(row => row.type === 'STORY' && row.title === 'Dashboard Demo')
  if (!demoStory) {
    const storyId = generateId()
    await tx.insert(items).values({ id: storyId, tenantId, projectId: project.id, type: 'STORY', parentId: dashboardEpic.id, moduleId: null, ancestryPath: JSON.stringify([{ id: dashboardEpic.id, title: dashboardEpic.title, type: 'EPIC' }]), title: 'Dashboard Demo', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, authorId: admin.id, createdAt: iso(-15), updatedAt: iso(-15) })
    demoStory = (await tx.select().from(items).where(and(eq(items.projectId, project.id), eq(items.tenantId, tenantId)))).find(row => row.id === storyId)!
  }
  const demoAncestry = JSON.stringify([
    { id: dashboardEpic.id, title: dashboardEpic.title, type: 'EPIC' },
    { id: demoStory.id, title: demoStory.title, type: 'STORY' },
  ])
  const created = specs.map(([title, type, status, points, moduleIndex, dueOffset, versionIndex], position) => {
    const id = generateId()
    return {
      id, tenantId, projectId: project.id, type, parentId: demoStory.id, moduleId: moduleRows[moduleIndex]?.id ?? null, columnId: columnFor(status) ?? existingColumns[0]!.id,
      ancestryPath: demoAncestry, title: `${marker}${title}`, description: 'Registro criado para validar visualizações do Dashboard.', status, priority: status === 'BLOCKED' ? 'CRITICAL' as const : 'MEDIUM' as const,
      points, assigneeId: position % 4 === 2 ? null : admin.id, blockedReason: status === 'BLOCKED' ? position % 2 ? 'Aguardando revisão de segurança' : 'Dependência externa indisponível' : null,
      position, dueDate: date(dueOffset), versionId: versionRows[versionIndex].id, authorId: admin.id, createdAt: iso(-14 + position % 4), updatedAt: iso(-1),
    }
  })
  await tx.insert(items).values(created)

  await tx.insert(itemSprints).values(created.flatMap((item, index) => index < 7 ? [{ tenantId, itemId: item.id, sprintId: sprintRows[1].id }] : index < 10 ? [{ tenantId, itemId: item.id, sprintId: sprintRows[2].id }] : []))
  await tx.insert(itemSprints).values(created.slice(0, 4).map(item => ({ tenantId, itemId: item.id, sprintId: sprintRows[0].id })))

  const cycleId = generateId()
  await tx.insert(sprintCycles).values({ id: cycleId, tenantId, projectId: project.id, sprintId: sprintRows[1].id, source: 'OPENED', startedAt: iso(-7), endedAt: null, endReason: null })
  await tx.insert(sprintCycleItems).values(created.slice(0, 7).map(item => ({ cycleId, tenantId, projectId: project.id, itemId: item.id, type: item.type, isLeaf: true, points: item.points, status: item.status, moduleId: item.moduleId, versionId: item.versionId })))

  for (const [index, item] of created.entries()) {
    await tx.insert(itemLogs).values([1, 2, 3].map(day => ({ id: generateId(), tenantId, itemId: item.id, authorId: admin.id, type: 'manual' as const, activity: `Dashboard Demo: registro de trabalho ${day}`, durationMin: 30 + ((index + day) % 5) * 30, createdAt: iso(-day), updatedAt: iso(-day) })))
  }

  const baseline = created.map(item => ({ itemId: item.id, parentId: demoStory.id, type: item.type, isLeaf: true, status: item.status, points: item.points, sprintIds: [], versionId: item.versionId, moduleId: item.moduleId }))
  const coverageAt = iso(-14)
  const baselineId = generateId()
  await tx.update(projectAnalyticsCoverage).set({ coverageStartedAt: coverageAt, baselineEventId: baselineId }).where(and(eq(projectAnalyticsCoverage.projectId, project.id), eq(projectAnalyticsCoverage.tenantId, tenantId)))
  const lastSequence = await tx.select({ value: max(itemEvents.sequence) }).from(itemEvents).where(and(eq(itemEvents.projectId, project.id), eq(itemEvents.tenantId, tenantId)))
  let sequence = Number(lastSequence[0]?.value ?? -1) + 1
  await tx.insert(itemEvents).values({ id: baselineId, tenantId, projectId: project.id, itemId: null, eventType: 'ANALYTICS_BASELINE', occurredAt: coverageAt, sequence: sequence++, actorId: admin.id, origin: 'SEED', correlationId: `dashboard-demo-baseline-${project.id}`, beforeSnapshot: null, afterSnapshot: JSON.stringify(baseline) })
  for (const [index, item] of created.entries()) {
    const before = baseline[index]
    const after = { ...before, status: item.status }
    await tx.insert(itemEvents).values({ id: generateId(), tenantId, projectId: project.id, itemId: item.id, eventType: 'ITEM_CREATED', occurredAt: iso(-13 + index % 6), sequence: sequence++, actorId: admin.id, origin: 'SEED', correlationId: `dashboard-demo-created-${item.id}`, beforeSnapshot: null, afterSnapshot: JSON.stringify(after) })
    if (item.status === 'DONE') await tx.insert(itemEvents).values({ id: generateId(), tenantId, projectId: project.id, itemId: item.id, eventType: 'STATUS_CHANGED', occurredAt: iso(-6 + index % 3), sequence: sequence++, actorId: admin.id, origin: 'SEED', correlationId: `dashboard-demo-done-${item.id}`, beforeSnapshot: JSON.stringify({ ...before, status: 'IN_PROGRESS' }), afterSnapshot: JSON.stringify(after) })
  }
})

console.log(`Seed do Dashboard concluído no projeto ${project.id}.`)
console.log('Incluídos: itens em todos os estados, bloqueios, atrasos, 3 versões, 3 sprints, ciclo ativo, squads, horas e histórico Burnup.')
