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

type JsonRecord = Record<string, any>

async function call(session: string, method: string, path: string, body?: unknown) {
  const response = await app.fetch(new Request(`http://test.local/api${path}`, {
    method,
    headers: { cookie: `session=${session}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await response.text()
  return { status: response.status, data: (text ? JSON.parse(text) : null) as JsonRecord }
}

type ListedItem = {
  id: string
  title: string
  sprintId: string | null
  itemSprints?: Array<{ sprintId: string }>
}

async function listItems(session: string, projectId: string, query = ''): Promise<ListedItem[]> {
  const listed = await call(session, 'GET', `/projects/${projectId}/items${query}`)
  expect(listed.status).toBe(200)
  return (listed.data as { data: ListedItem[] }).data
}

// Regressão do bug B2: o Board filtra cards por sprint client-side via
// i.itemSprints?.some(...) (BoardScreen.tsx). Se a projeção da API remover
// itemSprints, o campo vira undefined e o board é esvaziado.
describe('filtro por sprint: itemSprints presente na listagem de itens', () => {
  let session: string
  let projectId: string
  let storyId: string
  let linkedTaskId: string
  let unlinkedTaskId: string
  let sprintId: string
  let otherSprintId: string

  beforeAll(async () => {
    const now = new Date().toISOString()
    const tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant Sprint Filter', slug: `sf-${tenantId}`, createdAt: now })
    const userId = generateId()
    await db.insert(users).values({
      id: userId, tenantId, email: 'sprint-filter@test.local', passwordHash: 'x', name: 'Admin Sprint Filter',
      theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: now,
    })
    session = await token(userId, tenantId, 'sprint-filter@test.local')

    const project = await call(session, 'POST', '/projects', { name: 'Projeto Filtro Sprint', boardMode: 'HIERARCHICAL' })
    projectId = project.data.id
    const module = await call(session, 'POST', `/projects/${projectId}/modules`, { name: 'Módulo' })
    const epic = await call(session, 'POST', `/projects/${projectId}/items`, { title: 'Épico', type: 'EPIC', moduleId: module.data.id })
    const story = await call(session, 'POST', `/projects/${projectId}/items`, { title: 'História', type: 'STORY', parentId: epic.data.id })
    storyId = story.data.id

    const createdLinked = await call(session, 'POST', `/projects/${projectId}/items`, { title: 'Tarefa na sprint', type: 'TASK', parentId: storyId })
    linkedTaskId = createdLinked.data.id
    const createdUnlinked = await call(session, 'POST', `/projects/${projectId}/items`, { title: 'Tarefa sem sprint', type: 'TASK', parentId: storyId })
    unlinkedTaskId = createdUnlinked.data.id

    const sprint = await call(session, 'POST', `/projects/${projectId}/sprints`, { name: 'Sprint Um', startDate: '2026-10-01', endDate: '2026-10-14' })
    expect(sprint.status).toBe(201)
    sprintId = sprint.data.id

    const other = await call(session, 'POST', `/projects/${projectId}/sprints`, { name: 'Sprint Dois', startDate: '2026-10-15', endDate: '2026-10-28' })
    expect(other.status).toBe(201)
    otherSprintId = other.data.id

    const linked = await call(session, 'POST', `/projects/${projectId}/items/${linkedTaskId}/sprint`, { sprintId })
    expect(linked.status).toBe(200)
  })

  async function token(userId: string, tenantId: string, email: string) {
    return signJwt({ sub: userId, tenantId, email, role: 'user' })
  }

  test('resposta preserva itemSprints e o sprintId achatado (item vinculado)', async () => {
    const items = await listItems(session, projectId)
    const linked = items.find(item => item.id === linkedTaskId)!
    expect(linked).toBeDefined()
    expect(Array.isArray(linked.itemSprints)).toBe(true)
    expect(linked.itemSprints).toHaveLength(1)
    expect(linked.itemSprints![0]!.sprintId).toBe(sprintId)
    expect(linked.sprintId).toBe(sprintId)
  })

  test('resposta preserva itemSprints vazio (item sem sprint)', async () => {
    const items = await listItems(session, projectId)
    const unlinked = items.find(item => item.id === unlinkedTaskId)!
    expect(unlinked).toBeDefined()
    expect(Array.isArray(unlinked.itemSprints)).toBe(true)
    expect(unlinked.itemSprints).toHaveLength(0)
    expect(unlinked.sprintId).toBeNull()
  })

  test('filtro client-side do Board reproduzido: item com sprint aparece, item sem sprint some', async () => {
    const items = await listItems(session, projectId)
    // Mesma predicate usada em BoardScreen.tsx: i.itemSprints?.some(...)
    const filtered = items.filter(item => item.itemSprints?.some(sprint => sprint.sprintId === sprintId))
    expect(filtered.some(item => item.id === linkedTaskId)).toBe(true)
    expect(filtered.some(item => item.id === unlinkedTaskId)).toBe(false)
  })

  test('filtro server-side ?sprintId= devolve apenas itens da sprint', async () => {
    const filtered = await listItems(session, projectId, `?sprintId=${sprintId}`)
    expect(filtered.some(item => item.id === linkedTaskId)).toBe(true)
    expect(filtered.some(item => item.id === unlinkedTaskId)).toBe(false)
  })

  test('item vinculado a duas sprints aparece ao filtrar por qualquer uma delas', async () => {
    const added = await call(session, 'POST', `/projects/${projectId}/items/${linkedTaskId}/sprint`, { sprintId: otherSprintId })
    expect(added.status).toBe(200)

    const items = await listItems(session, projectId)
    const linked = items.find(item => item.id === linkedTaskId)!
    expect(linked.itemSprints).toHaveLength(2)
    const sprintIds = linked.itemSprints!.map(link => link.sprintId)
    expect(sprintIds).toContain(sprintId)
    expect(sprintIds).toContain(otherSprintId)

    for (const target of [sprintId, otherSprintId]) {
      const filtered = items.filter(item => item.itemSprints?.some(link => link.sprintId === target))
      expect(filtered.some(item => item.id === linkedTaskId)).toBe(true)
    }
  })
})
