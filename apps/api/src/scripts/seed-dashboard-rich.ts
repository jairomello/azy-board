import { and, asc, eq, max } from 'drizzle-orm'
import { db } from '../db/index'
import { columns, itemEvents, itemLogs, itemSprints, items, memberships, modules, projectVersions, projects, squads, sprints, users } from '../db/schema'
import { hashPassword } from '../services/auth'
import { generateId } from '../utils/id'

const project = await db.query.projects.findFirst({ where: row => eq(row.name, 'Azy Board') })
if (!project) throw new Error('Projeto "Azy Board" não encontrado.')
const tenantId = project.tenantId
const existing = await db.query.items.findFirst({ where: row => and(eq(row.projectId, project.id), eq(row.tenantId, tenantId), eq(row.title, 'Dashboard Rich / Integração mobile')) })
if (existing) {
  console.log('Dados ricos do Dashboard já existem.')
  process.exit(0)
}

const now = Date.now()
const iso = (days: number) => new Date(now + days * 86400000).toISOString()
const date = (days: number) => iso(days).slice(0, 10)

await db.transaction(async tx => {
  const projectModules = await tx.select().from(modules).where(and(eq(modules.projectId, project.id), eq(modules.tenantId, tenantId))).orderBy(asc(modules.position))
  const projectColumns = await tx.select().from(columns).where(and(eq(columns.projectId, project.id), eq(columns.tenantId, tenantId))).orderBy(asc(columns.position))
  const versionRows = await tx.select().from(projectVersions).where(and(eq(projectVersions.projectId, project.id), eq(projectVersions.tenantId, tenantId))).orderBy(asc(projectVersions.position))
  const projectSprints = await tx.select().from(sprints).where(and(eq(sprints.projectId, project.id), eq(sprints.tenantId, tenantId))).orderBy(asc(sprints.startDate))
  const projectSquads = await tx.select().from(squads).where(and(eq(squads.projectId, project.id), eq(squads.tenantId, tenantId))).orderBy(asc(squads.createdAt))
  if (projectModules.length < 2 || projectColumns.length < 3 || versionRows.length < 3 || projectSprints.length < 2 || projectSquads.length < 2) throw new Error('Execute primeiro seed-dashboard-demo.ts.')

  const members = [
    { name: 'Marina Costa', email: 'dashboard.marina@demo.local', squadId: projectSquads[1]!.id },
    { name: 'Rafael Lima', email: 'dashboard.rafael@demo.local', squadId: projectSquads[0]!.id },
    { name: 'Beatriz Alves', email: 'dashboard.beatriz@demo.local', squadId: projectSquads[1]!.id },
  ]
  const createdMembers = [] as Array<{ id: string; name: string; squadId: string }>
  for (const member of members) {
    const userId = generateId()
    await tx.insert(users).values({ id: userId, tenantId, email: member.email, passwordHash: await hashPassword('DashboardDemo!123'), name: member.name, globalGroup: 'TEAM_MEMBER', theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', createdAt: iso(-15) })
    await tx.insert(memberships).values({ id: generateId(), tenantId, userId, projectId: project.id, squadId: member.squadId, role: 'MEMBER', createdAt: iso(-14) })
    createdMembers.push({ id: userId, name: member.name, squadId: member.squadId })
  }

  const statusToColumn = (status: string) => projectColumns.find(column => column.baseStatus === status)?.id ?? projectColumns[0]!.id
  // [HIERARQUIA] Itens ricos vivem sob o EPIC "Dashboard" / STORY "Dashboard Rich" — nunca órfãos.
  const allProjectItems = await tx.select().from(items).where(and(eq(items.projectId, project.id), eq(items.tenantId, tenantId)))
  let dashboardEpic = allProjectItems.find(row => row.type === 'EPIC' && row.title === 'Dashboard')
  if (!dashboardEpic) {
    const epicId = generateId()
    await tx.insert(items).values({ id: epicId, tenantId, projectId: project.id, type: 'EPIC', parentId: null, moduleId: projectModules[0]!.id, ancestryPath: '[]', title: 'Dashboard', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, authorId: createdMembers[0]!.id, createdAt: iso(-13), updatedAt: iso(-13) })
    dashboardEpic = (await tx.select().from(items).where(and(eq(items.projectId, project.id), eq(items.tenantId, tenantId)))).find(row => row.id === epicId)!
  }
  let richStory = allProjectItems.find(row => row.type === 'STORY' && row.title === 'Dashboard Rich')
  if (!richStory) {
    const storyId = generateId()
    await tx.insert(items).values({ id: storyId, tenantId, projectId: project.id, type: 'STORY', parentId: dashboardEpic.id, moduleId: null, ancestryPath: JSON.stringify([{ id: dashboardEpic.id, title: dashboardEpic.title, type: 'EPIC' }]), title: 'Dashboard Rich', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, authorId: createdMembers[0]!.id, createdAt: iso(-13), updatedAt: iso(-13) })
    richStory = (await tx.select().from(items).where(and(eq(items.projectId, project.id), eq(items.tenantId, tenantId)))).find(row => row.id === storyId)!
  }
  const richAncestry = JSON.stringify([
    { id: dashboardEpic.id, title: dashboardEpic.title, type: 'EPIC' },
    { id: richStory.id, title: richStory.title, type: 'STORY' },
  ])
  const specs = [
    ['Integração mobile', 'TASK', 'IN_PROGRESS', 5, 0, 0], ['Painel executivo', 'TASK', 'DONE', 8, 1, 1], ['Alertas de SLA', 'BUG', 'BLOCKED', 3, 0, 1],
    ['Importação de clientes', 'TASK', 'IN_PROGRESS', 5, 1, 2], ['Checklist de release', 'TASK', 'NOT_STARTED', 2, 2, 2], ['Filtro por prioridade', 'BUG', 'DONE', 3, 0, 0],
    ['Auditoria de permissões', 'TASK', 'BLOCKED', 5, 1, 1], ['Documentação de API', 'TASK', 'NOT_STARTED', null, 0, 2], ['Tema escuro avançado', 'TASK', 'IN_PROGRESS', 3, 2, 1],
    ['Notificações por e-mail', 'TASK', 'DONE', 5, 1, 0], ['Retenção de anexos', 'BUG', 'CANCELLED', 2, 0, 2], ['Relatório de capacidade', 'TASK', 'IN_PROGRESS', 8, 1, 1],
  ] as const
  const created = specs.map(([title, type, status, points, versionIndex, memberIndex], index) => ({
    id: generateId(), tenantId, projectId: project.id, type, parentId: richStory.id, moduleId: projectModules[index % 2]!.id, columnId: statusToColumn(status), ancestryPath: richAncestry, title: `Dashboard Rich / ${title}`, description: 'Registro criado para exercitar os gráficos e filtros do Dashboard.', status, statusBeforeArchive: null, priority: status === 'BLOCKED' ? 'CRITICAL' as const : 'MEDIUM' as const, points, assigneeId: createdMembers[memberIndex]!.id, blockedReason: status === 'BLOCKED' ? 'Dependência da equipe de plataforma' : null, position: index, dueDate: date(status === 'DONE' ? -2 : index % 3 === 0 ? -4 : 9), authorId: createdMembers[(memberIndex + 1) % createdMembers.length]!.id, versionId: versionRows[versionIndex]!.id, createdAt: iso(-12 + index % 5), updatedAt: iso(-1),
  }))
  await tx.insert(items).values(created)
  const openSprint = projectSprints.find(sprint => sprint.status === 'OPEN') ?? projectSprints[projectSprints.length - 1]!
  await tx.insert(itemSprints).values(created.slice(0, 8).map(item => ({ tenantId, itemId: item.id, sprintId: openSprint.id })))
  for (const [index, item] of created.entries()) {
    await tx.insert(itemLogs).values([0, 1, 2, 3].map(day => ({ id: generateId(), tenantId, itemId: item.id, authorId: item.authorId, type: 'manual' as const, activity: `Dashboard Rich: trabalho registrado ${day + 1}`, durationMin: 45 + ((index + day) % 4) * 30, createdAt: iso(-day - 1), updatedAt: iso(-day - 1) })))
  }
  const latest = await tx.select({ value: max(itemEvents.sequence) }).from(itemEvents).where(and(eq(itemEvents.projectId, project.id), eq(itemEvents.tenantId, tenantId)))
  let sequence = Number(latest[0]?.value ?? -1) + 1
  for (const [index, item] of created.entries()) {
    const snapshot = { parentId: richStory.id, type: item.type, isLeaf: true, status: item.status, points: item.points, sprintIds: index < 8 ? [openSprint.id] : [], versionId: item.versionId, moduleId: item.moduleId }
    await tx.insert(itemEvents).values({ id: generateId(), tenantId, projectId: project.id, itemId: item.id, eventType: 'ITEM_CREATED', occurredAt: iso(-11 + index % 7), sequence: sequence++, actorId: item.authorId!, origin: 'SEED', correlationId: `dashboard-rich-${item.id}`, beforeSnapshot: null, afterSnapshot: JSON.stringify(snapshot) })
  }
})

console.log('Dados ricos do Dashboard criados.')
console.log('Incluídos: 3 membros, squads associados, 12 itens, múltiplas versões/sprints, horas e eventos históricos.')
