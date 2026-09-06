import { beforeAll, describe, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users, projects, memberships, items, modules, columns } = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')

await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })

let tenantId: string
let userId: string
let session: string

async function request(path: string, init: RequestInit = {}) {
  return app.fetch(new Request(`http://regression.test/api${path}`, {
    ...init,
    headers: { cookie: `session=${session}`, ...init.headers },
  }))
}

async function json<T>(path: string, init: RequestInit = {}) {
  const response = await request(path, init)
  return { response, body: await response.json() as T }
}

async function createProject(name: string, extra: Record<string, unknown> = {}) {
  const result = await json<{ id: string; boardMode: string; description: string | null }>(
    '/projects',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, ...extra }) },
  )
  expect(result.response.status).toBe(201)
  return result.body
}

async function createItem(projectId: string, body: Record<string, unknown>) {
  const result = await json<{ id: string; type: string; parentId: string | null; ancestryPath: string; assigneeId: string | null }>(
    `/projects/${projectId}/items`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )
  expect(result.response.status).toBe(201)
  return result.body
}

async function hierarchy(projectId: string) {
  const module = (await db.select().from(modules).where(eq(modules.projectId, projectId))).find(item => item.name === 'Geral')!
  const epic = await createItem(projectId, { title: 'Épico base', type: 'EPIC', moduleId: module.id })
  const story = await createItem(projectId, { title: 'História base', type: 'STORY', parentId: epic.id, description: 'Descrição', persona: 'Atendente', goal: 'Objetivo', benefit: 'Benefício', acceptanceCriteria: 'Critério' })
  return { module, epic, story }
}

describe('regressão dos fluxos recorrentes do Azy Agent', () => {
  beforeAll(async () => {
    tenantId = generateId()
    userId = generateId()
    const email = 'agent-regression@test.local'
    const now = new Date().toISOString()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant Agent Regression', slug: `agent-regression-${tenantId}`, createdAt: now })
    await db.insert(users).values({ id: userId, tenantId, email, passwordHash: 'test-hash', name: 'Usuário Logado', theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: now })
    session = await signJwt({ sub: userId, tenantId, email, role: 'user' })
  })

  test('cria projeto com somente nome e com todos os dados', async () => {
    const minimal = await createProject('Projeto mínimo')
    expect(minimal.boardMode).toBe('HIERARCHICAL')
    expect(minimal.description).toBeNull()

    const complete = await createProject('Projeto completo', { description: 'Projeto de regressão', boardMode: 'HIERARCHICAL', managerUserId: userId })
    expect(complete.description).toBe('Projeto de regressão')
    expect((await db.select().from(projects).where(eq(projects.id, complete.id)))[0]?.managerUserId).toBe(userId)
    expect((await db.select().from(modules).where(and(eq(modules.projectId, complete.id), eq(modules.name, 'Geral')))).length).toBe(1)
  })

  test('cria EPIC, STORY, TASK e subtask preservando hierarquia e Leaf Rule', async () => {
    const project = await createProject('Projeto hierárquico')
    const { epic, story } = await hierarchy(project.id)
    const task = await createItem(project.id, { title: 'Task principal', type: 'TASK', parentId: story.id, priority: 'HIGH', points: 3, status: 'NOT_STARTED', assigneeId: userId })
    const child = await createItem(project.id, { title: 'Subtask', type: 'TASK', parentId: task.id, points: 2, assigneeId: userId })
    const persisted = await db.select().from(items).where(eq(items.projectId, project.id))
    expect(persisted.find(item => item.id === epic.id)?.parentId).toBeNull()
    expect(persisted.find(item => item.id === story.id)?.parentId).toBe(epic.id)
    expect(persisted.find(item => item.id === task.id)?.parentId).toBe(story.id)
    expect(persisted.find(item => item.id === child.id)?.parentId).toBe(task.id)
    expect(JSON.parse(persisted.find(item => item.id === child.id)!.ancestryPath)).toHaveLength(3)
    expect(persisted.filter(item => item.parentId === task.id)).toHaveLength(1)
  })

  test('executa batch ordenado com refs, módulo nominal, status e usuário logado', async () => {
    const project = await createProject('Projeto em lote')
    const result = await json<{ atomic: boolean; results: Array<{ ok: boolean; data?: { type: string; parentId: string | null; assigneeId: string | null } }> }>(
      `/projects/${project.id}/batch`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ atomic: true, operations: [
        { tool: 'create_task', args: { ref: 'epic', title: 'Épico lote', type: 'EPIC', parentRef: null, moduleName: 'Geral', description: null, priority: 'HIGH', points: null, assignToCurrentUser: true } },
        { tool: 'create_task', args: { ref: 'story', title: 'História lote', type: 'STORY', parentRef: 'epic', moduleName: null, description: 'História', priority: 'HIGH', points: null, assignToCurrentUser: true } },
        { tool: 'create_task', args: { ref: 'task', title: 'Task lote', type: 'TASK', parentRef: 'story', moduleName: null, description: 'Task', priority: 'MEDIUM', points: 3, assignToCurrentUser: true } },
      ] }) },
    )
    expect(result.body.atomic).toBe(true)
    expect(result.body.results).toHaveLength(3)
    expect(result.body.results.every(item => item.ok)).toBe(true)
    expect(result.body.results[2]?.data).toMatchObject({ type: 'TASK', assigneeId: userId })
  })

  test('atualiza datas e responsáveis em lote somente nos cards filtrados', async () => {
    const project = await createProject('Projeto de filtros')
    const { story } = await hierarchy(project.id)
    const selected = await createItem(project.id, { title: 'Task selecionada', type: 'TASK', parentId: story.id, status: 'NOT_STARTED' })
    const untouched = await createItem(project.id, { title: 'Task preservada', type: 'TASK', parentId: story.id, status: 'IN_PROGRESS' })
    const result = await json<{ updatedCount: number }>(
      `/projects/${project.id}/batch/items/update`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filters: { itemIds: null, types: ['TASK'], statuses: ['NOT_STARTED'], sprint: null, version: null, module: null, assignee: null, parent: null, column: null, tag: null, titleContains: 'selecionada', onlyLeaves: true, matchAll: false }, changes: [{ field: 'dueDate', operation: 'SET', value: '2030-01-02' }, { field: 'assignee', operation: 'SET', value: 'Usuário Logado' }] }) },
    )
    expect(result.body.updatedCount).toBe(1)
    const [afterSelected, afterUntouched] = await Promise.all([db.query.items.findFirst({ where: eq(items.id, selected.id) }), db.query.items.findFirst({ where: eq(items.id, untouched.id) })])
    expect(afterSelected).toMatchObject({ dueDate: '2030-01-02', assigneeId: userId })
    expect(afterUntouched).toMatchObject({ dueDate: null, assigneeId: null })
  })

  test('move todas as tasks e bugs que correspondem à história e lista de origem', async () => {
    const project = await createProject('Projeto de movimento em lote')
    const { epic, story } = await hierarchy(project.id)
    const otherStory = await createItem(project.id, { title: 'Outra história', type: 'STORY', parentId: epic.id })
    const projectColumns = await db.select().from(columns).where(eq(columns.projectId, project.id))
    const source = projectColumns.find(column => column.name === 'A Fazer')!
    const destination = projectColumns.find(column => column.name === 'Fazendo')!
    const task = await createItem(project.id, { title: 'Task selecionada', type: 'TASK', parentId: story.id, columnId: source.id })
    const bug = await createItem(project.id, { title: 'Bug selecionado', type: 'BUG', parentId: story.id, columnId: source.id })
    const wrongParent = await createItem(project.id, { title: 'Task de outra história', type: 'TASK', parentId: otherStory.id, columnId: source.id })
    const wrongColumn = await createItem(project.id, { title: 'Task em outra lista', type: 'TASK', parentId: story.id, columnId: destination.id })

    const result = await json<{ matchedCount: number; updatedCount: number }>(
      `/projects/${project.id}/batch/items/update`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filters: { itemIds: null, types: ['TASK', 'BUG'], statuses: null, sprint: null, version: null, module: null, assignee: null, parent: 'História base', column: source.name, tag: null, titleContains: null, onlyLeaves: true, matchAll: false }, changes: [{ field: 'column', operation: 'SET', value: destination.name }] }) },
    )

    expect(result.response.status).toBe(200)
    expect(result.body).toMatchObject({ matchedCount: 2, updatedCount: 2 })
    const persisted = await db.select().from(items).where(eq(items.projectId, project.id))
    expect(persisted.find(item => item.id === task.id)?.columnId).toBe(destination.id)
    expect(persisted.find(item => item.id === bug.id)?.columnId).toBe(destination.id)
    expect(persisted.find(item => item.id === wrongParent.id)?.columnId).toBe(source.id)
    expect(persisted.find(item => item.id === wrongColumn.id)?.columnId).toBe(destination.id)
  })

  test('move tasks entre listas e reparenta entre histórias, rejeitando pai EPIC', async () => {
    const project = await createProject('Projeto de movimento')
    const { epic, story } = await hierarchy(project.id)
    const secondStory = await createItem(project.id, { title: 'Segunda história', type: 'STORY', parentId: epic.id })
    const task = await createItem(project.id, { title: 'Task móvel', type: 'TASK', parentId: story.id })
    const projectColumns = await db.select().from(columns).where(eq(columns.projectId, project.id))
    const move = await request(`/projects/${project.id}/items/${task.id}/move`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ columnId: projectColumns[1]!.id }) })
    expect(move.status).toBe(200)
    expect((await db.query.items.findFirst({ where: eq(items.id, task.id) }))?.columnId).toBe(projectColumns[1]!.id)
    const reparent = await request(`/projects/${project.id}/items/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parentId: secondStory.id }) })
    expect(reparent.status).toBe(200)
    const invalid = await request(`/projects/${project.id}/items/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parentId: epic.id }) })
    expect(invalid.status).toBe(400)
    expect((await db.query.items.findFirst({ where: eq(items.id, task.id) }))?.parentId).toBe(secondStory.id)
  })

  test('rejeita criação órfã e desvinculação em lote', async () => {
    const project = await createProject('Projeto sem órfãos')
    const orphan = await request(`/projects/${project.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Órfã', type: 'TASK' }) })
    expect(orphan.status).toBe(400)
    expect((await orphan.json()).code).toBe('HIERARCHY_REQUIRED')
  })
})
