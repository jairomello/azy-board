import { beforeAll, describe, expect, test } from 'bun:test'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

process.env.DATABASE_URL = ':memory:'
process.env.TRUST_PROXY = 'true'
process.env.LOGIN_PROGRESSIVE_DELAY_MS = '0'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users } = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')

await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })

// Resposta JSON arbitrária: corpos com `id` + campos extras (index signature)
// preservam `.data.id` como string e mantêm os casts de `.data` dos testes.
type JsonRecord = { id: string } & Record<string, unknown>

async function call(session: string, method: string, path: string, body?: unknown) {
  const response = await app.fetch(new Request(`http://test.local/api${path}`, {
    method,
    headers: { cookie: `session=${session}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await response.text()
  return { status: response.status, data: (text ? JSON.parse(text) : null) as JsonRecord }
}

function isoDate(offsetDays: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

type ListedItem = {
  id: string
  title: string
  icon: string | null
  versionId: string | null
  sprintId: string | null
  itemSprints?: Array<{ sprintId: string }>
}

async function listItems(session: string, projectId: string): Promise<ListedItem[]> {
  const listed = await call(session, 'GET', `/projects/${projectId}/items`)
  expect(listed.status).toBe(200)
  return (listed.data as unknown as { data: ListedItem[] }).data
}

async function findItem(session: string, projectId: string, id: string): Promise<ListedItem> {
  const items = await listItems(session, projectId)
  const found = items.find(item => item.id === id)
  expect(found).toBeDefined()
  return found!
}

function sprintIdsOf(item: ListedItem): string[] {
  return (item.itemSprints ?? []).map(link => link.sprintId)
}

describe('Card T35 — defaults determinísticos na criação', () => {
  let session: string
  let simpleProjectId: string
  let hierProjectId: string
  let pastSprintProjectId: string
  let activeSprintId: string
  let futureSprintId: string
  let nextVersionId: string

  async function token(userId: string, tenantId: string, email: string) {
    return signJwt({ sub: userId, tenantId, email, role: 'user' })
  }

  beforeAll(async () => {
    const now = new Date().toISOString()
    const tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant T35', slug: `t35-${tenantId}`, createdAt: now })
    const userId = generateId()
    await db.insert(users).values({
      id: userId, tenantId, email: 't35@test.local', passwordHash: 'x', name: 'Admin T35',
      theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: now,
    })
    session = await token(userId, tenantId, 't35@test.local')

    // Projeto SIMPLE com sprint vigente (OPEN dentro das datas) e versão futura.
    const simple = await call(session, 'POST', '/projects', { name: 'Projeto T35 SIMPLE', boardMode: 'SIMPLE' })
    simpleProjectId = simple.data.id
    const active = await call(session, 'POST', `/projects/${simpleProjectId}/sprints`, { name: 'Sprint Vigente', startDate: isoDate(-1), endDate: isoDate(1) })
    activeSprintId = active.data.id
    expect((await call(session, 'PATCH', `/projects/${simpleProjectId}/sprints/${activeSprintId}/activate`)).status).toBe(200)
    const future = await call(session, 'POST', `/projects/${simpleProjectId}/sprints`, { name: 'Sprint Futura', startDate: isoDate(5), endDate: isoDate(10) })
    futureSprintId = future.data.id
    const nextVersion = await call(session, 'POST', `/projects/${simpleProjectId}/versions`, { name: 'vNext', releaseDate: isoDate(7), status: 'IN_DEV' })
    nextVersionId = nextVersion.data.id
    await call(session, 'POST', `/projects/${simpleProjectId}/versions`, { name: 'vPast', releaseDate: isoDate(-3), status: 'RELEASED' })
    await call(session, 'POST', `/projects/${simpleProjectId}/versions`, { name: 'vNoDate', status: 'IN_DEV' })
    await call(session, 'POST', `/projects/${simpleProjectId}/versions`, { name: 'vCancelled', releaseDate: isoDate(3), status: 'CANCELLED' })

    // Projeto SIMPLE com sprint OPEN fora do intervalo de datas.
    const past = await call(session, 'POST', '/projects', { name: 'Projeto T35 passado', boardMode: 'SIMPLE' })
    pastSprintProjectId = past.data.id
    const pastSprint = await call(session, 'POST', `/projects/${pastSprintProjectId}/sprints`, { name: 'Sprint Passada', startDate: isoDate(-10), endDate: isoDate(-5) })
    expect((await call(session, 'PATCH', `/projects/${pastSprintProjectId}/sprints/${pastSprint.data.id}/activate`)).status).toBe(200)

    // Projeto HIERARCHICAL com sprint vigente e versão futura (para EPIC/STORY).
    const hier = await call(session, 'POST', '/projects', { name: 'Projeto T35 HIER', boardMode: 'HIERARCHICAL' })
    hierProjectId = hier.data.id
    const hierSprint = await call(session, 'POST', `/projects/${hierProjectId}/sprints`, { name: 'Sprint HIER', startDate: isoDate(-1), endDate: isoDate(1) })
    expect((await call(session, 'PATCH', `/projects/${hierProjectId}/sprints/${hierSprint.data.id}/activate`)).status).toBe(200)
    await call(session, 'POST', `/projects/${hierProjectId}/versions`, { name: 'vHier', releaseDate: isoDate(4), status: 'IN_DEV' })
  })

  test('TASK sem campos recebe sprint vigente, versão vigente e ícone default', async () => {
    const created = await call(session, 'POST', `/projects/${simpleProjectId}/items`, { title: 'Tarefa defaults', type: 'TASK' })
    expect(created.status).toBe(201)
    const item = await findItem(session, simpleProjectId, created.data.id)
    expect(sprintIdsOf(item)).toContain(activeSprintId)
    expect(item.versionId).toBe(nextVersionId)
    expect(item.icon).toBe('file-text')
  })

  test('sprint explícita tem precedência', async () => {
    const created = await call(session, 'POST', `/projects/${simpleProjectId}/items`, { title: 'Tarefa sprint explícita', type: 'TASK', sprintId: futureSprintId })
    const item = await findItem(session, simpleProjectId, created.data.id)
    expect(sprintIdsOf(item)).toEqual([futureSprintId])
  })

  test('sprintId null não vincula mesmo com sprint vigente', async () => {
    const created = await call(session, 'POST', `/projects/${simpleProjectId}/items`, { title: 'Tarefa sem sprint', type: 'TASK', sprintId: null })
    const item = await findItem(session, simpleProjectId, created.data.id)
    expect(sprintIdsOf(item)).toEqual([])
  })

  test('versionId null e icon null têm precedência', async () => {
    const created = await call(session, 'POST', `/projects/${simpleProjectId}/items`, { title: 'Tarefa sem versão e ícone', type: 'TASK', versionId: null, icon: null })
    const item = await findItem(session, simpleProjectId, created.data.id)
    expect(item.versionId).toBeNull()
    expect(item.icon).toBeNull()
  })

  test('icon explícito tem precedência', async () => {
    const created = await call(session, 'POST', `/projects/${simpleProjectId}/items`, { title: 'Tarefa com ícone', type: 'TASK', icon: 'bug' })
    const item = await findItem(session, simpleProjectId, created.data.id)
    expect(item.icon).toBe('bug')
  })

  test('sprint OPEN fora do intervalo de datas não vincula', async () => {
    const created = await call(session, 'POST', `/projects/${pastSprintProjectId}/items`, { title: 'Tarefa sprint passada', type: 'TASK' })
    const item = await findItem(session, pastSprintProjectId, created.data.id)
    expect(sprintIdsOf(item)).toEqual([])
  })

  test('criação em lote aplica os defaults em TASK', async () => {
    const batch = await call(session, 'POST', `/projects/${simpleProjectId}/batch`, {
      operations: [
        { tool: 'create_task', args: { ref: 'a', title: 'Lote A', type: 'TASK' } },
        { tool: 'create_task', args: { ref: 'b', title: 'Lote B', type: 'TASK' } },
      ],
    })
    expect(batch.status).toBe(200)
    for (const entry of batch.data.results as Array<{ ok: boolean; data: { sprintIds: string[]; versionId: string | null; icon: string | null } }>) {
      expect(entry.ok).toBe(true)
      expect(entry.data.sprintIds).toContain(activeSprintId)
      expect(entry.data.versionId).toBe(nextVersionId)
      expect(entry.data.icon).toBe('file-text')
    }
  })

  test('EPIC e STORY não recebem defaults automáticos', async () => {
    const module = await call(session, 'POST', `/projects/${hierProjectId}/modules`, { name: 'Módulo HIER' })
    const epic = await call(session, 'POST', `/projects/${hierProjectId}/items`, { title: 'Épico HIER', type: 'EPIC', moduleId: module.data.id })
    expect(epic.status).toBe(201)
    const epicItem = await findItem(session, hierProjectId, epic.data.id)
    expect(epicItem.icon).toBeNull()
    expect(epicItem.versionId).toBeNull()
    expect(sprintIdsOf(epicItem)).toEqual([])

    const story = await call(session, 'POST', `/projects/${hierProjectId}/items`, { title: 'História HIER', type: 'STORY', parentId: epic.data.id })
    expect(story.status).toBe(201)
    const storyItem = await findItem(session, hierProjectId, story.data.id)
    expect(storyItem.icon).toBeNull()
    expect(storyItem.versionId).toBeNull()
    expect(sprintIdsOf(storyItem)).toEqual([])
  })
})
