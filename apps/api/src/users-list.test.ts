import { beforeAll, describe, expect, test } from 'bun:test'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users } = await import('./db/schema')
const { hashPassword, signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')

await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })

interface ListedUser { id: string; name: string; email: string; globalGroup: string }
interface ListedPage { data: ListedUser[]; page: number; limit: number; total: number; hasMore: boolean }

async function token(userId: string, tenantId: string) {
  return signJwt({ sub: userId, tenantId, email: `${userId}@test.local`, role: 'user' })
}

async function request(path: string, session: string) {
  return app.fetch(new Request(`http://test.local/api${path}`, {
    headers: { cookie: `session=${session}` },
  }))
}

async function list(session: string, query = ''): Promise<{ status: number; body: ListedPage }> {
  const response = await request(`/users${query}`, session)
  return { status: response.status, body: await response.json() as ListedPage }
}

async function insertUser(tenantId: string, name: string, email: string, globalGroup: 'ROOT' | 'ADMIN' | 'MANAGER' | 'TEAM_MEMBER') {
  const id = generateId()
  await db.insert(users).values({
    id, tenantId, email, passwordHash: await hashPassword('Senha123!'), name,
    theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup, createdAt: new Date().toISOString(),
  })
  return id
}

describe('GET /users — listagem administrativa paginada', () => {
  let tenantId: string
  let otherTenantId: string
  let adminSession: string
  let memberSession: string

  beforeAll(async () => {
    tenantId = generateId()
    otherTenantId = generateId()
    await db.insert(tenants).values([
      { id: tenantId, name: 'Tenant Lista', slug: `lista-${tenantId}`, createdAt: new Date().toISOString() },
      { id: otherTenantId, name: 'Tenant Alheio', slug: `lista-other-${otherTenantId}`, createdAt: new Date().toISOString() },
    ])
    const adminId = await insertUser(tenantId, 'Admin Root', 'admin@test.local', 'ADMIN')
    const memberId = await insertUser(tenantId, 'Membro', 'membro@test.local', 'TEAM_MEMBER')
    await insertUser(tenantId, 'Álvaro Silva', 'alvaro@test.local', 'TEAM_MEMBER')
    await insertUser(tenantId, 'ana Souza', 'ana@test.local', 'MANAGER')
    await insertUser(tenantId, 'Bruno Lima', 'bruno@test.local', 'MANAGER')
    await insertUser(tenantId, 'Zélia Prado', 'zelia@test.local', 'TEAM_MEMBER')
    await insertUser(otherTenantId, 'Forasteiro', 'forasteiro@test.local', 'ADMIN')
    adminSession = await token(adminId, tenantId)
    memberSession = await token(memberId, tenantId)
  })

  test('ordena alfabeticamente com dobra de acentos e retorna o envelope paginado', async () => {
    const { status, body } = await list(adminSession)
    expect(status).toBe(200)
    expect(body.data.map(user => user.name)).toEqual([
      'Admin Root', 'Álvaro Silva', 'ana Souza', 'Bruno Lima', 'Membro', 'Zélia Prado',
    ])
    expect(body).toMatchObject({ page: 1, limit: 25, total: 6, hasMore: false })
    // Nenhum usuário de outro tenant e nenhum hash de senha no payload.
    expect(body.data.some(user => user.name === 'Forasteiro')).toBe(false)
    expect(body.data.every(user => !('passwordHash' in user))).toBe(true)
  })

  test('pagina por página e sinaliza hasMore', async () => {
    const first = await list(adminSession, '?page=1&limit=4')
    expect(first.body.data.map(user => user.name)).toEqual(['Admin Root', 'Álvaro Silva', 'ana Souza', 'Bruno Lima'])
    expect(first.body).toMatchObject({ page: 1, limit: 4, total: 6, hasMore: true })

    const second = await list(adminSession, '?page=2&limit=4')
    expect(second.body.data.map(user => user.name)).toEqual(['Membro', 'Zélia Prado'])
    expect(second.body).toMatchObject({ page: 2, limit: 4, total: 6, hasMore: false })
  })

  test('busca por nome sem acento e por e-mail', async () => {
    const byName = await list(adminSession, '?q=alvaro')
    expect(byName.body.data.map(user => user.name)).toEqual(['Álvaro Silva'])
    expect(byName.body.total).toBe(1)

    const byEmail = await list(adminSession, '?q=zelia@test.local')
    expect(byEmail.body.data.map(user => user.name)).toEqual(['Zélia Prado'])
  })

  test('filtra por grupo e valida o parâmetro', async () => {
    const managers = await list(adminSession, '?globalGroup=MANAGER')
    expect(managers.body.data.map(user => user.name)).toEqual(['ana Souza', 'Bruno Lima'])
    expect(managers.body.total).toBe(2)

    const invalid = await list(adminSession, '?globalGroup=CHEFE')
    expect(invalid.status).toBe(400)
  })

  test('membro comum não acessa a listagem administrativa', async () => {
    const response = await request('/users', memberSession)
    expect(response.status).toBe(403)
  })

  test('normaliza page/limit inválidos e limita o tamanho da página', async () => {
    const zero = await list(adminSession, '?page=0&limit=0')
    expect(zero.body).toMatchObject({ page: 1, limit: 25 })
    const huge = await list(adminSession, '?limit=9999')
    expect(huge.body.limit).toBe(100)
  })
})
