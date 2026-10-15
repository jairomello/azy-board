import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users, memberships } = await import('./db/schema')
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

type ColumnResponse = {
  id: string
  name: string
  baseStatus: string
  progressWeight: number
  progressWeightOverride: number | null
}

let tenantId: string
let adminId: string
let viewerId: string
let adminSession: string
let viewerSession: string
let projectId: string

beforeAll(async () => {
  tenantId = generateId()
  const now = new Date().toISOString()
  await db.insert(tenants).values({ id: tenantId, name: 'Tenant Progresso', slug: `t-${tenantId}`, createdAt: now })
  adminId = generateId()
  viewerId = generateId()
  await db.insert(users).values([
    { id: adminId, tenantId, email: `admin-${adminId}@test.local`, passwordHash: 'hash', name: 'Admin Progresso', theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: now },
    { id: viewerId, tenantId, email: `viewer-${viewerId}@test.local`, passwordHash: 'hash', name: 'Viewer Progresso', theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'TEAM_MEMBER', createdAt: now },
  ])
  adminSession = await token(adminId, tenantId)
  viewerSession = await token(viewerId, tenantId)

  const created = await request('/projects', adminSession, {
    method: 'POST', body: JSON.stringify({ name: 'Projeto Progresso', boardMode: 'SIMPLE' }),
  })
  expect(created.status).toBe(201)
  projectId = ((await created.json()) as { id: string }).id

  // O criador já vira ADMIN do projeto; só o VIEWER precisa de membership própria.
  await db.insert(memberships).values({ id: generateId(), tenantId, projectId, userId: viewerId, role: 'VIEWER', createdAt: now })
})

async function listColumns(session = adminSession): Promise<ColumnResponse[]> {
  const response = await request(`/projects/${projectId}/columns`, session)
  expect(response.status).toBe(200)
  return await response.json() as ColumnResponse[]
}

async function patchColumn(columnId: string, body: unknown, session = adminSession) {
  return request(`/projects/${projectId}/columns/${columnId}`, session, { method: 'PATCH', body: JSON.stringify(body) })
}

describe('peso de avanço no contrato de colunas', () => {
  test('projeto novo deriva o peso do status base e da posição', async () => {
    const columns = await listColumns()
    const byName = new Map(columns.map(column => [column.name, column]))
    expect(byName.get('Backlog')?.progressWeight).toBe(0)
    expect(byName.get('A Fazer')?.progressWeight).toBe(0)
    // Três colunas em progresso distribuem a faixa entre 50 e 90.
    expect(byName.get('Fazendo')?.progressWeight).toBe(50)
    expect(byName.get('A Testar')?.progressWeight).toBe(70)
    expect(byName.get('Testando')?.progressWeight).toBe(90)
    expect(byName.get('Concluídas')?.progressWeight).toBe(100)
    // Nenhuma coluna em progresso vale 100.
    expect(columns.filter(column => column.baseStatus === 'IN_PROGRESS').every(column => column.progressWeight < 100)).toBe(true)
    // Sem valor explícito, o override é nulo em todas.
    expect(columns.every(column => column.progressWeightOverride === null)).toBe(true)
  })

  test('peso explícito tem precedência e sai da distribuição', async () => {
    const target = (await listColumns()).find(column => column.name === 'A Testar')!
    const response = await patchColumn(target.id, { progressWeight: 80 })
    expect(response.status).toBe(200)
    const { column } = await response.json() as { column: ColumnResponse }
    expect(column.progressWeight).toBe(80)
    expect(column.progressWeightOverride).toBe(80)

    const columns = await listColumns()
    const byName = new Map(columns.map(item => [item.name, item]))
    // "A Testar" sai da faixa; restam "Fazendo" e "Testando" na distribuição.
    expect(byName.get('A Testar')?.progressWeight).toBe(80)
    expect(byName.get('Fazendo')?.progressWeight).toBe(50)
    expect(byName.get('Testando')?.progressWeight).toBe(90)
  })

  test('limpar o override volta ao valor derivado', async () => {
    const target = (await listColumns()).find(column => column.name === 'A Testar')!
    const response = await patchColumn(target.id, { progressWeight: null })
    expect(response.status).toBe(200)
    const columns = await listColumns()
    const column = columns.find(item => item.name === 'A Testar')!
    expect(column.progressWeightOverride).toBeNull()
    expect(column.progressWeight).toBe(70)
  })

  test('alterar apenas o nome não mexe no peso', async () => {
    const before = await listColumns()
    const target = before.find(column => column.name === 'Fazendo')!
    const response = await patchColumn(target.id, { name: 'Em execução' })
    expect(response.status).toBe(200)
    const after = await listColumns()
    const renamed = after.find(column => column.id === target.id)!
    expect(renamed.name).toBe('Em execução')
    expect(renamed.progressWeight).toBe(50)
    expect(renamed.progressWeightOverride).toBeNull()
  })
})

describe('validação do peso de avanço', () => {
  test('recusa valor fora de 0–100 e valor não inteiro', async () => {
    const target = (await listColumns()).find(column => column.name === 'Concluídas')!
    expect((await patchColumn(target.id, { progressWeight: 101 })).status).toBe(400)
    expect((await patchColumn(target.id, { progressWeight: -1 })).status).toBe(400)
    expect((await patchColumn(target.id, { progressWeight: 55.5 })).status).toBe(400)
    expect((await patchColumn(target.id, { progressWeight: '80' })).status).toBe(400)
  })

  test('aceita os limites 0 e 100', async () => {
    const target = (await listColumns()).find(column => column.name === 'Concluídas')!
    expect((await patchColumn(target.id, { progressWeight: 0 })).status).toBe(200)
    expect((await listColumns()).find(column => column.id === target.id)?.progressWeight).toBe(0)
    expect((await patchColumn(target.id, { progressWeight: 100 })).status).toBe(200)
    expect((await listColumns()).find(column => column.id === target.id)?.progressWeight).toBe(100)
    await patchColumn(target.id, { progressWeight: null })
  })

  test('valida o peso também na criação de coluna', async () => {
    const invalid = await request(`/projects/${projectId}/columns`, adminSession, {
      method: 'POST', body: JSON.stringify({ name: 'Inválida', baseStatus: 'IN_PROGRESS', progressWeight: 150 }),
    })
    expect(invalid.status).toBe(400)

    const valid = await request(`/projects/${projectId}/columns`, adminSession, {
      method: 'POST', body: JSON.stringify({ name: 'Homologação', baseStatus: 'IN_PROGRESS', progressWeight: 95 }),
    })
    expect(valid.status).toBe(201)
    const created = await valid.json() as ColumnResponse
    expect(created.progressWeight).toBe(95)
    expect(created.progressWeightOverride).toBe(95)
  })
})

describe('permissão do peso de avanço', () => {
  test('VIEWER lê os pesos mas não altera', async () => {
    const columns = await listColumns(viewerSession)
    expect(columns.length).toBeGreaterThan(0)
    expect(columns.every(column => typeof column.progressWeight === 'number')).toBe(true)

    const target = columns[0]!
    const response = await patchColumn(target.id, { progressWeight: 10 }, viewerSession)
    expect(response.status).toBe(403)
  })
})

afterAll(async () => {
  await db.delete(memberships).where(eq(memberships.tenantId, tenantId))
})
