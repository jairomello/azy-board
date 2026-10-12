import { beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

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
    headers: { cookie: `session=${session}`, 'Content-Type': 'application/json', ...init.headers },
  }))
}

async function patchMe(session: string, body: unknown) {
  return request('/users/me', session, { method: 'PATCH', body: JSON.stringify(body) })
}

async function createTenantUser(prefix: string) {
  const tenantId = generateId()
  await db.insert(tenants).values({ id: tenantId, name: `Tenant ${prefix}`, slug: `t-${tenantId}`, createdAt: new Date().toISOString() })
  const userId = generateId()
  await db.insert(users).values({
    id: userId, tenantId, email: `${prefix}@test.local`, passwordHash: 'hash', name: `Usuário ${prefix}`,
    theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: new Date().toISOString(),
  })
  return { tenantId, userId, session: await token(userId, tenantId) }
}

async function storedName(userId: string) {
  return (await db.query.users.findFirst({ where: eq(users.id, userId) }))?.name
}

describe('edição do nome de exibição (Card T54)', () => {
  let tenantId: string
  let userId: string
  let session: string

  beforeAll(async () => {
    const created = await createTenantUser('name-owner')
    tenantId = created.tenantId
    userId = created.userId
    session = created.session
  })

  test('salva um nome válido, reflete no retorno e em /auth/me sem novo login', async () => {
    const response = await patchMe(session, { name: '  Jairo A. M. Silva  ' })
    expect(response.status).toBe(200)
    const body = await response.json() as { user: { name: string; email: string } }
    expect(body.user.name).toBe('Jairo A. M. Silva')
    expect(await storedName(userId)).toBe('Jairo A. M. Silva')

    const me = await request('/auth/me', session)
    expect(me.status).toBe(200)
    const meBody = await me.json() as { user: { name: string; email: string } }
    expect(meBody.user.name).toBe('Jairo A. M. Silva')
    expect(meBody.user.email).toBe('name-owner@test.local')
  })

  test('combina nome e preferência na mesma requisição', async () => {
    const response = await patchMe(session, { name: 'Nome Combinado', theme: 'dark' })
    expect(response.status).toBe(200)
    const body = await response.json() as { user: { name: string; theme: string } }
    expect(body.user.name).toBe('Nome Combinado')
    expect(body.user.theme).toBe('dark')
  })

  test('rejeita nome vazio, apenas espaços e acima do limite', async () => {
    expect((await patchMe(session, { name: '' })).status).toBe(400)
    expect((await patchMe(session, { name: '   ' })).status).toBe(400)
    expect((await patchMe(session, { name: 'a'.repeat(201) })).status).toBe(400)
    expect(await storedName(userId)).toBe('Nome Combinado')
  })

  test('rejeita campo desconhecido e e-mail no corpo (schema strict)', async () => {
    expect((await patchMe(session, { nickname: 'x' })).status).toBe(400)
    expect((await patchMe(session, { email: 'novo@test.local' })).status).toBe(400)
    const rows = await db.query.users.findFirst({ where: eq(users.id, userId) })
    expect(rows?.email).toBe('name-owner@test.local')
  })

  test('anti-IDOR: não altera o nome de outro usuário do mesmo tenant', async () => {
    const otherId = generateId()
    await db.insert(users).values({
      id: otherId, tenantId, email: 'name-other@test.local', passwordHash: 'hash', name: 'Outro Usuário',
      theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: new Date().toISOString(),
    })
    // O campo `id` é rejeitado pelo schema strict; nenhum alvo alternativo é aceito.
    const response = await patchMe(session, { name: 'Somente Eu', id: otherId })
    expect(response.status).toBe(400)
    expect(await storedName(otherId)).toBe('Outro Usuário')
    expect(await storedName(userId)).toBe('Nome Combinado')
  })
})
