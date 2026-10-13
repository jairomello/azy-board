import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users } = await import('./db/schema')
const { hashPassword, signJwt, verifyPassword } = await import('./services/auth')
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

function changePassword(session: string, body: unknown) {
  return request('/users/me/password', session, { method: 'PATCH', body: JSON.stringify(body) })
}

async function storedHash(userId: string) {
  return (await db.query.users.findFirst({ where: eq(users.id, userId) }))?.passwordHash ?? ''
}

const CURRENT = 'Atual123!'

describe('troca de senha pelo próprio usuário (change account-password-change)', () => {
  let tenantId: string
  let userId: string
  let session: string

  beforeAll(async () => {
    tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant Senha', slug: `t-${tenantId}`, createdAt: new Date().toISOString() })
    userId = generateId()
    await db.insert(users).values({
      id: userId, tenantId, email: `pw-${userId}@test.local`, passwordHash: await hashPassword(CURRENT), name: 'Senha Owner',
      theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'TEAM_MEMBER', createdAt: new Date().toISOString(),
    })
    session = await token(userId, tenantId)
  })

  test('troca a senha com a senha atual correta e passa a valer a nova', async () => {
    const response = await changePassword(session, { currentPassword: CURRENT, newPassword: 'Nova456!', confirmPassword: 'Nova456!' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(await verifyPassword('Nova456!', await storedHash(userId))).toBe(true)
    expect(await verifyPassword(CURRENT, await storedHash(userId))).toBe(false)
  })

  test('recusa senha atual incorreta com 401 e não altera a senha', async () => {
    const before = await storedHash(userId)
    const response = await changePassword(session, { currentPassword: 'Errada999!', newPassword: 'Outra789!', confirmPassword: 'Outra789!' })
    expect(response.status).toBe(401)
    expect(await storedHash(userId)).toBe(before)
  })

  test('recusa confirmação divergente com 400', async () => {
    const before = await storedHash(userId)
    const response = await changePassword(session, { currentPassword: 'Nova456!', newPassword: 'Outra789!', confirmPassword: 'Diferente789!' })
    expect(response.status).toBe(400)
    expect(await storedHash(userId)).toBe(before)
  })

  test('recusa nova senha fora da política com 400', async () => {
    const response = await changePassword(session, { currentPassword: 'Nova456!', newPassword: 'fraca', confirmPassword: 'fraca' })
    expect(response.status).toBe(400)
  })

  test('recusa nova senha igual à atual com 400', async () => {
    const response = await changePassword(session, { currentPassword: 'Nova456!', newPassword: 'Nova456!', confirmPassword: 'Nova456!' })
    expect(response.status).toBe(400)
  })

  test('ignora identificador de usuário enviado pelo cliente (anti-IDOR)', async () => {
    const response = await changePassword(session, { currentPassword: 'Nova456!', newPassword: 'Outra789!', confirmPassword: 'Outra789!', userId: 'outro' })
    expect(response.status).toBe(400)
  })

  test('recusa a troca quando o provedor da instalação é integrado', async () => {
    const previous = { ...process.env }
    process.env.AZYBOARD_AUTH_PROVIDER = 'MICROSOFT'
    process.env.AZYBOARD_AUTH_REDIRECT_URL = 'https://app.test/auth/callback'
    process.env.AZYBOARD_MICROSOFT_CLIENT_ID = 'client-id'
    process.env.AZYBOARD_MICROSOFT_CLIENT_SECRET = 'client-secret'
    process.env.AZYBOARD_MICROSOFT_TENANT_ID = 'tenant-id'
    try {
      const response = await changePassword(session, { currentPassword: 'Nova456!', newPassword: 'Outra789!', confirmPassword: 'Outra789!' })
      expect(response.status).toBe(403)
      const body = await response.json() as { error: { code: string } }
      expect(body.error.code).toBe('PASSWORD_CHANGE_DISABLED')
    } finally {
      process.env.AZYBOARD_AUTH_PROVIDER = previous.AZYBOARD_AUTH_PROVIDER
      delete process.env.AZYBOARD_MICROSOFT_CLIENT_ID
      delete process.env.AZYBOARD_MICROSOFT_CLIENT_SECRET
      delete process.env.AZYBOARD_MICROSOFT_TENANT_ID
      delete process.env.AZYBOARD_AUTH_REDIRECT_URL
    }
  })
})

afterAll(() => {
  delete process.env.AZYBOARD_AUTH_PROVIDER
})
