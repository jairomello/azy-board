import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

import { beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { UnauthorizedError, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import type { OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'

process.env.DATABASE_URL = ':memory:'
process.env.JWT_SECRET = 'mcp-oauth-test-secret'
process.env.AZYBOARD_PUBLIC_URL = 'http://test.local'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users, oauthTokens, items } = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')
const { resetRegisterLimit } = await import('./routes/mcpOAuth')

await migrate(db, { migrationsFolder: fileURLToPath(new URL('./db/migrations', import.meta.url)) })

const BASE = 'http://test.local'
const REDIRECT = 'http://localhost:33418/callback'

function appFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  return Promise.resolve(app.fetch(input instanceof Request ? input : new Request(input, init)))
}

function api(path: string, session: string, init: RequestInit = {}) {
  return app.fetch(new Request(`${BASE}/api${path}`, { ...init, headers: { cookie: `session=${session}`, ...init.headers } }))
}

function json(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }
}

function pkcePair() {
  const verifier = createHash('sha256').update(generateId()).digest('base64url') + 'abcdefghijk'
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

function mcp(path: string, token: string | null, body: unknown) {
  return app.fetch(new Request(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  }))
}

async function rpc(path: string, token: string, method: string, params: Record<string, unknown> = {}) {
  const response = await mcp(path, token, { jsonrpc: '2.0', id: 1, method, params })
  expect(response.status).toBe(200)
  return await response.json() as { result?: Record<string, unknown> }
}

/** Provider em memória que captura a URL de autorização em vez de abrir navegador. */
class MemoryProvider implements OAuthClientProvider {
  info: OAuthClientInformationMixed | undefined
  saved: OAuthTokens | undefined
  verifier = ''
  authorizationUrl: URL | null = null
  get redirectUrl() { return REDIRECT }
  get clientMetadata() {
    return { client_name: 'Claude Code <teste>', redirect_uris: [REDIRECT], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }
  }
  clientInformation() { return this.info }
  saveClientInformation(info: OAuthClientInformationMixed) { this.info = info }
  tokens() { return this.saved }
  saveTokens(tokens: OAuthTokens) { this.saved = tokens }
  redirectToAuthorization(url: URL) { this.authorizationUrl = url }
  saveCodeVerifier(verifier: string) { this.verifier = verifier }
  codeVerifier() { return this.verifier }
}

describe('OAuth do MCP remoto', () => {
  let tenantId: string
  let userId: string
  let session: string
  let projectId: string
  let otherProjectId: string
  let outsiderSession: string

  async function register(name = 'App de teste'): Promise<string> {
    resetRegisterLimit()
    const response = await app.fetch(new Request(`${BASE}/api/oauth/mcp/register`, json({ client_name: name, redirect_uris: [REDIRECT] })))
    expect(response.status).toBe(201)
    return (await response.json() as { client_id: string }).client_id
  }

  /** Autoriza pelo consentimento (sessão humana) e troca o code por tokens. */
  async function authorize(resource = `${BASE}/mcp`, scope?: string, as = session) {
    const clientId = await register()
    const { verifier, challenge } = pkcePair()
    const params = { response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256', state: 'xyz', resource, ...(scope ? { scope } : {}) }
    const approved = await api('/oauth/mcp/authorize/approve', as, json(params))
    expect(approved.status).toBe(200)
    const redirectUrl = new URL((await approved.json() as { redirectUrl: string }).redirectUrl)
    expect(redirectUrl.searchParams.get('state')).toBe('xyz')
    const code = redirectUrl.searchParams.get('code')!
    const token = await app.fetch(new Request(`${BASE}/api/oauth/mcp/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT, resource }),
    }))
    expect(token.status).toBe(200)
    return { clientId, code, verifier, ...(await token.json() as { access_token: string; refresh_token: string; scope: string; expires_in: number }) }
  }

  function refresh(clientId: string, refreshToken: string) {
    return app.fetch(new Request(`${BASE}/api/oauth/mcp/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId }),
    }))
  }

  beforeAll(async () => {
    tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant OAuth', slug: `oauth-${tenantId}`, createdAt: new Date().toISOString() })
    userId = generateId()
    const outsiderId = generateId()
    const now = new Date().toISOString()
    await db.insert(users).values([
      { id: userId, tenantId, email: 'oauth@test.local', passwordHash: 'x', name: 'Pessoa OAuth', theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: now },
      { id: outsiderId, tenantId, email: 'fora@test.local', passwordHash: 'x', name: 'Fora', theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'TEAM_MEMBER', createdAt: now },
    ])
    session = await signJwt({ sub: userId, tenantId, email: 'oauth@test.local', role: 'user' })
    outsiderSession = await signJwt({ sub: outsiderId, tenantId, email: 'fora@test.local', role: 'user' })
    for (const name of ['Projeto OAuth A', 'Projeto OAuth B']) {
      const created = await api('/projects', session, json({ name, boardMode: 'SIMPLE' }))
      expect(created.status).toBe(201)
      const id = (await created.json() as { id: string }).id
      if (!projectId) projectId = id
      else otherProjectId = id
    }
  })

  test('publica a descoberta (RFC 9728 e RFC 8414) com CORS aberto', async () => {
    const prm = await app.fetch(new Request(`${BASE}/.well-known/oauth-protected-resource/mcp`, { headers: { Origin: 'https://claude.ai' } }))
    expect(prm.status).toBe(200)
    expect(prm.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(await prm.json()).toMatchObject({ resource: `${BASE}/mcp`, authorization_servers: [BASE] })

    const missing = generateId()
    const projectPrm = await app.fetch(new Request(`${BASE}/.well-known/oauth-protected-resource/mcp/projects/${missing}`))
    expect(projectPrm.status).toBe(200)
    expect(await projectPrm.json()).toMatchObject({ resource: `${BASE}/mcp/projects/${missing}` })

    const as = await app.fetch(new Request(`${BASE}/.well-known/oauth-authorization-server`))
    expect(await as.json()).toMatchObject({
      issuer: BASE,
      authorization_endpoint: `${BASE}/oauth/authorize`,
      token_endpoint: `${BASE}/api/oauth/mcp/token`,
      code_challenge_methods_supported: ['S256'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
    })
  })

  test('401 do MCP traz WWW-Authenticate com o metadata da rota', async () => {
    const general = await mcp('/mcp', null, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    expect(general.status).toBe(401)
    expect(general.headers.get('WWW-Authenticate')).toBe(`Bearer resource_metadata="${BASE}/.well-known/oauth-protected-resource/mcp"`)

    const expired = await mcp(`/mcp/projects/${projectId}`, 'azo_invalido', { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    expect(expired.status).toBe(401)
    expect(expired.headers.get('WWW-Authenticate')).toBe(`Bearer error="invalid_token", resource_metadata="${BASE}/.well-known/oauth-protected-resource/mcp/projects/${projectId}"`)
  })

  test('fluxo completo com o Client oficial do SDK: DCR, consentimento, token e tools', async () => {
    resetRegisterLimit()
    const provider = new MemoryProvider()
    const firstTransport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), { authProvider: provider, fetch: appFetch })
    const client = new Client({ name: 'teste', version: '1.0.0' })
    await expect(client.connect(firstTransport)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(provider.authorizationUrl?.pathname).toBe('/oauth/authorize')

    // A tela de consentimento valida e aprova com a sessão humana.
    const query = provider.authorizationUrl!.searchParams
    const validated = await api(`/oauth/mcp/authorize/validate?${query.toString()}`, session)
    expect(validated.status).toBe(200)
    const view = await validated.json() as { client: { name: string; redirectHost: string }; scopes: string[]; account: { email: string } }
    expect(view.client.name).toBe('Claude Code teste')
    expect(view.client.redirectHost).toBe('localhost:33418')
    expect(view.account.email).toBe('oauth@test.local')
    // O SDK pede os escopos anunciados no PRM; o consentimento mostra todos.
    expect(view.scopes).toEqual(['read', 'write', 'admin', 'delete'])

    const approved = await api('/oauth/mcp/authorize/approve', session, json(Object.fromEntries(query.entries())))
    const code = new URL((await approved.json() as { redirectUrl: string }).redirectUrl).searchParams.get('code')!
    await firstTransport.finishAuth(code)
    expect(provider.saved?.access_token.startsWith('azo_')).toBe(true)

    const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), { authProvider: provider, fetch: appFetch })
    const connected = new Client({ name: 'teste', version: '1.0.0' })
    await connected.connect(transport)
    const tools = await connected.listTools()
    expect(tools.tools.some(tool => tool.name === 'create_project')).toBe(true)
    const listed = await connected.callTool({ name: 'list_projects', arguments: {} })
    expect(JSON.stringify(listed)).toContain('Projeto OAuth A')
    await connected.close()
  })

  test('token OAuth nunca autentica a API REST', async () => {
    const { access_token } = await authorize()
    const response = await app.fetch(new Request(`${BASE}/api/projects`, { headers: { Authorization: `Bearer ${access_token}` } }))
    expect(response.status).toBe(401)
  })

  test('PKCE inválido falha e consome o code; code não vale duas vezes', async () => {
    const clientId = await register()
    const { challenge } = pkcePair()
    const approved = await api('/oauth/mcp/authorize/approve', session, json({ response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256' }))
    const code = new URL((await approved.json() as { redirectUrl: string }).redirectUrl).searchParams.get('code')!
    const exchange = (verifier: string) => app.fetch(new Request(`${BASE}/api/oauth/mcp/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT }),
    }))
    const wrong = await exchange(pkcePair().verifier)
    expect(wrong.status).toBe(400)
    expect(await wrong.json()).toMatchObject({ error: 'invalid_grant' })
    const reused = await exchange(pkcePair().verifier)
    expect(await reused.json()).toMatchObject({ error: 'invalid_grant' })
  })

  test('consentimento valida cliente, redirect e recurso', async () => {
    const clientId = await register()
    const { challenge } = pkcePair()
    const base = { response_type: 'code', client_id: clientId, code_challenge: challenge, code_challenge_method: 'S256' }
    const badRedirect = await api(`/oauth/mcp/authorize/validate?${new URLSearchParams({ ...base, redirect_uri: 'https://evil.example/cb' })}`, session)
    expect(badRedirect.status).toBe(400)
    expect((await badRedirect.json() as { error: { code: string } }).error.code).toBe('invalid_redirect_uri')
    const denyBad = await api('/oauth/mcp/authorize/deny', session, json({ ...base, redirect_uri: 'https://evil.example/cb' }))
    expect(denyBad.status).toBe(400)

    const unknownResource = await api(`/oauth/mcp/authorize/validate?${new URLSearchParams({ ...base, redirect_uri: REDIRECT, resource: 'https://outro.example/mcp' })}`, session)
    expect((await unknownResource.json() as { error: { code: string } }).error.code).toBe('invalid_target')

    const noAccess = await api(`/oauth/mcp/authorize/validate?${new URLSearchParams({ ...base, redirect_uri: REDIRECT, resource: `${BASE}/mcp/projects/${projectId}` })}`, outsiderSession)
    const missing = await api(`/oauth/mcp/authorize/validate?${new URLSearchParams({ ...base, redirect_uri: REDIRECT, resource: `${BASE}/mcp/projects/${generateId()}` })}`, outsiderSession)
    expect(await noAccess.json()).toEqual(await missing.json())

    const project = await api(`/oauth/mcp/authorize/validate?${new URLSearchParams({ ...base, redirect_uri: REDIRECT, resource: `${BASE}/mcp/projects/${projectId}` })}`, session)
    expect(await project.json()).toMatchObject({ project: { id: projectId, name: 'Projeto OAuth A' } })

    const denied = await api('/oauth/mcp/authorize/deny', session, json({ ...base, redirect_uri: REDIRECT, state: 's1' }))
    const deniedUrl = new URL((await denied.json() as { redirectUrl: string }).redirectUrl)
    expect(deniedUrl.searchParams.get('error')).toBe('access_denied')
    expect(deniedUrl.searchParams.get('state')).toBe('s1')
  })

  test('credencial de agente não aprova consentimento nem gerencia conexões', async () => {
    const keyResponse = await api('/api-keys', session, json({ name: 'Chave restrita', permissionScope: ['read'] }))
    const key = (await keyResponse.json() as { key: string }).key
    const { access_token } = await authorize()
    for (const credential of [key, access_token]) {
      const approve = await app.fetch(new Request(`${BASE}/api/oauth/mcp/authorize/approve`, json({ client_id: 'x' }, { Authorization: `Bearer ${credential}` })))
      expect(approve.status).toBe(401)
      const grants = await app.fetch(new Request(`${BASE}/api/oauth/mcp/grants`, { headers: { Authorization: `Bearer ${credential}` } }))
      expect(grants.status).toBe(401)
    }
  })

  test('escopo read bloqueia mutação; refresh rotaciona e reuso revoga a conexão', async () => {
    const tokens = await authorize(`${BASE}/mcp`, 'read')
    expect(tokens.scope).toBe('read')
    const denied = await rpc('/mcp', tokens.access_token, 'tools/call', { name: 'create_task', arguments: { projectId, title: 'Não deve criar' } })
    expect((denied.result as { isError?: boolean }).isError).toBe(true)

    const renewed = await refresh(tokens.clientId, tokens.refresh_token)
    expect(renewed.status).toBe(200)
    const next = await renewed.json() as { access_token: string; refresh_token: string }
    expect(next.refresh_token).not.toBe(tokens.refresh_token)

    // Reuso dentro da tolerância: falha sem derrubar a conexão.
    expect((await refresh(tokens.clientId, tokens.refresh_token)).status).toBe(400)
    expect((await mcp('/mcp', next.access_token, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })).status).toBe(200)

    // Reuso fora da tolerância: indica vazamento e revoga a conexão inteira.
    const oldHash = createHash('sha256').update(tokens.refresh_token).digest('hex')
    await db.update(oauthTokens).set({ usedAt: new Date(Date.now() - 60_000).toISOString() }).where(eq(oauthTokens.tokenHash, oldHash))
    expect((await refresh(tokens.clientId, tokens.refresh_token)).status).toBe(400)
    expect((await mcp('/mcp', next.access_token, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })).status).toBe(401)
  })

  test('conexões listadas e revogadas em Minha conta; revogação RFC 7009', async () => {
    const tokens = await authorize(`${BASE}/mcp/projects/${projectId}`)
    const listed = await api('/oauth/mcp/grants', session)
    const { grants } = await listed.json() as { grants: Array<{ id: string; projectName: string | null; resource: string }> }
    const grant = grants.find(row => row.resource.endsWith(projectId))
    expect(grant?.projectName).toBe('Projeto OAuth A')

    expect((await api(`/oauth/mcp/grants/${grant!.id}`, outsiderSession, { method: 'DELETE' })).status).toBe(404)
    expect((await api(`/oauth/mcp/grants/${grant!.id}`, session, { method: 'DELETE' })).status).toBe(200)
    expect((await mcp(`/mcp/projects/${projectId}`, tokens.access_token, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })).status).toBe(401)

    const other = await authorize()
    const revoke = await app.fetch(new Request(`${BASE}/api/oauth/mcp/revoke`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: other.access_token }),
    }))
    expect(revoke.status).toBe(200)
    expect((await mcp('/mcp', other.access_token, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })).status).toBe(401)
    const unknown = await app.fetch(new Request(`${BASE}/api/oauth/mcp/revoke`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: 'desconhecido' }),
    }))
    expect(unknown.status).toBe(200)
  })

  test('MCP por projeto: audiência, projeto fixado e ferramentas globais ocultas', async () => {
    const projectTokens = await authorize(`${BASE}/mcp/projects/${projectId}`)
    // Token de projeto não vale no MCP geral nem em outro projeto.
    expect((await mcp('/mcp', projectTokens.access_token, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })).status).toBe(401)
    expect((await mcp(`/mcp/projects/${otherProjectId}`, projectTokens.access_token, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })).status).toBe(401)

    const path = `/mcp/projects/${projectId}`
    const tools = await rpc(path, projectTokens.access_token, 'tools/list')
    const names = ((tools.result?.tools ?? []) as Array<{ name: string }>).map(tool => tool.name)
    expect(names).not.toContain('create_project')
    expect(names).not.toContain('create_project_structure')
    expect(names).toContain('list_projects')

    const projects = await rpc(path, projectTokens.access_token, 'tools/call', { name: 'list_projects', arguments: {} })
    expect(JSON.stringify(projects)).toContain('Projeto OAuth A')
    expect(JSON.stringify(projects)).not.toContain('Projeto OAuth B')

    const divergent = await rpc(path, projectTokens.access_token, 'tools/call', { name: 'list_tasks', arguments: { projectId: otherProjectId } })
    expect(JSON.stringify(divergent)).toContain('MCP_PROJECT_LOCKED')

    const tasks = await rpc(path, projectTokens.access_token, 'tools/call', { name: 'list_tasks', arguments: {} })
    expect((tasks.result as { isError?: boolean }).isError).not.toBe(true)

    // Token geral vale no MCP de projeto, mas fica travado no projeto do caminho.
    const generalTokens = await authorize()
    const lockedList = await rpc(path, generalTokens.access_token, 'tools/call', { name: 'list_projects', arguments: {} })
    expect(JSON.stringify(lockedList)).not.toContain('Projeto OAuth B')

    // Projeto sem acesso responde como inexistente.
    const outsiderTokens = await authorize(`${BASE}/mcp`, undefined, outsiderSession)
    const noAccess = await mcp(path, outsiderTokens.access_token, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    const missing = await mcp(`/mcp/projects/${generateId()}`, outsiderTokens.access_token, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    expect(noAccess.status).toBe(404)
    expect(missing.status).toBe(404)
    expect(await noAccess.json()).toEqual(await missing.json())
  })

  test('ações por OAuth são de agente e o card mostra o nome do app', async () => {
    const tokens = await authorize(`${BASE}/mcp/projects/${projectId}`)
    const path = `/mcp/projects/${projectId}`
    const created = await rpc(path, tokens.access_token, 'tools/call', { name: 'create_task', arguments: { title: 'Card do agente OAuth' } })
    expect((created.result as { isError?: boolean }).isError).not.toBe(true)
    const [row] = await db.select().from(items).where(eq(items.title, 'Card do agente OAuth'))
    const claimed = await rpc(path, tokens.access_token, 'tools/call', { name: 'claim_task', arguments: { taskId: row!.id } })
    expect((claimed.result as { isError?: boolean }).isError).not.toBe(true)
    const [after] = await db.select().from(items).where(eq(items.id, row!.id))
    expect(after?.assigneeOauthGrantId).toBeTruthy()

    const board = await api(`/projects/${projectId}/items`, session)
    expect(JSON.stringify(await board.json())).toContain('"aiModelName":"App de teste"')
  })

  test('API Key no MCP continua funcionando com aviso de depreciação', async () => {
    const keyResponse = await api('/api-keys', session, json({ name: 'Chave legada', permissionScope: ['read'] }))
    const key = (await keyResponse.json() as { key: string }).key
    const response = await mcp('/mcp', key, { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    expect(response.status).toBe(200)
    expect(response.headers.get('Deprecation')).toBe('true')
    expect(response.headers.get('Link')).toContain('rel="deprecation"')
    const project = await mcp(`/mcp/projects/${projectId}`, key, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_projects', arguments: {} } })
    expect(project.status).toBe(200)
    expect(await project.text()).not.toContain('Projeto OAuth B')
  })

  test('registro dinâmico recusa redirect inseguro e sanitiza o nome', async () => {
    resetRegisterLimit()
    const unsafe = await app.fetch(new Request(`${BASE}/api/oauth/mcp/register`, json({ client_name: 'x', redirect_uris: ['http://evil.example/cb'] })))
    expect(unsafe.status).toBe(400)
    expect(await unsafe.json()).toMatchObject({ error: 'invalid_redirect_uri' })
    const long = await app.fetch(new Request(`${BASE}/api/oauth/mcp/register`, json({ client_name: `<b>${'a'.repeat(300)}</b>`, redirect_uris: [REDIRECT] })))
    const name = (await long.json() as { client_name: string }).client_name
    expect(name.length).toBe(100)
    expect(name).not.toContain('<')
  })
})
