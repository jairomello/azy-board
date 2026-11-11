import { beforeAll, describe, expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users } = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')

await migrate(db, { migrationsFolder: fileURLToPath(new URL('./db/migrations', import.meta.url)) })

async function token(userId: string, tenantId: string) {
  return signJwt({ sub: userId, tenantId, email: `${userId}@test.local`, role: 'user' })
}

async function request(path: string, session: string, init: RequestInit = {}) {
  return app.fetch(new Request(`http://test.local/api${path}`, {
    ...init,
    headers: { cookie: `session=${session}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  }))
}

type ColumnResponse = { id: string; name: string; baseStatus: string; progressWeight: number }
type ItemResponse = { id: string; status: string; columnId: string | null }

let tenantId: string
let adminId: string
let adminSession: string
let projectId: string

beforeAll(async () => {
  tenantId = generateId()
  adminId = generateId()
  const now = new Date().toISOString()
  await db.insert(tenants).values({ id: tenantId, name: 'Tenant Homologação', slug: `t-${tenantId}`, createdAt: now })
  await db.insert(users).values({
    id: adminId, tenantId, email: `admin-${adminId}@test.local`, passwordHash: 'hash', name: 'Admin Homologação',
    theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: now,
  })
  adminSession = await token(adminId, tenantId)
  const created = await request('/projects', adminSession, {
    method: 'POST', body: JSON.stringify({ name: 'Projeto Homologação', boardMode: 'SIMPLE' }),
  })
  expect(created.status).toBe(201)
  projectId = ((await created.json()) as { id: string }).id
})

async function listColumns(): Promise<ColumnResponse[]> {
  const response = await request(`/projects/${projectId}/columns`, adminSession)
  expect(response.status).toBe(200)
  return await response.json() as ColumnResponse[]
}

async function createColumn(name: string, baseStatus: string) {
  const response = await request(`/projects/${projectId}/columns`, adminSession, {
    method: 'POST', body: JSON.stringify({ name, baseStatus }),
  })
  return { status: response.status, body: await response.json() as ColumnResponse }
}

async function homologationColumn(): Promise<ColumnResponse> {
  const existing = (await listColumns()).find(column => column.baseStatus === 'IN_HOMOLOGATION')
  if (existing) return existing
  const created = await createColumn('Em Homologação', 'IN_HOMOLOGATION')
  expect(created.status).toBe(201)
  return created.body
}

async function createTask(title: string) {
  const response = await request(`/projects/${projectId}/items`, adminSession, {
    method: 'POST', body: JSON.stringify({ title, type: 'TASK' }),
  })
  expect(response.status).toBe(201)
  return await response.json() as ItemResponse
}

async function moveItem(itemId: string, columnId: string) {
  const response = await request(`/projects/${projectId}/items/${itemId}/move`, adminSession, {
    method: 'PATCH', body: JSON.stringify({ columnId }),
  })
  expect(response.status).toBe(200)
  return (await response.json() as { item: ItemResponse }).item
}

describe('status base em homologação', () => {
  test('cria coluna IN_HOMOLOGATION com peso na faixa do fluxo', async () => {
    const created = await createColumn('Em Homologação', 'IN_HOMOLOGATION')
    expect(created.status).toBe(201)
    expect(created.body.baseStatus).toBe('IN_HOMOLOGATION')
    // É a última coluna do fluxo: vale o teto da faixa, sem chegar ao DONE.
    expect(created.body.progressWeight).toBe(90)
  })

  test('recusa o nome da coluna no lugar do status base', async () => {
    const response = await request(`/projects/${projectId}/columns`, adminSession, {
      method: 'POST', body: JSON.stringify({ name: 'Inválida', baseStatus: 'Em Homologação' }),
    })
    expect(response.status).toBe(400)
  })
})

describe('card em homologação', () => {
  test('mover para a coluna grava status IN_HOMOLOGATION', async () => {
    const homologation = await homologationColumn()
    const task = await createTask('Card em homologação')
    expect(task.status).toBe('NOT_STARTED')

    const moved = await moveItem(task.id, homologation.id)
    expect(moved.status).toBe('IN_HOMOLOGATION')
    expect(moved.columnId).toBe(homologation.id)
  })

  test('homologação participa da faixa do fluxo, que continua fechando em 90', async () => {
    await homologationColumn()
    const columns = await listColumns()
    const flowWeights = columns
      .filter(column => ['IN_PROGRESS', 'IN_HOMOLOGATION', 'BLOCKED'].includes(column.baseStatus))
      .map(column => column.progressWeight)
      .sort((a, b) => a - b)
    expect(flowWeights[0]).toBe(50)
    expect(flowWeights.at(-1)).toBe(90)
    expect(columns.filter(column => column.baseStatus === 'DONE').every(column => column.progressWeight === 100)).toBe(true)
  })

  test('aceita status IN_HOMOLOGATION explícito no card', async () => {
    const task = await createTask('Card homologado direto')
    const response = await request(`/projects/${projectId}/items/${task.id}`, adminSession, {
      method: 'PATCH', body: JSON.stringify({ status: 'IN_HOMOLOGATION' }),
    })
    expect(response.status).toBe(200)
    expect(((await response.json()) as { item: ItemResponse }).item.status).toBe('IN_HOMOLOGATION')
  })

  test('filtra cards por IN_HOMOLOGATION', async () => {
    const homologation = await homologationColumn()
    const task = await createTask('Card filtrável')
    await moveItem(task.id, homologation.id)

    const response = await request(`/projects/${projectId}/items?status=IN_HOMOLOGATION&onlyLeaves=true`, adminSession)
    expect(response.status).toBe(200)
    const items = (await response.json() as { data: Array<{ id: string; status: string }> }).data
    expect(items.some(item => item.id === task.id && item.status === 'IN_HOMOLOGATION')).toBe(true)
  })

  test('o board markdown marca homologação como em andamento', async () => {
    const homologation = await homologationColumn()
    const task = await createTask('Card no markdown')
    await moveItem(task.id, homologation.id)

    const response = await request(`/projects/${projectId}/board.md`, adminSession)
    expect(response.status).toBe(200)
    const markdown = await response.text()
    expect(markdown).toContain(`[/] #${task.id.slice(0, 8)}`)
  })
})
