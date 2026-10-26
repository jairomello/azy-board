import { beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users } = await import('./db/schema')
const { hashPassword, signJwt, verifyPassword } = await import('./services/auth')
const { passwordPolicyIssues } = await import('./services/passwordPolicy')
const { generateId } = await import('./utils/id')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')

await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })

const ORIGINAL = 'Original123!'

async function token(userId: string, tenantId: string) {
  return signJwt({ sub: userId, tenantId, email: `${userId}@test.local`, role: 'user' })
}

async function request(path: string, session: string, init: RequestInit = {}) {
  return app.fetch(new Request(`http://test.local/api${path}`, {
    ...init,
    headers: { cookie: `session=${session}`, 'Content-Type': 'application/json', ...init.headers },
  }))
}

async function storedHash(userId: string) {
  return (await db.query.users.findFirst({ where: eq(users.id, userId) }))?.passwordHash ?? ''
}

async function createTenantUser(tenantId: string, name: string, globalGroup: 'ROOT' | 'ADMIN' | 'TEAM_MEMBER') {
  const id = generateId()
  await db.insert(users).values({
    id, tenantId, email: `${name}-${id}@test.local`, passwordHash: await hashPassword(ORIGINAL), name,
    theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup, createdAt: new Date().toISOString(),
  })
  return { id, session: await token(id, tenantId) }
}

describe('redefinição de senha por ROOT (admin reset-password)', () => {
  let tenantId: string
  let otherTenantId: string
  let root: { id: string; session: string }
  let admin: { id: string; session: string }
  let target: { id: string; session: string }
  let outsider: { id: string; session: string }

  beforeAll(async () => {
    tenantId = generateId()
    otherTenantId = generateId()
    await db.insert(tenants).values([
      { id: tenantId, name: 'Tenant Reset', slug: `reset-${tenantId}`, createdAt: new Date().toISOString() },
      { id: otherTenantId, name: 'Outro Tenant', slug: `reset-other-${otherTenantId}`, createdAt: new Date().toISOString() },
    ])
    root = await createTenantUser(tenantId, 'root', 'ROOT')
    admin = await createTenantUser(tenantId, 'admin', 'ADMIN')
    target = await createTenantUser(tenantId, 'target', 'TEAM_MEMBER')
    outsider = await createTenantUser(otherTenantId, 'outsider', 'TEAM_MEMBER')
  })

  test('ROOT redefine a senha e recebe uma senha temporária fora do hash', async () => {
    const response = await request(`/users/${target.id}/reset-password`, root.session, { method: 'POST' })
    expect(response.status).toBe(200)
    const body = await response.json() as { ok: boolean; userId: string; temporaryPassword: string }
    expect(body.ok).toBe(true)
    expect(body.userId).toBe(target.id)
    expect(body.temporaryPassword.length).toBeGreaterThanOrEqual(8)
    expect(passwordPolicyIssues(body.temporaryPassword)).toEqual([])
    expect(body).not.toHaveProperty('passwordHash')
    expect(await verifyPassword(body.temporaryPassword, await storedHash(target.id))).toBe(true)
    expect(await verifyPassword(ORIGINAL, await storedHash(target.id))).toBe(false)
  })

  test('cada redefinição gera uma senha temporária diferente', async () => {
    const first = await request(`/users/${target.id}/reset-password`, root.session, { method: 'POST' })
    const second = await request(`/users/${target.id}/reset-password`, root.session, { method: 'POST' })
    const firstBody = await first.json() as { temporaryPassword: string }
    const secondBody = await second.json() as { temporaryPassword: string }
    expect(firstBody.temporaryPassword).not.toBe(secondBody.temporaryPassword)
    expect(await verifyPassword(secondBody.temporaryPassword, await storedHash(target.id))).toBe(true)
  })

  test('ADMIN não pode redefinir a senha de outra pessoa', async () => {
    const before = await storedHash(target.id)
    const response = await request(`/users/${target.id}/reset-password`, admin.session, { method: 'POST' })
    expect(response.status).toBe(403)
    expect(await storedHash(target.id)).toBe(before)
  })

  test('usuário comum não pode redefinir a própria senha por esta rota', async () => {
    const response = await request(`/users/${target.id}/reset-password`, target.session, { method: 'POST' })
    expect(response.status).toBe(403)
  })

  test('ROOT de um tenant não redefine usuário de outro tenant (anti-IDOR)', async () => {
    const before = await storedHash(outsider.id)
    const response = await request(`/users/${outsider.id}/reset-password`, root.session, { method: 'POST' })
    expect(response.status).toBe(404)
    expect(await storedHash(outsider.id)).toBe(before)
  })

  test('alvo inexistente responde 404', async () => {
    const response = await request(`/users/${generateId()}/reset-password`, root.session, { method: 'POST' })
    expect(response.status).toBe(404)
  })
})
