import { fileURLToPath } from 'node:url'

import { beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

// Teste de caracterização (P0 — rede de segurança do redesenho da página Conta).
// A7-08: PATCH /users/me aceita exatamente os ALLOWED_FIELDS atuais (name, theme,
// lightShellTheme, language, autoThemeByTime), valida cada um, recusa corpo vazio e
// campo desconhecido, e persiste cada preferência no usuário da sessão.

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users } = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')

await migrate(db, { migrationsFolder: fileURLToPath(new URL('./db/migrations', import.meta.url)) })

async function patchMe(session: string, body: unknown) {
  return app.fetch(new Request('http://test.local/api/users/me', {
    method: 'PATCH',
    headers: { cookie: `session=${session}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

async function linhaDoUsuario(userId: string) {
  return db.query.users.findFirst({ where: eq(users.id, userId) })
}

describe('PATCH /users/me — campos aceitos (caracterização)', () => {
  let userId: string
  let session: string

  beforeAll(async () => {
    const tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant prefs', slug: `t-${tenantId}`, createdAt: new Date().toISOString() })
    userId = generateId()
    await db.insert(users).values({
      id: userId, tenantId, email: 'prefs@test.local', passwordHash: 'hash', name: 'Usuário Prefs',
      theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: new Date().toISOString(),
    })
    session = await signJwt({ sub: userId, tenantId, email: 'prefs@test.local', role: 'user' })
  })

  test('aceita cada campo permitido sozinho e persiste no usuário da sessão', async () => {
    const casos: Array<[Record<string, unknown>, string, unknown]> = [
      [{ theme: 'dark' }, 'theme', 'dark'],
      [{ lightShellTheme: 'amethyst' }, 'lightShellTheme', 'amethyst'],
      [{ language: 'es' }, 'language', 'es'],
      [{ autoThemeByTime: true }, 'autoThemeByTime', true],
      [{ name: 'Nome Novo' }, 'name', 'Nome Novo'],
    ]
    for (const [corpo, campo, esperado] of casos) {
      const resposta = await patchMe(session, corpo)
      expect(resposta.status).toBe(200)
      const json = await resposta.json() as { user: Record<string, unknown> }
      expect(json.user[campo]).toBe(esperado)
      expect((await linhaDoUsuario(userId) as Record<string, unknown> | undefined)?.[campo]).toBe(esperado)
    }
  })

  test('a resposta devolve o usuário com as preferências e sem dados sensíveis', async () => {
    const resposta = await patchMe(session, { theme: 'light', language: 'pt-BR', autoThemeByTime: false })
    expect(resposta.status).toBe(200)
    const json = await resposta.json() as { user: Record<string, unknown> }
    expect(Object.keys(json.user).sort()).toEqual(['autoThemeByTime', 'avatarUrl', 'email', 'id', 'language', 'lightShellTheme', 'name', 'theme'])
    expect(json.user).toMatchObject({ theme: 'light', language: 'pt-BR', autoThemeByTime: false })
  })

  test('recusa corpo vazio', async () => {
    expect((await patchMe(session, {})).status).toBe(400)
  })

  test('recusa campo desconhecido, mesmo junto de um campo válido, sem gravar nada', async () => {
    const antes = await linhaDoUsuario(userId)
    for (const corpo of [{ density: 'compact' }, { theme: 'dark', density: 'compact' }, { globalGroup: 'ROOT' }, { avatarUrl: 'x' }]) {
      expect((await patchMe(session, corpo)).status).toBe(400)
    }
    const depois = await linhaDoUsuario(userId)
    expect(depois?.theme).toBe(antes?.theme)
    expect(depois?.globalGroup).toBe('ADMIN')
  })

  test('recusa valores inválidos de cada preferência', async () => {
    expect((await patchMe(session, { theme: 'sepia' })).status).toBe(400)
    expect((await patchMe(session, { lightShellTheme: 'turquesa' })).status).toBe(400)
    expect((await patchMe(session, { language: 'fr' })).status).toBe(400)
    expect((await patchMe(session, { autoThemeByTime: 'sim' })).status).toBe(400)
  })

  test('sem sessão responde 401', async () => {
    const resposta = await app.fetch(new Request('http://test.local/api/users/me', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: 'dark' }),
    }))
    expect(resposta.status).toBe(401)
  })
})
