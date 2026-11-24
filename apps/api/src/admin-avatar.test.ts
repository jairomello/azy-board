import { fileURLToPath } from 'node:url'

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

await migrate(db, { migrationsFolder: fileURLToPath(new URL('./db/migrations', import.meta.url)) })

async function token(userId: string, tenantId: string) {
  return signJwt({ sub: userId, tenantId, email: `${userId}@test.local`, role: 'user' })
}

async function request(path: string, session: string, init: RequestInit = {}) {
  return app.fetch(new Request(`http://test.local/api${path}`, {
    ...init,
    headers: { cookie: `session=${session}`, ...init.headers },
  }))
}

async function createTenant(prefix: string) {
  const tenantId = generateId()
  await db.insert(tenants).values({ id: tenantId, name: `Tenant ${prefix}`, slug: `t-${tenantId}`, createdAt: new Date().toISOString() })
  return tenantId
}

async function createUser(tenantId: string, prefix: string, globalGroup: 'TEAM_MEMBER' | 'MANAGER' | 'ADMIN' | 'ROOT') {
  const userId = generateId()
  await db.insert(users).values({
    id: userId,
    tenantId,
    email: `${prefix}-${userId}@test.local`,
    passwordHash: 'hash',
    name: `Usuário ${prefix}`,
    theme: 'light',
    lightShellTheme: 'petroleum',
    language: 'pt-BR',
    globalGroup,
    createdAt: new Date().toISOString(),
  })
  return { userId, session: await token(userId, tenantId) }
}

function avatarForm(data: Uint8Array, type = 'image/png', name = 'avatar.png') {
  const form = new FormData()
  form.append('file', new File([data as BlobPart], name, { type }))
  return form
}

async function pngBuffer(size = 64, color = { r: 10, g: 120, b: 220 }) {
  return sharp({ create: { width: size, height: size, channels: 3, background: color } }).png().toBuffer()
}

async function findStoredAvatar(tenantId: string, userId: string) {
  return db.query.userAvatars.findFirst({
    where: (a, { and, eq }) => and(eq(a.tenantId, tenantId), eq(a.userId, userId)),
  })
}

describe('foto de perfil pela Administração de usuários', () => {
  let tenantId: string
  let admin: { userId: string; session: string }
  let root: { userId: string; session: string }
  let manager: { userId: string; session: string }
  let member: { userId: string; session: string }
  let target: { userId: string; session: string }
  let outsider: { userId: string; session: string; tenantId: string }

  beforeAll(async () => {
    tenantId = await createTenant('admin-avatar')
    admin = await createUser(tenantId, 'admin', 'ADMIN')
    root = await createUser(tenantId, 'root', 'ROOT')
    manager = await createUser(tenantId, 'manager', 'MANAGER')
    member = await createUser(tenantId, 'member', 'TEAM_MEMBER')
    target = await createUser(tenantId, 'target', 'TEAM_MEMBER')
    const otherTenantId = await createTenant('admin-avatar-outsider')
    const otherUser = await createUser(otherTenantId, 'outsider', 'ADMIN')
    outsider = { ...otherUser, tenantId: otherTenantId }
  })

  test('Admin inclui a foto de outro usuário e a URI é versionada pelo alvo', async () => {
    const png = await pngBuffer(200)
    const response = await request(`/users/${target.userId}/avatar`, admin.session, { method: 'PUT', body: avatarForm(png) })
    expect(response.status).toBe(200)

    const body = await response.json() as { user: { id: string; avatarUrl: string | null; globalGroup: string } }
    expect(body.user.id).toBe(target.userId)
    expect(body.user.globalGroup).toBe('TEAM_MEMBER')
    expect(body.user.avatarUrl).toContain(`/api/users/${target.userId}/avatar?v=`)

    const stored = await findStoredAvatar(tenantId, target.userId)
    expect(stored).toBeTruthy()
    expect(stored?.width).toBe(256)
    expect(stored?.height).toBe(256)

    // O alvo enxerga a própria foto pela rota autenticada, sem trocar de sessão.
    const served = await request(`/users/${target.userId}/avatar`, target.session)
    expect(served.status).toBe(200)
    expect(served.headers.get('content-type')).toBe('image/webp')
  })

  test('Root inclui a foto de um Admin', async () => {
    const response = await request(`/users/${admin.userId}/avatar`, root.session, {
      method: 'PUT',
      body: avatarForm(await pngBuffer(120, { r: 200, g: 60, b: 90 })),
    })
    expect(response.status).toBe(200)
    const body = await response.json() as { user: { avatarUrl: string | null } }
    expect(body.user.avatarUrl).toContain(`/api/users/${admin.userId}/avatar?v=`)
  })

  test('Membro e Gerente não alteram nem removem a foto de outro usuário', async () => {
    for (const actor of [member, manager]) {
      const put = await request(`/users/${target.userId}/avatar`, actor.session, { method: 'PUT', body: avatarForm(await pngBuffer(80)) })
      expect(put.status).toBe(403)
      const del = await request(`/users/${target.userId}/avatar`, actor.session, { method: 'DELETE' })
      expect(del.status).toBe(403)
    }
    // A foto gravada pelo Admin permanece intacta.
    const stillThere = await request(`/users/${target.userId}/avatar`, admin.session)
    expect(stillThere.status).toBe(200)
  })

  test('Admin substitui a foto e a URL/ETag passam a refletir a nova versão', async () => {
    const before = await request(`/users/${target.userId}/avatar`, admin.session)
    const previousEtag = before.headers.get('etag')
    const previousUrl = (await request(`/users?limit=100`, admin.session)
      .then(response => response.json()) as { data: Array<{ id: string; avatarUrl: string | null }> })
      .data.find(user => user.id === target.userId)?.avatarUrl

    const response = await request(`/users/${target.userId}/avatar`, admin.session, {
      method: 'PUT',
      body: avatarForm(await pngBuffer(150, { r: 5, g: 5, b: 5 })),
    })
    expect(response.status).toBe(200)
    const body = await response.json() as { user: { avatarUrl: string | null } }
    expect(body.user.avatarUrl).not.toBe(previousUrl)

    const after = await request(`/users/${target.userId}/avatar`, admin.session)
    expect(after.status).toBe(200)
    expect(after.headers.get('etag')).not.toBe(previousEtag)
  })

  test('validação preserva a foto anterior: 413 acima do limite, 415 formato inválido, 400 multipart inválido', async () => {
    const before = await request(`/users/${target.userId}/avatar`, admin.session)
    const previousEtag = before.headers.get('etag')

    const tooLarge = await request(`/users/${target.userId}/avatar`, admin.session, {
      method: 'PUT',
      body: avatarForm(new Uint8Array(900 * 1024), 'image/png', 'grande.png'),
    })
    expect(tooLarge.status).toBe(413)
    expect((await tooLarge.json() as { error: { code: string } }).error.code).toBe('PAYLOAD_TOO_LARGE')

    const notAnImage = await request(`/users/${target.userId}/avatar`, admin.session, {
      method: 'PUT',
      body: avatarForm(new TextEncoder().encode('não é uma imagem'), 'text/plain', 'nota.txt'),
    })
    expect(notAnImage.status).toBe(415)

    const invalidMultipart = await request(`/users/${target.userId}/avatar`, admin.session, {
      method: 'PUT',
      body: JSON.stringify({ file: 'nada' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(invalidMultipart.status).toBe(400)

    const after = await request(`/users/${target.userId}/avatar`, admin.session)
    expect(after.status).toBe(200)
    expect(after.headers.get('etag')).toBe(previousEtag)
  })

  test('alvo de outro tenant responde 404 e não grava nem remove foto', async () => {
    const put = await request(`/users/${target.userId}/avatar`, outsider.session, { method: 'PUT', body: avatarForm(await pngBuffer(80)) })
    expect(put.status).toBe(404)

    const del = await request(`/users/${target.userId}/avatar`, outsider.session, { method: 'DELETE' })
    expect(del.status).toBe(404)

    const unknownTarget = await request(`/users/${generateId()}/avatar`, admin.session, { method: 'DELETE' })
    expect(unknownTarget.status).toBe(404)

    // O usuário do outro tenant continua sem foto e o alvo original segue com a dele.
    const outsiderPhoto = await request(`/users/${outsider.userId}/avatar`, outsider.session)
    expect(outsiderPhoto.status).toBe(404)
    const targetPhoto = await request(`/users/${target.userId}/avatar`, admin.session)
    expect(targetPhoto.status).toBe(200)
  })

  test('Admin remove a foto de outro usuário e volta ao avatar por iniciais', async () => {
    const removed = await request(`/users/${target.userId}/avatar`, admin.session, { method: 'DELETE' })
    expect(removed.status).toBe(200)
    const body = await removed.json() as { user: { id: string; avatarUrl: string | null } }
    expect(body.user.id).toBe(target.userId)
    expect(body.user.avatarUrl).toBeNull()

    expect(await findStoredAvatar(tenantId, target.userId)).toBeFalsy()
    const gone = await request(`/users/${target.userId}/avatar`, admin.session)
    expect(gone.status).toBe(404)
  })

  test('autoatendimento segue disponível para Membro, sem colidir com a rota administrativa', async () => {
    const upload = await request('/users/me/avatar', member.session, { method: 'PUT', body: avatarForm(await pngBuffer(100)) })
    expect(upload.status).toBe(200)
    const body = await upload.json() as { user: { id: string; avatarUrl: string | null } }
    expect(body.user.id).toBe(member.userId)
    expect(body.user.avatarUrl).toContain(`/api/users/${member.userId}/avatar?v=`)

    const removed = await request('/users/me/avatar', member.session, { method: 'DELETE' })
    expect(removed.status).toBe(200)
    expect((await removed.json() as { user: { avatarUrl: string | null } }).user.avatarUrl).toBeNull()
  })
})
