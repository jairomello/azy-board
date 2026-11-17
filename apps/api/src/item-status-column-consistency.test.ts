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

type ColumnResponse = { id: string; name: string; baseStatus: string }
type ItemResponse = { id: string; status: string; columnId: string | null; type: string }

let adminSession: string
let projectId: string
let columns: ColumnResponse[]

beforeAll(async () => {
  const tenantId = generateId()
  const adminId = generateId()
  const now = new Date().toISOString()
  await db.insert(tenants).values({ id: tenantId, name: 'Tenant Consistência', slug: `t-${tenantId}`, createdAt: now })
  await db.insert(users).values({
    id: adminId, tenantId, email: `admin-${adminId}@test.local`, passwordHash: 'hash', name: 'Admin Consistência',
    theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: now,
  })
  adminSession = await token(adminId, tenantId)

  const created = await request('/projects', adminSession, {
    method: 'POST', body: JSON.stringify({ name: 'Projeto Consistência', boardMode: 'SIMPLE' }),
  })
  expect(created.status).toBe(201)
  projectId = ((await created.json()) as { id: string }).id

  const columnsResponse = await request(`/projects/${projectId}/columns`, adminSession)
  expect(columnsResponse.status).toBe(200)
  columns = await columnsResponse.json() as ColumnResponse[]
})

async function createTask(title: string): Promise<ItemResponse> {
  const response = await request(`/projects/${projectId}/items`, adminSession, {
    method: 'POST', body: JSON.stringify({ title, type: 'TASK' }),
  })
  expect(response.status).toBe(201)
  return await response.json() as ItemResponse
}

async function patchItem(itemId: string, body: Record<string, unknown>): Promise<ItemResponse> {
  const response = await request(`/projects/${projectId}/items/${itemId}`, adminSession, {
    method: 'PATCH', body: JSON.stringify(body),
  })
  expect(response.status).toBe(200)
  return (await response.json() as { item: ItemResponse }).item
}

function columnBy(name: string): ColumnResponse {
  const column = columns.find(candidate => candidate.name === name)
  if (!column) throw new Error(`Coluna ${name} não encontrada`)
  return column
}

describe('status e coluna do card permanecem coerentes (B22)', () => {
  test('mudar o status pela edição move o card para a primeira coluna compatível', async () => {
    const task = await createTask('Card que entra em andamento')
    expect(task.columnId).toBe(columnBy('Backlog').id)

    const updated = await patchItem(task.id, { status: 'IN_PROGRESS' })

    expect(updated.status).toBe('IN_PROGRESS')
    expect(updated.columnId).toBe(columnBy('Fazendo').id)
  })

  test('voltar o status para não iniciado devolve o card à primeira coluna de entrada', async () => {
    const task = await createTask('Card que volta ao início')
    await patchItem(task.id, { status: 'IN_PROGRESS' })

    const updated = await patchItem(task.id, { status: 'NOT_STARTED' })

    expect(updated.status).toBe('NOT_STARTED')
    expect(updated.columnId).toBe(columnBy('Backlog').id)
  })

  test('mudar a coluna reflete o status base da coluna', async () => {
    const task = await createTask('Card movido pela coluna')

    const updated = await patchItem(task.id, { columnId: columnBy('A Testar').id })

    expect(updated.columnId).toBe(columnBy('A Testar').id)
    expect(updated.status).toBe('IN_PROGRESS')
  })

  test('status sem coluna correspondente não reposiciona o card', async () => {
    const task = await createTask('Card bloqueado')
    const before = await patchItem(task.id, { status: 'BLOCKED' })

    expect(before.status).toBe('BLOCKED')
    expect(before.columnId).toBe(columnBy('Backlog').id)
  })

  test('status informado junto da coluna obedece ao status base da coluna', async () => {
    const task = await createTask('Card com os dois campos')

    const updated = await patchItem(task.id, { columnId: columnBy('Concluídas').id, status: 'BLOCKED' })

    expect(updated.columnId).toBe(columnBy('Concluídas').id)
    expect(updated.status).toBe('DONE')
  })
})
