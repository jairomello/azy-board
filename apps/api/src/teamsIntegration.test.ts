import { beforeAll, describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import { eq } from 'drizzle-orm'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db, sqlite } = await import('./db/index')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
sqlite.exec('PRAGMA foreign_keys = OFF;')
await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })
sqlite.exec('PRAGMA foreign_keys = ON;')

const { tenants, users, projects, items, memberships } = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')

async function token(userId: string, tenantId: string, email: string) {
  return signJwt({ sub: userId, tenantId, email, role: 'user' })
}

async function request(path: string, session: string, init?: RequestInit) {
  return app.fetch(new Request(`http://test.local/api${path}`, {
    ...init,
    headers: { cookie: `session=${session}`, ...(init?.headers ?? {}) },
  }))
}

function teamsPayload(messageId: string, text: string) {
  return JSON.stringify({ type: 'message', id: messageId, text, from: { name: 'Lincoln Siqueira' } })
}

function sign(body: string, secret: string) {
  return createHmac('sha256', Buffer.from(secret, 'base64')).update(body).digest('base64')
}

describe('E5 — criação de card pelo Teams', () => {
  const now = new Date().toISOString()
  const tenantId = generateId()
  const projectId = generateId()
  const adminId = generateId()
  const memberId = generateId()
  const adminEmail = `${adminId}@teams.test`
  const memberEmail = `${memberId}@teams.test`
  const secret = Buffer.from('segredo-de-teste-do-teams').toString('base64')
  let adminSession = ''
  let memberSession = ''
  let storyId = ''
  let publicToken = ''

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Teams tenant', slug: `tm-${tenantId.slice(0, 8)}`, createdAt: now })
    await db.insert(users).values([
      { id: adminId, tenantId, email: adminEmail, passwordHash: 'h', name: 'Admin Teams', globalGroup: 'ADMIN', createdAt: now },
      { id: memberId, tenantId, email: memberEmail, passwordHash: 'h', name: 'Member Teams', createdAt: now },
    ])
    await db.insert(projects).values({ id: projectId, tenantId, name: 'Projeto Teams', managerUserId: adminId, createdAt: now })
    await db.insert(memberships).values([
      { id: generateId(), tenantId, userId: adminId, projectId, role: 'ADMIN', createdAt: now },
      { id: generateId(), tenantId, userId: memberId, projectId, role: 'MEMBER', createdAt: now },
    ])
    storyId = generateId()
    await db.insert(items).values({
      id: storyId, tenantId, projectId, type: 'STORY', title: 'Entrada pelo Teams', ancestryPath: '[]',
      status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, createdAt: now, updatedAt: now,
    })
    adminSession = await token(adminId, tenantId, adminEmail)
    memberSession = await token(memberId, tenantId, memberEmail)
  })

  test('ADMIN configura a integração e recebe a URL com token', async () => {
    const response = await request(`/projects/${projectId}/integrations/teams`, adminSession, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamsSecret: secret, parentItemId: storyId, defaultType: 'TASK', enabled: true }),
    })
    expect(response.status).toBe(200)
    const body = await response.json() as { configured: boolean; url: string; enabled: boolean }
    expect(body.configured).toBe(true)
    expect(body.enabled).toBe(true)
    expect(body.url).toContain('/api/integrations/teams/messages/')
    publicToken = body.url.split('/').pop()!
    expect(publicToken.length).toBeGreaterThan(20)
  })

  test('MEMBER não configura nem lê a integração', async () => {
    const read = await request(`/projects/${projectId}/integrations/teams`, memberSession)
    expect(read.status).toBe(403)
    const write = await request(`/projects/${projectId}/integrations/teams`, memberSession, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamsSecret: secret }),
    })
    expect(write.status).toBe(403)
  })

  test('token desconhecido responde 404', async () => {
    const response = await app.fetch(new Request(`http://test.local/api/integrations/teams/messages/nao-existe`, { method: 'POST', body: teamsPayload('x', 'criar teste') }))
    expect(response.status).toBe(404)
  })

  test('assinatura inválida responde 401 e não cria card', async () => {
    const body = teamsPayload('m-invalid', '<at>Azy</at> criar card sem assinatura')
    const response = await app.fetch(new Request(`http://test.local/api/integrations/teams/messages/${publicToken}`, {
      method: 'POST', body, headers: { Authorization: 'HMAC abc' },
    }))
    expect(response.status).toBe(401)
  })

  test('mensagem válida cria o card no bolsão com descrição e datas', async () => {
    const body = teamsPayload('m-1', '<p><at id="0">Azy</at>&nbsp;criar atividade de teste; detalhar a desc do teste; 12/12/26; 13/12/26</p>')
    const response = await app.fetch(new Request(`http://test.local/api/integrations/teams/messages/${publicToken}`, {
      method: 'POST', body, headers: { Authorization: `HMAC ${sign(body, secret)}` },
    }))
    expect(response.status).toBe(200)
    const reply = await response.json() as { text: string }
    expect(reply.text).toContain('atividade de teste')
    expect(reply.text).toContain('início 2026-12-12')
    expect(reply.text).toContain('fim 2026-12-13')

    const [created] = await db.select().from(items).where(eq(items.projectId, projectId)).limit(20)
    const card = (await db.select().from(items).where(eq(items.projectId, projectId))).find(row => row.title === 'atividade de teste')
    expect(card).toBeDefined()
    expect(card?.type).toBe('TASK')
    expect(card?.description).toContain('detalhar a desc do teste')
    expect(card?.startDate).toBe('2026-12-12')
    expect(card?.dueDate).toBe('2026-12-13')
    expect(card?.parentId).toBe(storyId)
    expect(card?.assigneeId).toBeNull()
    expect(card?.assigneeLabel).toBeNull()
    expect(card?.externalSource).toBe('TEAMS')
    expect(created).toBeDefined()
  })

  test('a mesma mensagem não cria um segundo card', async () => {
    const body = teamsPayload('m-1', '<p><at id="0">Azy</at>&nbsp;criar atividade de teste; detalhar a desc do teste; 12/12/26; 13/12/26</p>')
    const response = await app.fetch(new Request(`http://test.local/api/integrations/teams/messages/${publicToken}`, {
      method: 'POST', body, headers: { Authorization: `HMAC ${sign(body, secret)}` },
    }))
    expect(response.status).toBe(200)
    const reply = await response.json() as { text: string }
    expect(reply.text).toContain('já criado')
    const cards = (await db.select().from(items).where(eq(items.projectId, projectId))).filter(row => row.title === 'atividade de teste')
    expect(cards).toHaveLength(1)
  })

  test('mensagem sem criar é ignorada com orientação', async () => {
    const body = teamsPayload('m-2', '<at>Azy</at> oi, tudo bem?')
    const response = await app.fetch(new Request(`http://test.local/api/integrations/teams/messages/${publicToken}`, {
      method: 'POST', body, headers: { Authorization: `HMAC ${sign(body, secret)}` },
    }))
    expect(response.status).toBe(200)
    const reply = await response.json() as { text: string }
    expect(reply.text).toContain('@Azy criar')
  })

  test('GET devolve a configuração e as últimas mensagens', async () => {
    const response = await request(`/projects/${projectId}/integrations/teams`, adminSession)
    expect(response.status).toBe(200)
    const body = await response.json() as { configured: boolean; url: string; messages: Array<{ status: string }> }
    expect(body.configured).toBe(true)
    expect(body.url).toContain(publicToken)
    expect(body.messages.length).toBeGreaterThanOrEqual(2)
    expect(body.messages.some(message => message.status === 'CREATED')).toBe(true)
    expect(body.messages.some(message => message.status === 'IGNORED')).toBe(true)
  })

  test('DELETE remove a integração e a URL deixa de resolver', async () => {
    const response = await request(`/projects/${projectId}/integrations/teams`, adminSession, { method: 'DELETE' })
    expect(response.status).toBe(200)
    const body = teamsPayload('m-3', 'criar depois de remover')
    const after = await app.fetch(new Request(`http://test.local/api/integrations/teams/messages/${publicToken}`, {
      method: 'POST', body, headers: { Authorization: `HMAC ${sign(body, secret)}` },
    }))
    expect(after.status).toBe(404)
  })
})
