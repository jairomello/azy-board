import { beforeAll, describe, expect, test } from 'bun:test'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users } = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')

await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })

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
  await db.insert(tenants).values({ id: tenantId, name: 'Tenant Planejado', slug: `t-${tenantId}`, createdAt: now })
  await db.insert(users).values({
    id: adminId, tenantId, email: `admin-${adminId}@test.local`, passwordHash: 'hash', name: 'Admin Planejado',
    theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: now,
  })
  adminSession = await token(adminId, tenantId)
  const created = await request('/projects', adminSession, {
    method: 'POST', body: JSON.stringify({ name: 'Projeto Planejado', boardMode: 'SIMPLE' }),
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

async function plannedColumn(): Promise<ColumnResponse> {
  const existing = (await listColumns()).find(column => column.baseStatus === 'PLANNED')
  if (existing) return existing
  const created = await createColumn('Planejado', 'PLANNED')
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

describe('status base planejado em colunas', () => {
  test('cria coluna PLANNED com peso 0', async () => {
    const created = await createColumn('Planejado', 'PLANNED')
    expect(created.status).toBe(201)
    expect(created.body.baseStatus).toBe('PLANNED')
    expect(created.body.progressWeight).toBe(0)
  })

  test('aceita os status base já documentados (BLOCKED e CANCELLED)', async () => {
    expect((await createColumn('Bloqueadas', 'BLOCKED')).status).toBe(201)
    expect((await createColumn('Canceladas', 'CANCELLED')).status).toBe(201)
  })

  test('recusa status base fora do enum', async () => {
    const response = await request(`/projects/${projectId}/columns`, adminSession, {
      method: 'POST', body: JSON.stringify({ name: 'Inválida', baseStatus: 'A Fazer' }),
    })
    expect(response.status).toBe(400)
  })
})

describe('card em coluna planejada', () => {
  test('mover para Planejado grava status PLANNED e não altera o peso', async () => {
    const planned = await plannedColumn()
    const task = await createTask('Card planejado')
    expect(task.status).toBe('NOT_STARTED')

    const moved = await moveItem(task.id, planned.id)
    expect(moved.status).toBe('PLANNED')
    expect(moved.columnId).toBe(planned.id)

    const columns = await listColumns()
    expect(columns.find(column => column.id === planned.id)?.progressWeight).toBe(0)
    // A faixa do fluxo não muda: Planejado não entra na distribuição 50–90.
    const flowWeights = columns
      .filter(column => column.baseStatus === 'IN_PROGRESS' || column.baseStatus === 'BLOCKED')
      .map(column => column.progressWeight)
      .sort((a, b) => a - b)
    expect(flowWeights[0]).toBe(50)
    expect(flowWeights.at(-1)).toBe(90)
    expect(columns.filter(column => column.baseStatus === 'PLANNED').every(column => column.progressWeight === 0)).toBe(true)
  })

  test('liberar o card preserva o status da coluna', async () => {
    const planned = await plannedColumn()
    const task = await createTask('Card liberado')
    await moveItem(task.id, planned.id)

    const response = await request(`/projects/${projectId}/items/${task.id}/release`, adminSession, { method: 'PATCH' })
    expect(response.status).toBe(200)
    const released = (await response.json() as { item: ItemResponse }).item
    expect(released.status).toBe('PLANNED')
    expect(released.columnId).toBe(planned.id)
  })

  test('trocar o status base da coluna acompanha os cards sincronizados', async () => {
    const planned = await plannedColumn()
    const task = await createTask('Card acompanha a coluna')
    await moveItem(task.id, planned.id)

    const changed = await request(`/projects/${projectId}/columns/${planned.id}`, adminSession, {
      method: 'PATCH', body: JSON.stringify({ baseStatus: 'IN_PROGRESS' }),
    })
    expect(changed.status).toBe(200)

    const item = await (await request(`/projects/${projectId}/items/${task.id}`, adminSession)).json() as ItemResponse
    expect(item.status).toBe('IN_PROGRESS')

    // Restaura a coluna e o card para não contaminar os demais testes.
    await request(`/projects/${projectId}/columns/${planned.id}`, adminSession, {
      method: 'PATCH', body: JSON.stringify({ baseStatus: 'PLANNED' }),
    })
    const restored = await (await request(`/projects/${projectId}/items/${task.id}`, adminSession)).json() as ItemResponse
    expect(restored.status).toBe('PLANNED')
  })

  test('status divergente na coluna é preservado ao trocar o status base', async () => {
    const planned = await plannedColumn()
    const task = await createTask('Card bloqueado na coluna')
    await moveItem(task.id, planned.id)
    await request(`/projects/${projectId}/items/${task.id}`, adminSession, {
      method: 'PATCH', body: JSON.stringify({ status: 'BLOCKED' }),
    })

    await request(`/projects/${projectId}/columns/${planned.id}`, adminSession, {
      method: 'PATCH', body: JSON.stringify({ baseStatus: 'IN_PROGRESS' }),
    })
    const item = await (await request(`/projects/${projectId}/items/${task.id}`, adminSession)).json() as ItemResponse
    expect(item.status).toBe('BLOCKED')

    await request(`/projects/${projectId}/columns/${planned.id}`, adminSession, {
      method: 'PATCH', body: JSON.stringify({ baseStatus: 'PLANNED' }),
    })
  })

  test('criação aceita status PLANNED explícito', async () => {
    const task = await createTask('Card criado planejado')
    const response = await request(`/projects/${projectId}/items/${task.id}`, adminSession, {
      method: 'PATCH', body: JSON.stringify({ status: 'PLANNED' }),
    })
    expect(response.status).toBe(200)
    expect(((await response.json()) as { item: ItemResponse }).item.status).toBe('PLANNED')
  })
})
