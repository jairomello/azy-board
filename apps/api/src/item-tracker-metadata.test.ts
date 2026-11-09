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
  return { status: response.status, data: (text ? JSON.parse(text) : null) as JsonRecord }
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

  test('cria item com status, responsável externo, datas e chave externa', async () => {
    const created = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Atividade com metadados',
      type: 'TASK',
      parentId: storyId,
      status: 'IN_PROGRESS',
      assigneeLabel: 'Infra Vivo',
      actualStartDate: '2026-01-10',
      actualDueDate: '2026-01-20',
      baselineStartDate: '2026-01-01',
      baselineDueDate: '2026-01-15',
      externalSource: 'planilha',
      externalRef: 'ref-001',
    })
    expect(created.status).toBe(201)
    expect(created.data.status).toBe('IN_PROGRESS')
    expect(created.data.assigneeLabel).toBe('Infra Vivo')
    expect(created.data.actualStartDate).toBe('2026-01-10')
    expect(created.data.actualDueDate).toBe('2026-01-20')
    expect(created.data.baselineStartDate).toBe('2026-01-01')
    expect(created.data.baselineDueDate).toBe('2026-01-15')
    expect(created.data.externalSource).toBe('planilha')
    expect(created.data.externalRef).toBe('ref-001')
  })

  test('sem status, herda o status-base da coluna', async () => {
    const created = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Atividade concluída por coluna',
      type: 'TASK',
      parentId: storyId,
      columnId: doneColumnId,
    })
    expect(created.status).toBe(201)
    expect(created.data.status).toBe('DONE')
  })

  test('rejeita par de chave externa incompleto', async () => {
    const created = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Chave incompleta',
      type: 'TASK',
      parentId: storyId,
      externalSource: 'planilha',
    })
    expect(created.status).toBe(422)
    expect(created.data.error.code).toBe('INVALID_EXTERNAL_REF')
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

  test('rejeita chave externa duplicada no mesmo projeto', async () => {
    const created = await call(session, 'POST', `/projects/${projectId}/items`, {
      title: 'Chave duplicada',
      type: 'TASK',
      parentId: storyId,
      externalSource: 'planilha',
      externalRef: 'ref-001',
    })
    expect(created.status).toBe(409)
    expect(created.data.error.code).toBe('EXTERNAL_REF_DUPLICATED')
  })

  test('upsert cria, repete sem duplicar e atualiza', async () => {
    const first = await call(session, 'PUT', `/projects/${projectId}/items/by-external-ref`, {
      title: 'Atividade via upsert',
      type: 'TASK',
      parentId: storyId,
      externalSource: 'planilha',
      externalRef: 'ref-upsert',
      assigneeLabel: 'Squad Técnica NT',
    })
    expect(first.status).toBe(201)
    expect(first.data.created).toBe(true)
    const itemId = first.data.item.id

    const second = await call(session, 'PUT', `/projects/${projectId}/items/by-external-ref`, {
      title: 'Atividade via upsert (atualizada)',
      type: 'TASK',
      parentId: storyId,
      externalSource: 'planilha',
      externalRef: 'ref-upsert',
      status: 'DONE',
      actualStartDate: '2026-03-01',
      actualDueDate: '2026-03-02',
    })
    expect(second.status).toBe(200)
    expect(second.data.created).toBe(false)
    expect(second.data.item.id).toBe(itemId)
    expect(second.data.item.title).toBe('Atividade via upsert (atualizada)')
    expect(second.data.item.status).toBe('DONE')

    const listed = await call(session, 'GET', `/projects/${projectId}/items?externalSource=planilha&externalRef=ref-upsert`)
    expect(listed.status).toBe(200)
    expect((listed.data as unknown as { data: Array<{ id: string }> }).data).toHaveLength(1)
  })

  test('upsert exige título na criação', async () => {
    const created = await call(session, 'PUT', `/projects/${projectId}/items/by-external-ref`, {
      type: 'TASK',
      parentId: storyId,
      externalSource: 'planilha',
      externalRef: 'ref-sem-titulo',
    })
    expect(created.status).toBe(422)
    expect(created.data.error.code).toBe('TITLE_REQUIRED')
  })

  test('viewer não pode fazer upsert', async () => {
    const created = await call(viewerSession, 'PUT', `/projects/${projectId}/items/by-external-ref`, {
      title: 'Sem permissão',
      type: 'TASK',
      parentId: storyId,
      externalSource: 'planilha',
      externalRef: 'ref-viewer',
    })
    expect(created.status).toBe(403)
  })

  test('a mesma chave em outro tenant não colide', async () => {
    const tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Outro Tenant', slug: `outro-${tenantId}`, createdAt: new Date().toISOString() })
    const other = await createUser(tenantId, 'outro-admin@test.local', 'ADMIN')
    const project = await call(other.session, 'POST', '/projects', { name: 'Outro Projeto', boardMode: 'HIERARCHICAL' })
    const otherProjectId = project.data.id
    const module = await call(other.session, 'POST', `/projects/${otherProjectId}/modules`, { name: 'Módulo' })
    const epic = await call(other.session, 'POST', `/projects/${otherProjectId}/items`, { title: 'Épico', type: 'EPIC', moduleId: module.data.id })
    const story = await call(other.session, 'POST', `/projects/${otherProjectId}/items`, { title: 'História', type: 'STORY', parentId: epic.data.id })

    const created = await call(other.session, 'PUT', `/projects/${otherProjectId}/items/by-external-ref`, {
      title: 'Mesma chave em outro tenant',
      type: 'TASK',
      parentId: story.data.id,
      externalSource: 'planilha',
      externalRef: 'ref-001',
    })
    expect(created.status).toBe(201)
    expect(created.data.item.externalRef).toBe('ref-001')
  })
})
