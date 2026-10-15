import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

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

async function request(path: string, session?: string) {
  return app.fetch(new Request(`http://test.local/api${path}`, {
    headers: session ? { cookie: `session=${session}` } : {},
  }))
}

let tenantId: string
let userId: string
let session: string
const previousHelpDir = process.env.AZYBOARD_HELP_DIR

beforeAll(async () => {
  tenantId = generateId()
  await db.insert(tenants).values({ id: tenantId, name: 'Tenant Ajuda', slug: `t-${tenantId}`, createdAt: new Date().toISOString() })
  userId = generateId()
  await db.insert(users).values({
    id: userId, tenantId, email: `help-${userId}@test.local`, passwordHash: 'hash', name: 'Help Reader',
    theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'TEAM_MEMBER', createdAt: new Date().toISOString(),
  })
  session = await token(userId, tenantId)
})

afterAll(() => {
  if (previousHelpDir === undefined) delete process.env.AZYBOARD_HELP_DIR
  else process.env.AZYBOARD_HELP_DIR = previousHelpDir
})

describe('GET /api/help/index', () => {
  test('entrega os módulos do manual na ordem da fonte, com páginas', async () => {
    const response = await request('/help/index', session)
    expect(response.status).toBe(200)
    const body = await response.json() as {
      version: string
      home: { slug: string } | null
      modules: Array<{ id: string; title: string; order: number; pages: Array<{ slug: string; title: string; order: number; path: string }> }>
    }
    expect(body.version).toHaveLength(64)
    expect(body.home?.slug).toBe('home')
    expect(body.modules.map(module => module.id)).toEqual(['00', '01', '02', '03', '04', '05', '06', '07', '08', '09'])
    expect(body.modules.every(module => module.pages.length > 0)).toBe(true)
    const board = body.modules.find(module => module.id === '04')!
    expect(board.pages[0]!.slug).toBe('04-board-e-visualizacoes')
    const orders = board.pages.slice(1).map(page => page.order)
    expect([...orders].sort((a, b) => a - b)).toEqual(orders)
  })

  test('responde com cache privado e sem armazenamento', async () => {
    const response = await request('/help/index', session)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
})

describe('GET /api/help/pages/:slug', () => {
  test('entrega a página com origem, hash e conteúdo renderizável', async () => {
    const response = await request('/help/pages/04-conhecer-o-board', session)
    expect(response.status).toBe(200)
    const body = await response.json() as { slug: string; title: string; path: string; sha256: string; moduleTitle: string; markdown: string }
    expect(body.slug).toBe('04-conhecer-o-board')
    expect(body.title).toBe('Conhecer o Board')
    expect(body.path).toBe('04 - Board e Visualizacoes/Conhecer o Board.md')
    expect(body.sha256).toHaveLength(64)
    expect(body.moduleTitle).toBe('Board e Visualizações')
    expect(body.markdown).toContain('# Conhecer o Board')
    expect(body.markdown).not.toContain('<details')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
})

describe('acesso e erros da ajuda', () => {
  test('recusa sem sessão e não devolve conteúdo de página', async () => {
    const index = await request('/help/index')
    expect(index.status).toBe(401)
    const page = await request('/help/pages/04-conhecer-o-board')
    expect(page.status).toBe(401)
    const text = await page.text()
    expect(text).not.toContain('Conhecer o Board')
  })

  test('responde 404 para slug fora do escopo, sem revelar conteúdo interno', async () => {
    const response = await request('/help/pages/10-referencia', session)
    expect(response.status).toBe(404)
    const body = await response.json() as { error: { code: string } }
    expect(body.error.code).toBe('HELP_PAGE_NOT_FOUND')
    const text = await request('/help/pages/controle-matriz-de-cobertura-editorial', session).then(item => item.text())
    expect(text).not.toContain('Matriz de Cobertura')
  })

  test('responde HELP_UNAVAILABLE quando a documentação não está na instalação', async () => {
    process.env.AZYBOARD_HELP_DIR = '/caminho/inexistente/wiki'
    try {
      const response = await request('/help/index', session)
      expect(response.status).toBe(500)
      const body = await response.json() as { error: { code: string; retryable: boolean } }
      expect(body.error.code).toBe('HELP_UNAVAILABLE')
      expect(body.error.retryable).toBe(false)
    } finally {
      if (previousHelpDir === undefined) delete process.env.AZYBOARD_HELP_DIR
      else process.env.AZYBOARD_HELP_DIR = previousHelpDir
    }
  })
})
