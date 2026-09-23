import { beforeAll, describe, expect, test } from 'bun:test'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

process.env.DATABASE_URL = ':memory:'
process.env.TRUST_PROXY = 'true'
process.env.LOGIN_PROGRESSIVE_DELAY_MS = '0'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users } = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')

await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })

type JsonRecord = Record<string, any>

async function request(path: string, session: string, init: RequestInit = {}) {
  return app.fetch(new Request(`http://test.local/api${path}`, {
    ...init,
    headers: { cookie: `session=${session}`, ...init.headers },
  }))
}

async function call(session: string, method: string, path: string, body?: unknown) {
  const response = await request(path, session, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, data: (text ? JSON.parse(text) : null) as JsonRecord }
}

async function token(userId: string, tenantId: string, email: string) {
  return signJwt({ sub: userId, tenantId, email, role: 'user' })
}

describe('mutação coordenada de item e tags com concorrência otimista', () => {
  let session: string
  let projectId: string
  let storyId: string
  let tagA: string
  let tagB: string
  let taskId: string

  beforeAll(async () => {
    const now = new Date().toISOString()
    const tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant Tags', slug: `tags-${tenantId}`, createdAt: now })
    const userId = generateId()
    await db.insert(users).values({
      id: userId, tenantId, email: 'tags@test.local', passwordHash: 'x', name: 'Admin Tags',
      theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: now,
    })
    session = await token(userId, tenantId, 'tags@test.local')

    const project = await call(session, 'POST', '/projects', { name: 'Projeto Tags', boardMode: 'HIERARCHICAL' })
    projectId = project.data.id
    const module = await call(session, 'POST', `/projects/${projectId}/modules`, { name: 'Módulo' })
    const epic = await call(session, 'POST', `/projects/${projectId}/items`, { title: 'Épico', type: 'EPIC', moduleId: module.data.id })
    const story = await call(session, 'POST', `/projects/${projectId}/items`, { title: 'História', type: 'STORY', parentId: epic.data.id })
    storyId = story.data.id
    const createdA = await call(session, 'POST', `/projects/${projectId}/tags`, { name: 'tag-a', color: '#111111' })
    const createdB = await call(session, 'POST', `/projects/${projectId}/tags`, { name: 'tag-b', color: '#222222' })
    tagA = createdA.data.id
    tagB = createdB.data.id
  })

  test('POST cria o item já com as tags em uma única operação', async () => {
    const created = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Tarefa com tags', type: 'TASK', parentId: storyId, tagIds: [tagA],
    })
    expect(created.status).toBe(201)
    taskId = created.data.id
    expect(created.data.itemTags).toHaveLength(1)
    expect(created.data.itemTags[0].tag.id).toBe(tagA)
  })

  test('PATCH grava campos e tags atomicamente e devolve as tags resultantes', async () => {
    const updated = await call(session, 'PATCH', `/projects/${projectId}/items/${taskId}`, {
      title: 'Tarefa atualizada', tagIds: [tagB],
    })
    expect(updated.status).toBe(200)
    expect(updated.data.item.title).toBe('Tarefa atualizada')
    expect(updated.data.item.itemTags).toHaveLength(1)
    expect(updated.data.item.itemTags[0].tag.id).toBe(tagB)
  })

  test('tag inválida faz rollback e não altera os campos', async () => {
    const before = await call(session, 'GET', `/projects/${projectId}/items`)
    const beforeItem = (before.data as unknown as Array<{ id: string; title: string }>).find(item => item.id === taskId)

    const rejected = await call(session, 'PATCH', `/projects/${projectId}/items/${taskId}`, {
      title: 'Não deve persistir', tagIds: ['00000000-0000-0000-0000-000000000000'],
    })
    expect(rejected.status).toBe(400)

    const after = await call(session, 'GET', `/projects/${projectId}/items`)
    const afterItem = (after.data as unknown as Array<{ id: string; title: string }>).find(item => item.id === taskId)
    expect(afterItem?.title).toBe(beforeItem?.title)
  })

  test('expectedUpdatedAt atual aplica e versão defasada retorna 409 CONFLICT', async () => {
    const list = await call(session, 'GET', `/projects/${projectId}/items`)
    const current = (list.data as unknown as Array<{ id: string; updatedAt: string }>).find(item => item.id === taskId)!
    const staleUpdatedAt = current.updatedAt

    await Bun.sleep(5)
    const applied = await call(session, 'PATCH', `/projects/${projectId}/items/${taskId}`, {
      title: 'Versão condicional', expectedUpdatedAt: staleUpdatedAt,
    })
    expect(applied.status).toBe(200)

    const conflicted = await call(session, 'PATCH', `/projects/${projectId}/items/${taskId}`, {
      title: 'Não deve sobrescrever', expectedUpdatedAt: staleUpdatedAt,
    })
    expect(conflicted.status).toBe(409)
    expect(conflicted.data.error.code).toBe('CONFLICT')

    const after = await call(session, 'GET', `/projects/${projectId}/items`)
    const afterItem = (after.data as unknown as Array<{ id: string; title: string }>).find(item => item.id === taskId)
    expect(afterItem?.title).toBe('Versão condicional')
  })

  test('rota legada de tags continua funcionando (compatibilidade MCP)', async () => {
    const legacy = await call(session, 'POST', `/projects/${projectId}/items/${taskId}/tags`, { tagIds: [tagA] })
    expect(legacy.status).toBe(200)
    const list = await call(session, 'GET', `/projects/${projectId}/items`)
    const item = (list.data as unknown as Array<{ id: string; itemTags: Array<{ tag: { id: string } }> }>).find(entry => entry.id === taskId)
    expect(item?.itemTags.map(link => link.tag.id)).toEqual([tagA])
  })
})
