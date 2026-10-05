// Card T31 — persistência de sessão: durações, renovação deslizante e limite absoluto.
import { afterEach, describe, expect, setSystemTime, test } from 'bun:test'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

process.env.DATABASE_URL = ':memory:'
process.env.TRUST_PROXY = 'true'
process.env.LOGIN_PROGRESSIVE_DELAY_MS = '0'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users } = await import('./db/schema')
const {
  signJwt,
  hashPassword,
  resolveSessionState,
  SESSION_TTL_SECONDS,
  SESSION_REMEMBER_TTL_SECONDS,
  SESSION_MAX_TTL_SECONDS,
} = await import('./services/auth')
const { generateId } = await import('./utils/id')

await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })

const REAL_NOW = Date.now()
afterEach(() => setSystemTime(REAL_NOW))

async function seededUser() {
  const tenantId = generateId()
  await db.insert(tenants).values({ id: tenantId, name: 'Sessão', slug: `sessao-${tenantId}`, createdAt: new Date().toISOString() })
  const userId = generateId()
  const email = `sessao-${userId}@test.local`
  const password = 'SenhaForte!123'
  await db.insert(users).values({
    id: userId, tenantId, email, passwordHash: await hashPassword(password), name: 'Sessão User',
    theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: new Date().toISOString(),
  })
  return { tenantId, userId, email, password }
}

function login(email: string, password: string, extra: Record<string, unknown> = {}) {
  return app.fetch(new Request('http://test.local/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, ...extra }),
  }))
}

function me(session: string) {
  return app.fetch(new Request('http://test.local/api/auth/me', { headers: { cookie: `session=${session}` } }))
}

describe('resolveSessionState (unidade)', () => {
  const now = 1_800_000_000

  test('sessão padrão não renova antes da metade e usa 24h', () => {
    const state = resolveSessionState({ iat: now, rmb: false }, now)
    expect(state).toMatchObject({ expired: false, renew: false, remembered: false, ttlSeconds: SESSION_TTL_SECONDS })
    expect(SESSION_TTL_SECONDS).toBe(86_400)
  })

  test('sessão padrão renova após metade da duração', () => {
    const state = resolveSessionState({ iat: now - 13 * 3600, rmb: false }, now)
    expect(state.renew).toBe(true)
    expect(state.expired).toBe(false)
  })

  test('dispositivo lembrado renova com a duração estendida', () => {
    const state = resolveSessionState({ iat: now - 20 * 86_400, rmb: true }, now)
    expect(state.renew).toBe(true)
    expect(state.remembered).toBe(true)
    expect(state.ttlSeconds).toBe(SESSION_REMEMBER_TTL_SECONDS)
    expect(SESSION_REMEMBER_TTL_SECONDS).toBe(30 * 86_400)
  })

  test('limite absoluto expira mesmo com iat recente', () => {
    const state = resolveSessionState({ iat: now - 3600, rmb: true, authTime: now - SESSION_MAX_TTL_SECONDS }, now)
    expect(state.expired).toBe(true)
    expect(state.renew).toBe(false)
  })

  test('sem authTime usa iat como base do limite absoluto', () => {
    const state = resolveSessionState({ iat: now - SESSION_MAX_TTL_SECONDS }, now)
    expect(state.expired).toBe(true)
  })
})

describe('sessão persistente no login (API)', () => {
  test('login sem lembrar emite cookie de 24h com atributos de segurança', async () => {
    const { email, password } = await seededUser()
    const response = await login(email, password)
    expect(response.status).toBe(200)
    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('session=')
    expect(cookie).toMatch(/max-age=86400/i)
    expect(cookie).toMatch(/httponly/i)
    expect(cookie).toMatch(/samesite=strict/i)
    expect(cookie).toMatch(/path=\//i)
  })

  test('login com lembrar emite cookie estendido de 30 dias', async () => {
    const { email, password } = await seededUser()
    const response = await login(email, password, { remember: true })
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie') ?? '').toMatch(/max-age=2592000/i)
  })

  test('remember com tipo inválido é rejeitado com 400', async () => {
    const { email, password } = await seededUser()
    const response = await login(email, password, { remember: 'sim' })
    expect(response.status).toBe(400)
  })

  test('renova a sessão após metade da duração (rolling)', async () => {
    const { tenantId, userId, email } = await seededUser()
    const t0 = new Date('2026-01-01T00:00:00Z')
    setSystemTime(t0)
    const session = await signJwt({ sub: userId, tenantId, email, role: 'user' })
    setSystemTime(new Date(t0.getTime() + 13 * 3_600_000))
    const response = await me(session)
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie') ?? '').toContain('session=')
  })

  test('sessão além do limite absoluto responde 401 mesmo com exp válido', async () => {
    const { tenantId, userId, email } = await seededUser()
    const authTimeSeconds = Math.floor(Date.parse('2026-01-01T00:00:00Z') / 1000)
    // Token "renovado" perto do limite: exp ainda no futuro, mas authTime já vencido.
    setSystemTime(new Date((authTimeSeconds + Math.floor(SESSION_MAX_TTL_SECONDS - 12 * 3600)) * 1000))
    const session = await signJwt(
      { sub: userId, tenantId, email, role: 'user' },
      { ttlSeconds: SESSION_TTL_SECONDS, authTime: authTimeSeconds },
    )
    setSystemTime(new Date((authTimeSeconds + SESSION_MAX_TTL_SECONDS + 3600) * 1000))
    const response = await me(session)
    expect(response.status).toBe(401)
  })
})
