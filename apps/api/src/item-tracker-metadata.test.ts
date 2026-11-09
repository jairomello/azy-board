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

// biome-ignore lint/suspicious/noExplicitAny: JSON arbitrário deserializado nos testes.
type JsonRecord = Record<string, any>

async function call(session: string, method: string, path: string, body?: unknown) {
  const response = await app.fetch(new Request(`http://test.local/api${path}`, {
    method,
    headers: { cookie: `session=${session}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }))
  const text = await response.text()
  let data: JsonRecord | null = null
  try { data = text ? JSON.parse(text) as JsonRecord : null } catch { data = null }
  return { status: response.status, data }
}

async function token(userId: string, tenantId: string, email: string, globalGroup: 'TEAM_MEMBER' | 'ADMIN' = 'ADMIN') {
  return signJwt({ sub: userId, tenantId, email, role: 'user', globalGroup })
}

async function createUser(tenantId: string, email: string, globalGroup: 'TEAM_MEMBER' | 'ADMIN') {
  const userId = generateId()
  await db.insert(users).values({
    id: userId, tenantId, email, passwordHash: 'x', name: email,
    theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup,
    createdAt: new Date().toISOString(),
  })
  return { userId, session: await token(userId, tenantId, email, globalGroup) }
}

describe('metadados do tracker no item', () => {
  let session: string
  let viewerSession: string
  let projectId: string
  let storyId: string
  let doneColumnId: string

  beforeAll(async () => {
    const now = new Date().toISOString()
    const tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant Tracker', slug: `tracker-${tenantId}`, createdAt: now })
    const admin = await createUser(tenantId, 'tracker-admin@test.local', 'ADMIN')
    session = admin.session

    const viewer = await createUser(tenantId, 'tracker-viewer@test.local', 'TEAM_MEMBER')
    viewerSession = viewer.session

    const project = await call(session, 'POST', '/projects', { name: 'Projeto Tracker', boardMode: 'HIERARCHICAL' })
    expect(project.status).toBe(201)
    projectId = project.data.id
    // O viewer precisa ser membro para receber 403 (sem vínculo, o anti-IDOR devolve 404).
    await call(session, 'POST', `/projects/${projectId}/members`, { userId: viewer.userId, role: 'VIEWER' })
    const module = await call(session, 'POST', `/projects/${projectId}/modules`, { name: 'Módulo' })
    const epic = await call(session, 'POST', `/projects/${projectId}/items`, { title: 'Épico', type: 'EPIC', moduleId: module.data.id })
    const story = await call(session, 'POST', `/projects/${projectId}/items`, { title: 'História', type: 'STORY', parentId: epic.data.id })
    storyId = story.data.id
    const columns = await call(session, 'GET', `/projects/${projectId}/columns`)
    doneColumnId = (columns.data as unknown as Array<{ id: string; baseStatus: string }>).find(column => column.baseStatus === 'DONE')!.id
  })

  test('cria item com responsável externo, datas realizadas e chave informativa', async () => {
    const created = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Atividade com metadados',
      type: 'TASK',
      parentId: storyId,
      assigneeLabel: 'Infra Vivo',
      actualStartDate: '2026-01-10',
      actualDueDate: '2026-01-20',
      externalSource: 'planilha',
      externalRef: 'ref-001',
    })
    expect(created.status).toBe(201)
    expect(created.data.status).toBe('NOT_STARTED')
    expect(created.data.assigneeLabel).toBe('Infra Vivo')
    expect(created.data.actualStartDate).toBe('2026-01-10')
    expect(created.data.actualDueDate).toBe('2026-01-20')
    expect(created.data.externalSource).toBe('planilha')
    expect(created.data.externalRef).toBe('ref-001')
  })

  test('a criação força NOT_STARTED mesmo com status ou coluna concluída', async () => {
    const created = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Status ignorado na criação',
      type: 'TASK',
      parentId: storyId,
      columnId: doneColumnId,
      status: 'DONE',
    })
    expect(created.status).toBe(201)
    expect(created.data.status).toBe('NOT_STARTED')
  })

  test('a criação não aceita blockedReason (permanece comportamento anterior)', async () => {
    const created = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Bloqueio na criação',
      type: 'TASK',
      parentId: storyId,
      blockedReason: 'Aguardando fornecedor',
    })
    expect(created.status).toBe(400)
    expect(created.data.error.code).toBe('INVALID_REQUEST')
  })

  test('rejeita datas realizadas incoerentes', async () => {
    const created = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Datas incoerentes',
      type: 'TASK',
      parentId: storyId,
      actualStartDate: '2026-02-10',
      actualDueDate: '2026-02-01',
    })
    expect(created.status).toBe(422)
    expect(created.data.error.code).toBe('INVALID_ACTUAL_DATES')
  })

  test('a chave externa é informativa e pode se repetir', async () => {
    const created = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Chave repetida',
      type: 'TASK',
      parentId: storyId,
      externalSource: 'planilha',
      externalRef: 'ref-001',
    })
    expect(created.status).toBe(201)
    expect(created.data.externalRef).toBe('ref-001')
  })

  test('atualiza status, blockedReason, datas realizadas e responsável externo', async () => {
    const created = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Atividade a atualizar',
      type: 'TASK',
      parentId: storyId,
    })
    expect(created.status).toBe(201)
    const itemId = created.data.id

    const updated = await call(session, 'PATCH', `/projects/${projectId}/items/${itemId}`, {
      status: 'BLOCKED',
      blockedReason: 'Aguardando fornecedor',
      assigneeLabel: 'Squad Técnica NT',
      actualStartDate: '2026-03-01',
      actualDueDate: '2026-03-02',
      externalSource: 'planilha',
      externalRef: 'ref-update',
    })
    expect(updated.status).toBe(200)
    expect(updated.data.item.status).toBe('BLOCKED')
    expect(updated.data.item.blockedReason).toBe('Aguardando fornecedor')
    expect(updated.data.item.assigneeLabel).toBe('Squad Técnica NT')
    expect(updated.data.item.actualStartDate).toBe('2026-03-01')
    expect(updated.data.item.actualDueDate).toBe('2026-03-02')
    expect(updated.data.item.externalRef).toBe('ref-update')
  })

  test('o endpoint de upsert não existe', async () => {
    const created = await call(session, 'PUT', `/projects/${projectId}/items/by-external-ref`, {
      title: 'Sem upsert',
      type: 'TASK',
      parentId: storyId,
      externalSource: 'planilha',
      externalRef: 'ref-upsert',
    })
    expect(created.status).toBe(404)
  })

  test('viewer não pode atualizar metadados', async () => {
    const created = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Item do viewer',
      type: 'TASK',
      parentId: storyId,
    })
    const updated = await call(viewerSession, 'PATCH', `/projects/${projectId}/items/${created.data.id}`, {
      actualStartDate: '2026-04-01',
    })
    expect(updated.status).toBe(403)
  })
})
