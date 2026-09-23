import { beforeAll, describe, expect, test } from 'bun:test'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { toolCreateTask, toolListTasks, toolMoveTask } from '../../mcp/src/tools'

process.env.DATABASE_URL = ':memory:'
process.env.TRUST_PROXY = 'true'
process.env.LOGIN_PROGRESSIVE_DELAY_MS = '0'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users } = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')

await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })

type JsonRecord = Record<string, any>

async function request(path: string, session: string, init: RequestInit = {}) {
  return app.fetch(new Request(`http://test.local/api${path}`, {
    ...init,
    headers: { cookie: `session=${session}`, ...init.headers },
  }))
}

async function call(session: string, method: string, path: string, body?: unknown) {
  const response = await request(path, session, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, data: (text ? JSON.parse(text) : null) as JsonRecord }
}

async function token(userId: string, tenantId: string, email: string) {
  return signJwt({ sub: userId, tenantId, email, role: 'user' })
}

async function createUser(tenantId: string, email: string, name: string, globalGroup: 'TEAM_MEMBER' | 'MANAGER' | 'ADMIN' | 'ROOT' = 'ADMIN') {
  const id = generateId()
  await db.insert(users).values({
    id, tenantId, email, passwordHash: 'test-hash', name, theme: 'light',
    lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup, createdAt: new Date().toISOString(),
  })
  return { id, email }
}

async function apiKeyCall(apiKey: string, path: string, method = 'GET', body?: unknown) {
  const response = await app.fetch(new Request(`http://test.local/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await response.text()
  if (!response.ok) throw new Error(`MCP API ${response.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

describe('regressão ponta a ponta dos fluxos críticos', () => {
  let tenantId: string
  let otherTenantId: string
  let admin: { id: string; email: string }
  let member: { id: string; email: string }
  let outsider: { id: string; email: string }
  let adminSession: string
  let memberSession: string
  let outsiderSession: string

  let projectId: string
  let moduleId: string
  let tagId: string
  let sprintId: string
  let versionId: string
  let costCenterId: string
  let epicId: string
  let storyId: string
  let taskId: string
  let bugId: string
  let doingColumnId: string
  let checklistId: string
  let checklistItemId: string

  beforeAll(async () => {
    const now = new Date().toISOString()
    tenantId = generateId()
    otherTenantId = generateId()
    await db.insert(tenants).values([
      { id: tenantId, name: 'Tenant Regressão', slug: `reg-${tenantId}`, createdAt: now },
      { id: otherTenantId, name: 'Tenant Externo', slug: `ext-${otherTenantId}`, createdAt: now },
    ])
    admin = await createUser(tenantId, 'admin@regression.test', 'Admin Regressão', 'ADMIN')
    member = await createUser(tenantId, 'member@regression.test', 'Membro Regressão', 'TEAM_MEMBER')
    outsider = await createUser(otherTenantId, 'outsider@regression.test', 'Externo', 'ADMIN')
    adminSession = await token(admin.id, tenantId, admin.email)
    memberSession = await token(member.id, tenantId, member.email)
    outsiderSession = await token(outsider.id, otherTenantId, outsider.email)
  })

  test('configura o projeto: colunas padrão, squad, membro, centro de custo, módulo, tag, versão e sprint', async () => {
    const created = await call(adminSession, 'POST', '/projects', { name: 'Regressão E2E', boardMode: 'HIERARCHICAL' })
    expect(created.status).toBe(201)
    projectId = created.data.id
    expect(created.data.boardMode).toBe('HIERARCHICAL')

    const columns = await call(adminSession, 'GET', `/projects/${projectId}/columns`)
    expect(columns.status).toBe(200)
    const columnList = columns.data as unknown as Array<{ id: string; name: string; baseStatus: string }>
    expect(columnList.length).toBe(6)
    doingColumnId = columnList.find(column => column.name === 'Fazendo')!.id

    const extraColumn = await call(adminSession, 'POST', `/projects/${projectId}/columns`, { name: 'Impedimentos', baseStatus: 'IN_PROGRESS' })
    expect(extraColumn.status).toBe(201)

    const squad = await call(adminSession, 'POST', `/projects/${projectId}/squads`, { name: 'Squad Regressão' })
    expect(squad.status).toBe(201)

    const addedMember = await call(adminSession, 'POST', `/projects/${projectId}/members`, { email: member.email, role: 'MEMBER', squadId: squad.data.id })
    expect(addedMember.status).toBe(201)

    const costCenter = await call(adminSession, 'POST', `/projects/${projectId}/cost-centers`, { code: 'CC-REG', description: 'Regressão' })
    expect(costCenter.status).toBe(201)
    costCenterId = costCenter.data.id

    const module = await call(adminSession, 'POST', `/projects/${projectId}/modules`, { name: 'Módulo Regressão' })
    expect(module.status).toBe(201)
    moduleId = module.data.id

    const tag = await call(adminSession, 'POST', `/projects/${projectId}/tags`, { name: 'regressao', color: '#123456' })
    expect(tag.status).toBe(201)
    tagId = tag.data.id

    const version = await call(adminSession, 'POST', `/projects/${projectId}/versions`, { name: 'v9.9.9', status: 'PLANNED' })
    expect(version.status).toBe(201)
    versionId = version.data.id

    const sprint = await call(adminSession, 'POST', `/projects/${projectId}/sprints`, { name: 'Sprint Regressão', startDate: '2026-09-01', endDate: '2026-09-30' })
    expect(sprint.status).toBe(201)
    sprintId = sprint.data.id

    const activated = await call(adminSession, 'PATCH', `/projects/${projectId}/sprints/${sprintId}/activate`)
    expect(activated.status).toBe(200)

    const current = await call(adminSession, 'GET', `/projects/${projectId}/sprints/current`)
    expect(current.status).toBe(200)
    expect(current.data.id).toBe(sprintId)
  })

  test('cria a hierarquia EPIC > STORY > TASK/BUG e valida folhas e órfãs', async () => {
    const epic = await call(adminSession, 'POST', `/projects/${projectId}/items`, { title: 'Épico Regressão', type: 'EPIC', moduleId })
    expect(epic.status).toBe(201)
    epicId = epic.data.id

    const story = await call(adminSession, 'POST', `/projects/${projectId}/items`, { title: 'História Regressão', type: 'STORY', parentId: epicId })
    expect(story.status).toBe(201)
    storyId = story.data.id
    expect(story.data.ancestryPath).toContain(epicId)

    const task = await call(adminSession, 'POST', `/projects/${projectId}/items`, { title: 'Tarefa Regressão', type: 'TASK', parentId: storyId, priority: 'HIGH', points: 3 })
    expect(task.status).toBe(201)
    taskId = task.data.id

    const bug = await call(adminSession, 'POST', `/projects/${projectId}/items`, { title: 'Bug Regressão', type: 'BUG', parentId: storyId })
    expect(bug.status).toBe(201)
    bugId = bug.data.id

    const orphan = await call(adminSession, 'POST', `/projects/${projectId}/items`, { title: 'Tarefa órfã', type: 'TASK' })
    expect(orphan.status).toBe(400)
    expect(orphan.data.error.code).toBe('HIERARCHY_REQUIRED')

    const children = await call(adminSession, 'GET', `/projects/${projectId}/items/${storyId}/children`)
    expect(children.status).toBe(200)
    expect(children.data.total).toBe(2)

    const tree = await call(adminSession, 'GET', `/projects/${projectId}/items/tree`)
    expect(tree.status).toBe(200)

    const board = await call(adminSession, 'GET', `/projects/${projectId}/board`)
    expect(board.status).toBe(200)
    const boardItems = board.data.items as unknown as Array<{ id: string }>
    expect(boardItems.some(item => item.id === taskId)).toBe(true)

    const leaves = await call(adminSession, 'GET', `/projects/${projectId}/items?leaf=true`)
    expect(leaves.status).toBe(200)
    const leafIds = (leaves.data as unknown as Array<{ id: string }>).map(item => item.id)
    expect(leafIds).toContain(taskId)
    expect(leafIds).toContain(bugId)
    expect(leafIds).not.toContain(epicId)
  })

  test('executa o ciclo do card: mover, claim, tags, sprint, checklist e diário de trabalho', async () => {
    const moved = await call(adminSession, 'PATCH', `/projects/${projectId}/items/${taskId}/move`, { columnId: doingColumnId })
    expect(moved.status).toBe(200)
    expect(moved.data.status).toBe('IN_PROGRESS')

    const claimed = await call(memberSession, 'PATCH', `/projects/${projectId}/items/${taskId}/claim`)
    expect(claimed.status).toBe(200)
    expect(claimed.data.item.assigneeId).toBe(member.id)

    const secondClaim = await call(memberSession, 'PATCH', `/projects/${projectId}/items/${taskId}/claim`)
    expect(secondClaim.status).toBe(409)

    const tagged = await call(adminSession, 'POST', `/projects/${projectId}/items/${taskId}/tags`, { tagIds: [tagId] })
    expect(tagged.status).toBe(200)

    const sprinted = await call(adminSession, 'POST', `/projects/${projectId}/items/${taskId}/sprint`, { sprintId })
    expect(sprinted.status).toBe(200)

    const checklist = await call(adminSession, 'POST', `/projects/${projectId}/items/${taskId}/checklists`, { name: 'Checklist Regressão' })
    expect(checklist.status).toBe(201)
    checklistId = checklist.data.id

    const step = await call(adminSession, 'POST', `/projects/${projectId}/items/${taskId}/checklists/${checklistId}/items`, { text: 'Passo 1' })
    expect(step.status).toBe(201)
    checklistItemId = step.data.id

    const checked = await call(adminSession, 'PATCH', `/projects/${projectId}/items/${taskId}/checklists/${checklistId}/items/${checklistItemId}`, { checked: true })
    expect(checked.status).toBe(200)
    expect(checked.data.checked).toBe(true)

    const workLog = await call(adminSession, 'POST', `/projects/${projectId}/items/${taskId}/work-log`, { activity: 'Trabalho de regressão', duration: '1:30' })
    expect(workLog.status).toBe(201)
    expect(workLog.data.durationMin).toBe(90)

    const updated = await call(adminSession, 'PATCH', `/projects/${projectId}/items/${taskId}`, { description: 'Descrição da regressão', versionId, costCenterId })
    expect(updated.status).toBe(200)
    expect(updated.data.item.versionId).toBe(versionId)
    expect(updated.data.item.costCenterId).toBe(costCenterId)
  })

  test('lê board.md e o dashboard (snapshot, horas, burnup, aging e sprints)', async () => {
    const markdownResponse = await request(`/projects/${projectId}/board.md`, adminSession)
    expect(markdownResponse.status).toBe(200)
    const markdown = await markdownResponse.text()
    expect(markdown).toContain('Tarefa Regressão')

    const snapshot = await call(adminSession, 'GET', `/projects/${projectId}/dashboard/snapshot`)
    expect(snapshot.status).toBe(200)
    expect(snapshot.data.boxes.progressScope.total).toBeGreaterThanOrEqual(2)

    const hours = await call(adminSession, 'GET', `/projects/${projectId}/dashboard/hours`)
    expect(hours.status).toBe(200)
    expect(hours.data.totalMinutes).toBeGreaterThanOrEqual(90)

    const burnup = await call(adminSession, 'GET', `/projects/${projectId}/dashboard/burnup`)
    expect(burnup.status).toBe(200)

    const aging = await call(adminSession, 'GET', `/projects/${projectId}/dashboard/aging`)
    expect(aging.status).toBe(200)

    const cycles = await call(adminSession, 'GET', `/projects/${projectId}/dashboard/sprints`)
    expect(cycles.status).toBe(200)
    expect(Array.isArray(cycles.data.cycles)).toBe(true)
  })

  test('cria itens em lote (parcial, por refs e atômico com rollback)', async () => {
    const partial = await call(adminSession, 'POST', `/projects/${projectId}/batch`, {
      operations: [
        { tool: 'create_task', args: { ref: 'a', title: 'Lote A', type: 'TASK', parentId: storyId } },
        { tool: 'create_task', args: { ref: 'b', title: 'Lote B', type: 'TASK', parentRef: 'a' } },
      ],
    })
    expect(partial.status).toBe(200)
    expect(partial.data.results[0].ok).toBe(true)
    expect(partial.data.results[1].ok).toBe(true)

    const rolledBack = await call(adminSession, 'POST', `/projects/${projectId}/batch`, {
      atomic: true,
      operations: [
        { tool: 'create_task', args: { title: 'Válida', type: 'TASK', parentId: storyId } },
        { tool: 'create_task', args: { title: '' } },
      ],
    })
    expect(rolledBack.status).toBe(422)

    const children = await call(adminSession, 'GET', `/projects/${projectId}/items/${storyId}/children`)
    expect(children.data.total).toBe(3)
    const allItems = await call(adminSession, 'GET', `/projects/${projectId}/items`)
    expect((allItems.data as unknown as Array<{ title: string }>).some(item => item.title === 'Válida')).toBe(false)
  })

  test('arquiva, desarquiva e exclui preservando a integridade', async () => {
    const archived = await call(adminSession, 'POST', `/projects/${projectId}/items/${bugId}/archive`, { confirm: true })
    expect(archived.status).toBe(200)

    const archivedList = await call(adminSession, 'GET', `/projects/${projectId}/items/archived`)
    expect(archivedList.status).toBe(200)
    expect((archivedList.data as unknown as Array<{ id: string }>).some(item => item.id === bugId)).toBe(true)

    const restored = await call(adminSession, 'POST', `/projects/${projectId}/items/${bugId}/unarchive`)
    expect(restored.status).toBe(200)

    const deleted = await call(adminSession, 'DELETE', `/projects/${projectId}/items/${taskId}`)
    expect(deleted.status).toBe(200)

    const missing = await call(adminSession, 'GET', `/projects/${projectId}/items/${taskId}`)
    expect(missing.status).toBe(404)
  })

  test('isola tenants e aplica RBAC nas rotas administrativas', async () => {
    const crossTenant = await call(outsiderSession, 'GET', `/projects/${projectId}`)
    expect([403, 404]).toContain(crossTenant.status)

    const memberCreateColumn = await call(memberSession, 'POST', `/projects/${projectId}/columns`, { name: 'Proibida', baseStatus: 'NOT_STARTED' })
    expect(memberCreateColumn.status).toBe(403)

    const unknown = await call(adminSession, 'GET', '/projects/00000000-0000-0000-0000-000000000000')
    expect(unknown.status).toBe(404)
  })

  test('paridade MCP: cria e move tarefa via ferramentas com API Key', async () => {
    const key = await call(adminSession, 'POST', '/api-keys', { name: 'Regressão MCP', projectScope: [projectId], permissionScope: ['read', 'write', 'admin', 'delete'] })
    expect(key.status).toBe(201)
    const apiKey = key.data.key as string
    const apiCall = (path: string, method = 'GET', body?: unknown) => apiKeyCall(apiKey, path, method, body)

    const created = await toolCreateTask(apiCall, { projectId, title: 'Tarefa via MCP', type: 'TASK', parentId: storyId }) as { id: string }
    expect(created.id).toBeString()

    await toolMoveTask(apiCall, projectId, created.id, 'Fazendo')

    const listed = await toolListTasks(apiCall, { projectId, type: 'TASK' })
    expect(Array.isArray(listed)).toBe(true)
    expect((listed as Array<{ id: string }>).some(item => item.id === created.id)).toBe(true)
  })
})
