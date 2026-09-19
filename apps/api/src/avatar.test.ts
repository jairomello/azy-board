import { beforeAll, describe, expect, test } from 'bun:test'
import sharp from 'sharp'

process.env.DATABASE_URL = ':memory:'
process.env.MAX_AVATAR_SIZE = '819200'

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
    headers: { cookie: `session=${session}`, ...init.headers },
  }))
}

async function createTenantUser(prefix: string) {
  const tenantId = generateId()
  await db.insert(tenants).values({ id: tenantId, name: `Tenant ${prefix}`, slug: `t-${tenantId}`, createdAt: new Date().toISOString() })
  const userId = generateId()
  await db.insert(users).values({
    id: userId,
    tenantId,
    email: `${prefix}@test.local`,
    passwordHash: 'hash',
    name: `Usuário ${prefix}`,
    theme: 'light',
    lightShellTheme: 'petroleum',
    language: 'pt-BR',
    globalGroup: 'ADMIN',
    createdAt: new Date().toISOString(),
  })
  return { tenantId, userId, session: await token(userId, tenantId) }
}

function avatarForm(data: Uint8Array, type = 'image/png', name = 'avatar.png') {
  const form = new FormData()
  form.append('file', new File([data as BlobPart], name, { type }))
  return form
}

async function pngBuffer(size = 64, color = { r: 10, g: 120, b: 220 }) {
  return sharp({ create: { width: size, height: size, channels: 3, background: color } }).png().toBuffer()
}

describe('foto de perfil (Card T2)', () => {
  let tenantId: string
  let userId: string
  let session: string

  beforeAll(async () => {
    const created = await createTenantUser('avatar-owner')
    tenantId = created.tenantId
    userId = created.userId
    session = created.session
  })

  test('upload válido normaliza para 256x256, grava no store e versiona a URL', async () => {
    const png = await pngBuffer(200)
    const response = await request('/users/me/avatar', session, { method: 'PUT', body: avatarForm(png) })
    expect(response.status).toBe(200)

    const body = await response.json() as { user: { avatarUrl: string | null } }
    expect(body.user.avatarUrl).toBeString()
    expect(body.user.avatarUrl).toContain(`/api/users/${userId}/avatar?v=`)

    const stored = await db.query.userAvatars.findFirst({
      where: (a, { and, eq }) => and(eq(a.tenantId, tenantId), eq(a.userId, userId)),
    })
    expect(stored).toBeTruthy()
    expect(stored?.width).toBe(256)
    expect(stored?.height).toBe(256)
    expect(stored?.mimeType).toBe('image/webp')
    expect(stored?.sizeBytes).toBeGreaterThan(0)
    expect(stored?.sizeBytes).toBeLessThan(800 * 1024)
  })

  test('serve a imagem com headers de segurança/cache e honra If-None-Match', async () => {
    const first = await request(`/users/${userId}/avatar`, session)
    expect(first.status).toBe(200)
    expect(first.headers.get('content-type')).toBe('image/webp')
    expect(first.headers.get('x-content-type-options')).toBe('nosniff')
    expect(first.headers.get('cache-control')).toContain('private')
    const etag = first.headers.get('etag')
    expect(etag).toBeString()
    const bytes = new Uint8Array(await first.arrayBuffer())
    expect(bytes.byteLength).toBeGreaterThan(0)

    const cached = await request(`/users/${userId}/avatar`, session, { headers: { 'if-none-match': etag! } })
    expect(cached.status).toBe(304)
  })

  test('rejeita arquivo que não é imagem (magic bytes)', async () => {
    const response = await request('/users/me/avatar', session, {
      method: 'PUT',
      body: avatarForm(new TextEncoder().encode('não é uma imagem'), 'text/plain', 'nota.txt'),
    })
    expect(response.status).toBe(415)
  })

  test('rejeita upload acima do limite de tamanho', async () => {
    const big = new Uint8Array(900 * 1024)
    const response = await request('/users/me/avatar', session, {
      method: 'PUT',
      body: avatarForm(big, 'image/png', 'grande.png'),
    })
    expect(response.status).toBe(413)
  })

  test('DELETE remove a foto e volta avatarUrl para null', async () => {
    const removed = await request('/users/me/avatar', session, { method: 'DELETE' })
    expect(removed.status).toBe(200)
    const body = await removed.json() as { user: { avatarUrl: string | null } }
    expect(body.user.avatarUrl).toBeNull()

    const stored = await db.query.userAvatars.findFirst({
      where: (a, { and, eq }) => and(eq(a.tenantId, tenantId), eq(a.userId, userId)),
    })
    expect(stored).toBeFalsy()

    const gone = await request(`/users/${userId}/avatar`, session)
    expect(gone.status).toBe(404)
  })

  test('isolamento entre tenants: outro tenant recebe 404', async () => {
    const other = await createTenantUser('avatar-stranger')
    await request('/users/me/avatar', session, { method: 'PUT', body: avatarForm(await pngBuffer(80)) })

    const allowed = await request(`/users/${userId}/avatar`, session)
    expect(allowed.status).toBe(200)

    const blocked = await request(`/users/${userId}/avatar`, other.session)
    expect(blocked.status).toBe(404)
  })
})
