import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users } = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')
const { resetSkillArchiveCache } = await import('./services/skillArchive')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')

await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })

async function token(userId: string, tenantId: string) {
  return signJwt({ sub: userId, tenantId, email: `${userId}@test.local`, role: 'user' })
}

async function request(path: string, session?: string) {
  return app.fetch(new Request(`http://test.local/api${path}`, {
    headers: session ? { cookie: `session=${session}` } : {},
  }))
}

let tenantId: string
let userId: string
let session: string

beforeAll(async () => {
  tenantId = generateId()
  await db.insert(tenants).values({ id: tenantId, name: 'Tenant Skill', slug: `t-${tenantId}`, createdAt: new Date().toISOString() })
  userId = generateId()
  await db.insert(users).values({
    id: userId, tenantId, email: `skill-${userId}@test.local`, passwordHash: 'hash', name: 'Skill Owner',
    theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'TEAM_MEMBER', createdAt: new Date().toISOString(),
  })
  session = await token(userId, tenantId)
})

describe('GET /api/skills/azyboard/download', () => {
  test('entrega o .zip da skill com os cabeçalhos esperados', async () => {
    const response = await request('/skills/azyboard/download', session)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/zip')
    const disposition = response.headers.get('content-disposition') ?? ''
    expect(disposition).toMatch(/attachment; filename="azyboard-skill-.+\.zip"/)
    const bytes = new Uint8Array(await response.arrayBuffer())
    // Assinatura local file header do ZIP: PK\x03\x04.
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect(bytes.length).toBeGreaterThan(1000)
  })

  test('recusa sem sessão com 401', async () => {
    const response = await request('/skills/azyboard/download')
    expect(response.status).toBe(401)
  })

  test('diretório da skill ausente responde erro claro apontando AZYBOARD_SKILL_DIR', async () => {
    const previous = process.env.AZYBOARD_SKILL_DIR
    process.env.AZYBOARD_SKILL_DIR = '/caminho/inexistente/azyboard'
    resetSkillArchiveCache()
    try {
      const response = await request('/skills/azyboard/download', session)
      expect(response.status).toBe(500)
      const body = await response.json() as { error: { code: string; details: { hint?: string } } }
      expect(body.error.code).toBe('SKILL_UNAVAILABLE')
      expect(body.error.details.hint).toMatch(/AZYBOARD_SKILL_DIR/)
    } finally {
      if (previous === undefined) delete process.env.AZYBOARD_SKILL_DIR
      else process.env.AZYBOARD_SKILL_DIR = previous
      resetSkillArchiveCache()
    }
  })
})

afterAll(() => {
  resetSkillArchiveCache()
})
