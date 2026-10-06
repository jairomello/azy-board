import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from 'pg'
import { shouldRunPostgresTests } from './db/postgres/pgTestSupport'
import type { AdvancedFixtureTenant } from './scripts/advancedFixtures'

// [ADVANCED-HTTP] Jornada HTTP real contra PostgreSQL: login/cookie, auth/me,
// projeto, hierarquia EPIC→STORY→TASK, edição/conflito, claim, Dashboard,
// isolamento entre dois tenants, API keys e negativas de assinatura WebSocket.
// Roda apenas com TEST_PG_URL (job `advanced`); ausente, é pulado para manter
// `bun run check` sem serviços externos.
const PG_URL = process.env.TEST_PG_URL ?? 'postgresql://postgres:postgres@localhost:5432/azyboard_advanced_http'
const runPostgres = await shouldRunPostgresTests(PG_URL)
const instanceDir = mkdtempSync(join(tmpdir(), 'azyboard-advanced-http-'))

interface Session {
  cookie: string
  tenant: AdvancedFixtureTenant
}

describe.skipIf(!runPostgres)('ADVANCED HTTP ponta a ponta (PostgreSQL real)', () => {
  let app: { request: (path: string, init?: RequestInit) => Promise<Response> }
  let closeRuntime: () => Promise<void>
  let fixtures: AdvancedFixtureTenant[]

  beforeAll(async () => {
    process.env.AZYBOARD_INSTALL_PROFILE = 'ADVANCED'
    process.env.DATABASE_URL = PG_URL
    process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379'
    process.env.AZYBOARD_INSTANCE_DIR = instanceDir
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = 'advanced-http-test-secret'

    const setup = new Client({ connectionString: PG_URL })
    await setup.connect()
    await setup.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
    await setup.end()

    const migrationsDir = join(import.meta.dir, 'db', 'postgres', 'migrations')
    const files = readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()
    const client = new Client({ connectionString: PG_URL })
    await client.connect()
    for (const file of files) {
      await client.query(readFileSync(join(migrationsDir, file), 'utf8'))
    }
    await client.end()

    const runtime = await import('./persistence/runtime')
    closeRuntime = runtime.closeRuntime
    const { ensureInstallationMarkers } = await import('./db/installationMarkers')
    await ensureInstallationMarkers(runtime.installProfile, runtime.createMarkerStore())

    const { hashPassword } = await import('./services/auth')
    const { seedAdvancedFixtures } = await import('./scripts/advancedFixtures')
    fixtures = await seedAdvancedFixtures(runtime.persistence, { hashPassword, password: 'SenhaForte123!' })

    app = (await import('./index')).app as typeof app
  })

  afterAll(async () => {
    await closeRuntime?.()
  })

  async function login(email: string, password: string): Promise<string> {
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    expect(response.status).toBe(200)
    const match = (response.headers.get('set-cookie') ?? '').match(/session=([^;]+)/)
    expect(match).toBeTruthy()
    return `session=${match![1]}`
  }

  async function session(fixture: AdvancedFixtureTenant): Promise<Session> {
    return { cookie: await login(fixture.adminEmail, fixture.adminPassword), tenant: fixture }
  }

  async function createProject(cookie: string, name: string): Promise<string> {
    const response = await app.request('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name }),
    })
    expect(response.status).toBeLessThan(300)
    return ((await response.json()) as { id: string }).id
  }

  async function createItem(cookie: string, projectId: string, payload: Record<string, unknown>) {
    const response = await app.request(`/api/projects/${projectId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(payload),
    })
    expect(response.status).toBeLessThan(300)
    return (await response.json()) as { id: string; sequenceCode: string | null }
  }

  test('login por cookie e /api/auth/me devolvem a identidade do tenant', async () => {
    const a = await session(fixtures[0]!)
    const me = await app.request('/api/auth/me', { headers: { Cookie: a.cookie } })
    expect(me.status).toBe(200)
    const body = await me.json() as { user: { tenantId: string; email: string } }
    expect(body.user.tenantId).toBe(a.tenant.tenantId)
    expect(body.user.email).toBe(a.tenant.adminEmail)
  })

  test('hierarquia, edição otimista, conflito, claim e Dashboard', async () => {
    const a = await session(fixtures[0]!)
    const projectId = await createProject(a.cookie, 'Projeto Jornada')
    const modules = await (await app.request(`/api/projects/${projectId}/modules`, { headers: { Cookie: a.cookie } })).json() as Array<{ id: string }>

    const epic = await createItem(a.cookie, projectId, { title: 'Epic', type: 'EPIC', moduleId: modules[0]!.id })
    const story = await createItem(a.cookie, projectId, { title: 'Story', type: 'STORY', parentId: epic.id })
    const task = await createItem(a.cookie, projectId, { title: 'Task', type: 'TASK', parentId: story.id })
    expect(task.sequenceCode).toBeTruthy()

    const read = await app.request(`/api/projects/${projectId}/items/${task.id}`, { headers: { Cookie: a.cookie } })
    expect(read.status).toBe(200)
    const current = await read.json() as { updatedAt: string }

    // Edição otimista com a versão lida.
    const updated = await app.request(`/api/projects/${projectId}/items/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: a.cookie },
      body: JSON.stringify({ title: 'Task editada', expectedUpdatedAt: current.updatedAt }),
    })
    expect(updated.status).toBe(200)

    // Conflito: mesma versão já consumida.
    const conflict = await app.request(`/api/projects/${projectId}/items/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: a.cookie },
      body: JSON.stringify({ title: 'Task velha', expectedUpdatedAt: current.updatedAt }),
    })
    expect(conflict.status).toBe(409)

    // Claim: primeiro sucesso, segundo conflito por outro membro.
    const claim = await app.request(`/api/projects/${projectId}/items/${task.id}/claim`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: a.cookie },
      body: JSON.stringify({}),
    })
    expect(claim.status).toBe(200)

    const runtime = await import('./persistence/runtime')
    const { hashPassword } = await import('./services/auth')
    const member = await runtime.persistence.identity.createUser(
      { tenantId: a.tenant.tenantId, actorUserId: null, actorKind: 'SYSTEM' },
      { email: 'member-advanced@advanced.test', passwordHash: await hashPassword('SenhaForte123!'), name: 'Member', globalGroup: 'TEAM_MEMBER' },
    )
    await runtime.persistence.projects.addProjectMember(
      { tenantId: a.tenant.tenantId, actorUserId: member.id, actorKind: 'USER' },
      projectId,
      { userId: member.id, role: 'MEMBER' },
    )
    const memberCookie = await login('member-advanced@advanced.test', 'SenhaForte123!')
    const doubleClaim = await app.request(`/api/projects/${projectId}/items/${task.id}/claim`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: memberCookie },
      body: JSON.stringify({}),
    })
    expect(doubleClaim.status).toBe(409)

    const dashboard = await app.request(`/api/projects/${projectId}/dashboard/snapshot`, { headers: { Cookie: a.cookie } })
    expect(dashboard.status).toBe(200)
  })

  test('create_item idempotente por chave: replay, 409 e retomada PENDING no PostgreSQL', async () => {
    const a = await session(fixtures[0]!)
    const projectId = await createProject(a.cookie, 'Projeto idempotente')
    const modules = await (await app.request(`/api/projects/${projectId}/modules`, { headers: { Cookie: a.cookie } })).json() as Array<{ id: string }>
    const epic = await createItem(a.cookie, projectId, { title: 'Epic idem', type: 'EPIC', moduleId: modules[0]!.id })
    const story = await createItem(a.cookie, projectId, { title: 'Story idem', type: 'STORY', parentId: epic.id })

    const key = 'pg-idempotent-1'
    const send = (body: Record<string, unknown>) => app.request(`/api/projects/${projectId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, Cookie: a.cookie },
      body: JSON.stringify(body),
    })
    const payload = { title: 'Item idempotente', type: 'TASK', parentId: story.id }
    const first = await send(payload)
    expect(first.status).toBe(201)
    const firstBody = await first.json() as { id: string }
    const operationId = first.headers.get('x-operation-id')
    expect(operationId).toBeTruthy()
    const operation = await app.request(`/api/operations/${operationId}`, { headers: { Cookie: a.cookie } })
    expect(operation.status).toBe(200)
    expect((await operation.json() as { status: string }).status).toBe('COMMITTED')

    // Replay com mesmo hash devolve o mesmo recurso, sem nova mutação.
    const replay = await send(payload)
    expect(replay.status).toBe(201)
    expect((await replay.json() as { id: string }).id).toBe(firstBody.id)

    // Mesma chave com payload distinto → 409 sem efeitos.
    const conflict = await send({ ...payload, title: 'Outro título' })
    expect(conflict.status).toBe(409)

    // Crash entre commit e resposta: referência PENDING é retomável por conexão independente.
    const pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    await pg.query(
      `UPDATE idempotency_records SET status = 'PENDING', response_json = $1
       WHERE tenant_id = $2 AND tool = 'create_item.v1' AND project_scope = $3 AND idempotency_key = $4`,
      [JSON.stringify({ status: 201, body: { __pendingOperationId: firstBody.id } }), a.tenant.tenantId, projectId, key],
    )
    await pg.end()
    const resumed = await send(payload)
    expect(resumed.status).toBe(201)
    expect((await resumed.json() as { id: string }).id).toBe(firstBody.id)
  })

  test('[T38] metadados de colunas no PostgreSQL gravam evento no commit', async () => {
    const a = await session(fixtures[0]!)
    const projectId = await createProject(a.cookie, 'Projeto colunas PG')
    const count = async (): Promise<number> => {
      const pg = new Client({ connectionString: PG_URL })
      await pg.connect()
      const result = await pg.query('SELECT count(*)::int AS cnt FROM domain_event_outbox WHERE tenant_id = $1 AND project_id = $2', [a.tenant.tenantId, projectId])
      await pg.end()
      return (result.rows[0] as { cnt: number }).cnt
    }
    const before = await count()
    const response = await app.request(`/api/projects/${projectId}/columns`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a.cookie }, body: JSON.stringify({ name: 'Coluna T38', baseStatus: 'NOT_STARTED' }) })
    expect(response.status).toBeLessThan(300)
    expect(await count()).toBe(before + 1)
  })

  test('[T38] outbox de domínio é gravada no mesmo commit (PostgreSQL)', async () => {
    const a = await session(fixtures[0]!)
    const projectId = await createProject(a.cookie, 'Projeto outbox PG')
    const modules = await (await app.request(`/api/projects/${projectId}/modules`, { headers: { Cookie: a.cookie } })).json() as Array<{ id: string }>
    const countOutbox = async (): Promise<number> => {
      const pg = new Client({ connectionString: PG_URL })
      await pg.connect()
      const result = await pg.query('SELECT count(*)::int AS cnt FROM domain_event_outbox WHERE tenant_id = $1 AND project_id = $2', [a.tenant.tenantId, projectId])
      await pg.end()
      return (result.rows[0] as { cnt: number }).cnt
    }
    const before = await countOutbox()
    await createItem(a.cookie, projectId, { title: 'Epic outbox', type: 'EPIC', moduleId: modules[0]!.id })
    expect(await countOutbox()).toBe(before + 1)
  })

  test('batch e update_items transacionais no PostgreSQL (idempotência e rollback)', async () => {
    const a = await session(fixtures[0]!)
    const projectId = await createProject(a.cookie, 'Projeto batch PG')
    const modules = await (await app.request(`/api/projects/${projectId}/modules`, { headers: { Cookie: a.cookie } })).json() as Array<{ id: string }>
    const epic = await createItem(a.cookie, projectId, { title: 'Epic batch', type: 'EPIC', moduleId: modules[0]!.id })
    const story = await createItem(a.cookie, projectId, { title: 'Story batch', type: 'STORY', parentId: epic.id })

    const batch = (body: Record<string, unknown>) => app.request(`/api/projects/${projectId}/batch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a.cookie }, body: JSON.stringify(body),
    })

    // Parcial com chave: replay devolve o mesmo resultado integral.
    const partial = { idempotencyKey: 'pg-batch-1', operations: [{ tool: 'create_task', args: { title: 'PG batch ok', parentId: story.id } }, { tool: 'create_task', args: { title: '' } }] }
    const first = await batch(partial)
    expect(first.status).toBe(200)
    const firstBody = await first.json() as { results: Array<{ ok: boolean }> }
    expect(firstBody.results.map(result => result.ok)).toEqual([true, false])
    const replay = await batch(partial)
    expect(replay.status).toBe(200)
    expect(await replay.json()).toEqual(firstBody)

    // Atômico com falha reverte domínio e journal; mesma chave retomável.
    const failing = await batch({ idempotencyKey: 'pg-batch-atomic', atomic: true, operations: [{ tool: 'create_task', args: { title: 'PG atomic', parentId: story.id } }, { tool: 'create_task', args: { title: '' } }] })
    expect(failing.status).toBe(422)
    const retry = await batch({ idempotencyKey: 'pg-batch-atomic', atomic: true, operations: [{ tool: 'create_task', args: { title: 'PG retomado', parentId: story.id } }] })
    expect(retry.status).toBe(200)

    // update_items idempotente pelo agentRunId.
    const updateBody = {
      filters: { itemIds: [story.id], types: null, statuses: null, sprint: null, version: null, module: null, assignee: null, parent: null, column: null, tag: null, titleContains: null, onlyLeaves: null, matchAll: false },
      changes: [{ field: 'title', operation: 'SET', value: 'Story batch renomeada' }],
      agentRunId: 'pg-update-1',
    }
    const firstUpdate = await app.request(`/api/projects/${projectId}/batch/items/update`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a.cookie }, body: JSON.stringify(updateBody) })
    expect(firstUpdate.status).toBe(200)
    const firstUpdateBody = await firstUpdate.json()
    const secondUpdate = await app.request(`/api/projects/${projectId}/batch/items/update`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a.cookie }, body: JSON.stringify(updateBody) })
    expect(secondUpdate.status).toBe(200)
    expect(await secondUpdate.json()).toEqual(firstUpdateBody)
  })

  test('[T38] corrida na mesma chave: uma operação lógica e mesmo resultado', async () => {
    const a = await session(fixtures[0]!)
    const projectId = await createProject(a.cookie, 'Projeto corrida')
    const modules = await (await app.request(`/api/projects/${projectId}/modules`, { headers: { Cookie: a.cookie } })).json() as Array<{ id: string }>
    const epic = await createItem(a.cookie, projectId, { title: 'Epic corrida', type: 'EPIC', moduleId: modules[0]!.id })
    const story = await createItem(a.cookie, projectId, { title: 'Story corrida', type: 'STORY', parentId: epic.id })
    const key = 'pg-concurrent-1'
    const send = () => app.request(`/api/projects/${projectId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, Cookie: a.cookie },
      body: JSON.stringify({ title: 'Corrida', type: 'TASK', parentId: story.id }),
    })
    const responses = await Promise.all([send(), send(), send()])
    const statuses = responses.map(response => response.status)
    expect(statuses).toContain(201)
    expect(statuses.every(status => status === 201 || status === 409)).toBe(true)
    const okBodies = await Promise.all(responses.filter(response => response.status === 201).map(response => response.json() as Promise<{ id: string }>))
    expect(new Set(okBodies.map(body => body.id)).size).toBe(1)

    const pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    const count = await pg.query("SELECT count(*)::int AS cnt FROM items WHERE tenant_id = $1 AND project_id = $2 AND title = 'Corrida'", [a.tenant.tenantId, projectId])
    await pg.end()
    expect((count.rows[0] as { cnt: number }).cnt).toBe(1)
  })

  test('[T38] rollback do batch atômico no PostgreSQL não deixa item, journal nem evento', async () => {
    const a = await session(fixtures[0]!)
    const projectId = await createProject(a.cookie, 'Projeto rollback atômico')
    const modules = await (await app.request(`/api/projects/${projectId}/modules`, { headers: { Cookie: a.cookie } })).json() as Array<{ id: string }>
    const epic = await createItem(a.cookie, projectId, { title: 'Epic rb', type: 'EPIC', moduleId: modules[0]!.id })
    const story = await createItem(a.cookie, projectId, { title: 'Story rb', type: 'STORY', parentId: epic.id })

    const pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    const counts = async () => {
      const items = await pg.query('SELECT count(*)::int AS cnt FROM items WHERE tenant_id = $1 AND project_id = $2', [a.tenant.tenantId, projectId])
      const outbox = await pg.query('SELECT count(*)::int AS cnt FROM domain_event_outbox WHERE tenant_id = $1 AND project_id = $2', [a.tenant.tenantId, projectId])
      const journal = await pg.query("SELECT count(*)::int AS cnt FROM idempotency_records WHERE tenant_id = $1 AND idempotency_key = 'pg-atomic-rb'", [a.tenant.tenantId])
      return { items: (items.rows[0] as { cnt: number }).cnt, outbox: (outbox.rows[0] as { cnt: number }).cnt, journal: (journal.rows[0] as { cnt: number }).cnt }
    }
    const before = await counts()
    const failing = await app.request(`/api/projects/${projectId}/batch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a.cookie },
      body: JSON.stringify({ idempotencyKey: 'pg-atomic-rb', atomic: true, operations: [{ tool: 'create_task', args: { title: 'Ok', parentId: story.id } }, { tool: 'create_task', args: { title: '' } }] }),
    })
    expect(failing.status).toBe(422)
    expect(await counts()).toEqual(before)
    await pg.end()
  })

  test('[T38] operação é isolada por tenant', async () => {
    const a = await session(fixtures[0]!)
    const projectId = await createProject(a.cookie, 'Projeto op tenant')
    const modules = await (await app.request(`/api/projects/${projectId}/modules`, { headers: { Cookie: a.cookie } })).json() as Array<{ id: string }>
    const epic = await createItem(a.cookie, projectId, { title: 'Epic op', type: 'EPIC', moduleId: modules[0]!.id })
    const story = await createItem(a.cookie, projectId, { title: 'Story op', type: 'STORY', parentId: epic.id })
    const created = await app.request(`/api/projects/${projectId}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'op-tenant-1', Cookie: a.cookie },
      body: JSON.stringify({ title: 'Op tenant', type: 'TASK', parentId: story.id }),
    })
    const operationId = created.headers.get('x-operation-id')!
    const bCookie = await login(fixtures[1]!.adminEmail, fixtures[1]!.adminPassword)
    const cross = await app.request(`/api/operations/${operationId}`, { headers: { Cookie: bCookie } })
    expect(cross.status).toBe(404)
  })

  test('isolamento REST entre tenants e API key sem acesso', async () => {
    const a = await session(fixtures[0]!)
    const b = fixtures[1]!
    const projectA = await createProject(a.cookie, 'Projeto Isolado')

    // Cookie de B no projeto de A → 404 sem revelar existência.
    const crossCookie = await app.request(`/api/projects/${projectA}/items`, {
      headers: { Cookie: await login(b.adminEmail, b.adminPassword) },
    })
    expect(crossCookie.status).toBe(404)

    // API key de B no projeto de A → 404; API key de A no próprio projeto → 200.
    const crossKey = await app.request(`/api/projects/${projectA}/items`, {
      headers: { Authorization: `Bearer ${b.apiKey}` },
    })
    expect([401, 404]).toContain(crossKey.status)

    const ownKey = await app.request(`/api/projects/${projectA}/items`, {
      headers: { Authorization: `Bearer ${a.tenant.apiKey}` },
    })
    expect(ownKey.status).toBe(200)

    // Listagem de B não contém o projeto de A.
    const projectsB = await (await app.request('/api/projects', { headers: { Cookie: await login(b.adminEmail, b.adminPassword) } })).json() as Array<{ id: string }>
    expect(projectsB.map(p => p.id)).not.toContain(projectA)
  })

  test('autorização de assinatura WebSocket respeita tenant e membership', async () => {
    const a = await session(fixtures[0]!)
    const b = fixtures[1]!
    const projectA = await createProject(a.cookie, 'Projeto WS')
    const { authorizeProjectSubscription } = await import('./services/wsAuthorization')

    const allowed = await authorizeProjectSubscription(
      { tenantId: a.tenant.tenantId, userId: a.tenant.adminUserId, globalGroup: 'ADMIN' }, projectA,
    )
    expect(allowed.ok).toBe(true)

    const crossTenant = await authorizeProjectSubscription(
      { tenantId: b.tenantId, userId: b.adminUserId, globalGroup: 'ADMIN' }, projectA,
    )
    expect(crossTenant).toEqual({ ok: false, status: 404, message: 'Projeto não encontrado' })

    const unknownProject = await authorizeProjectSubscription(
      { tenantId: a.tenant.tenantId, userId: a.tenant.adminUserId, globalGroup: 'ADMIN' }, 'projeto-inexistente',
    )
    expect(unknownProject.ok).toBe(false)
  })

  test('VIEWER não muta itens; admin autorizado continua', async () => {
    const a = await session(fixtures[0]!)
    const projectId = await createProject(a.cookie, 'Projeto RBAC')
    const runtime = await import('./persistence/runtime')
    const { hashPassword } = await import('./services/auth')
    const viewer = await runtime.persistence.identity.createUser(
      { tenantId: a.tenant.tenantId, actorUserId: null, actorKind: 'SYSTEM' },
      { email: 'viewer-advanced@advanced.test', passwordHash: await hashPassword('SenhaForte123!'), name: 'Viewer', globalGroup: 'TEAM_MEMBER' },
    )
    await runtime.persistence.projects.addProjectMember(
      { tenantId: a.tenant.tenantId, actorUserId: viewer.id, actorKind: 'USER' },
      projectId,
      { userId: viewer.id, role: 'VIEWER' },
    )
    const viewerCookie = await login('viewer-advanced@advanced.test', 'SenhaForte123!')

    const forbidden = await app.request(`/api/projects/${projectId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: viewerCookie },
      body: JSON.stringify({ title: 'Não deveria criar', type: 'EPIC' }),
    })
    expect(forbidden.status).toBe(403)

    const adminRead = await app.request(`/api/projects/${projectId}/items`, { headers: { Cookie: a.cookie } })
    expect(adminRead.status).toBe(200)
  })
})
