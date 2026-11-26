import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from 'pg'
import { shouldRunPostgresTests } from './db/postgres/pgTestSupport'

// [ADVANCED-MCP-OAUTH] OAuth do MCP contra PostgreSQL real: registro dinâmico,
// consentimento, troca do code, MCP de projeto com claim (badge do app),
// rotação do refresh, conexões em Minha conta e revogação. Roda apenas com
// PostgreSQL disponível (job `advanced`); ausente, é pulado.
const PG_URL = process.env.TEST_PG_URL ?? 'postgresql://postgres:postgres@localhost:5432/azyboard_advanced_mcp_oauth'
const runPostgres = await shouldRunPostgresTests(PG_URL)
const instanceDir = mkdtempSync(join(tmpdir(), 'azyboard-advanced-mcp-oauth-'))
const BASE = 'http://test.local'
const REDIRECT = 'http://127.0.0.1:43123/callback'

describe.skipIf(!runPostgres)('ADVANCED OAuth do MCP (PostgreSQL real)', () => {
  let app: { request: (path: string, init?: RequestInit) => Promise<Response> }
  let closeRuntime: () => Promise<void>
  let cookie: string
  let projectId: string

  beforeAll(async () => {
    process.env.AZYBOARD_INSTALL_PROFILE = 'ADVANCED'
    process.env.DATABASE_URL = PG_URL
    process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379'
    process.env.AZYBOARD_INSTANCE_DIR = instanceDir
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = 'advanced-mcp-oauth-test-secret'
    process.env.AZYBOARD_PUBLIC_URL = BASE

    const setup = new Client({ connectionString: PG_URL })
    await setup.connect()
    await setup.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
    await setup.end()
    const migrationsDir = join(import.meta.dir, 'db', 'postgres', 'migrations')
    const client = new Client({ connectionString: PG_URL })
    await client.connect()
    for (const file of readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()) {
      await client.query(readFileSync(join(migrationsDir, file), 'utf8'))
    }
    await client.end()

    const runtime = await import('./persistence/runtime')
    closeRuntime = runtime.closeRuntime
    const { ensureInstallationMarkers } = await import('./db/installationMarkers')
    await ensureInstallationMarkers(runtime.installProfile, runtime.createMarkerStore())
    const { hashPassword } = await import('./services/auth')
    const { seedAdvancedFixtures } = await import('./scripts/advancedFixtures')
    const [fixture] = await seedAdvancedFixtures(runtime.persistence, { hashPassword, password: 'SenhaForte123!', tenantPrefix: 'mcp-oauth' })
    app = (await import('./index')).app as typeof app

    const login = await app.request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fixture!.adminEmail, password: fixture!.adminPassword }),
    })
    expect(login.status).toBe(200)
    cookie = `session=${(login.headers.get('set-cookie') ?? '').match(/session=([^;]+)/)![1]}`
    const project = await app.request('/api/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ name: 'Projeto OAuth PG', boardMode: 'SIMPLE' }),
    })
    expect(project.status).toBe(201)
    projectId = (await project.json() as { id: string }).id
  })

  afterAll(async () => {
    await closeRuntime?.()
  })

  function form(path: string, body: Record<string, string>) {
    return app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) })
  }

  function mcp(path: string, token: string, body: unknown) {
    return app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  }

  test('jornada OAuth completa no PostgreSQL', async () => {
    const registered = await app.request('/api/oauth/mcp/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Agente PG', redirect_uris: [REDIRECT] }),
    })
    expect(registered.status).toBe(201)
    const clientId = (await registered.json() as { client_id: string }).client_id

    const verifier = createHash('sha256').update('verificador-pg').digest('base64url') + 'abcdefghijk'
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const resource = `${BASE}/mcp/projects/${projectId}`
    const approved = await app.request('/api/oauth/mcp/authorize/approve', {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256', resource }),
    })
    expect(approved.status).toBe(200)
    const code = new URL((await approved.json() as { redirectUrl: string }).redirectUrl).searchParams.get('code')!

    const tokenResponse = await form('/api/oauth/mcp/token', { grant_type: 'authorization_code', code, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT, resource })
    expect(tokenResponse.status).toBe(200)
    const tokens = await tokenResponse.json() as { access_token: string; refresh_token: string }
    expect((await form('/api/oauth/mcp/token', { grant_type: 'authorization_code', code, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT })).status).toBe(400)

    const path = `/mcp/projects/${projectId}`
    const created = await mcp(path, tokens.access_token, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_task', arguments: { title: 'Card OAuth PG' } } })
    expect(created.status).toBe(200)
    const createdBody = await created.json() as { result?: { isError?: boolean; structuredContent?: { item?: { id: string }; id?: string } } }
    expect(createdBody.result?.isError).not.toBe(true)
    const itemId = createdBody.result?.structuredContent?.item?.id ?? createdBody.result?.structuredContent?.id
    expect(itemId).toBeTruthy()
    const claimed = await mcp(path, tokens.access_token, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'claim_task', arguments: { taskId: itemId } } })
    expect((await claimed.json() as { result?: { isError?: boolean } }).result?.isError).not.toBe(true)
    const board = await app.request(`/api/projects/${projectId}/items`, { headers: { cookie } })
    expect(JSON.stringify(await board.json())).toContain('"aiModelName":"Agente PG"')

    const renewed = await form('/api/oauth/mcp/token', { grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId })
    expect(renewed.status).toBe(200)
    const next = await renewed.json() as { access_token: string }

    const grants = await app.request('/api/oauth/mcp/grants', { headers: { cookie } })
    const listed = (await grants.json() as { grants: Array<{ id: string; projectName: string | null }> }).grants
    expect(listed).toHaveLength(1)
    expect(listed[0]?.projectName).toBe('Projeto OAuth PG')
    expect((await app.request(`/api/oauth/mcp/grants/${listed[0]!.id}`, { method: 'DELETE', headers: { cookie } })).status).toBe(200)
    expect((await mcp(path, next.access_token, { jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} })).status).toBe(401)
  })
})
