const webUrl = (Bun.env.SMOKE_URL ?? 'http://localhost:5173').replace(/\/+$/, '')
const apiUrl = (Bun.env.SMOKE_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '')
const adminEmail = Bun.env.SMOKE_ADMIN_EMAIL
const adminPassword = Bun.env.SMOKE_ADMIN_PASSWORD
const secondaryEmail = Bun.env.SMOKE_SECONDARY_ADMIN_EMAIL
const secondaryPassword = Bun.env.SMOKE_SECONDARY_ADMIN_PASSWORD
const viewerEmail = Bun.env.SMOKE_VIEWER_EMAIL ?? `viewer-${crypto.randomUUID()}@smoke.invalid`
const viewerPassword = Bun.env.SMOKE_VIEWER_PASSWORD ?? 'ViewerSmoke123!'
const timeoutMs = 10_000
const agentTimeoutMs = Number(Bun.env.SMOKE_AGENT_TIMEOUT_MS ?? 45_000)

if (!adminEmail || !adminPassword || !secondaryEmail || !secondaryPassword) {
  throw new Error('SMOKE_ADMIN_EMAIL/PASSWORD e SMOKE_SECONDARY_ADMIN_EMAIL/PASSWORD são obrigatórios.')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Smoke falhou: ${message}`)
}

async function call(base: string, path: string, options: { method?: string; cookie?: string; body?: unknown } = {}) {
  const headers = new Headers()
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (options.cookie) headers.set('Cookie', options.cookie)
  return fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(timeoutMs),
  })
}

async function expectStatus(base: string, path: string, expected: number, options: { method?: string; cookie?: string; body?: unknown } = {}) {
  const response = await call(base, path, options)
  if (response.status !== expected) {
    const detail = (await response.text()).slice(0, 1_000)
    throw new Error(`${path}: esperado HTTP ${expected}, recebido HTTP ${response.status}; resposta=${detail}`)
  }
  return response
}

async function login(email: string, password: string): Promise<string> {
  const response = await expectStatus(webUrl, '/api/auth/login', 200, { method: 'POST', body: { email, password } })
  const cookie = response.headers.get('set-cookie')?.match(/(?:^|,\s*)session=([^;]+)/)?.[1]
  assert(cookie, 'login não retornou cookie de sessão')
  return `session=${cookie}`
}

async function json<T>(response: Response): Promise<T> {
  return await response.json() as T
}

function equal(actual: unknown, expected: unknown, message: string) {
  assert(actual === expected, `${message}; esperado=${String(expected)}, recebido=${String(actual)}`)
}

async function createProject(cookie: string, name: string): Promise<string> {
  const response = await expectStatus(webUrl, '/api/projects', 201, {
    method: 'POST', cookie, body: { name, boardMode: 'SIMPLE' },
  })
  return (await json<{ id: string }>(response)).id
}

async function smokeAgent(cookie: string, projectId: string) {
  const created = await expectStatus(webUrl, '/api/assistant/conversations', 201, {
    method: 'POST', cookie, body: { projectId, title: 'Smoke determinístico' },
  })
  const conversationId = (await json<{ id: string }>(created)).id
  const queued = await expectStatus(webUrl, `/api/assistant/conversations/${conversationId}/messages`, 202, {
    method: 'POST', cookie, body: { content: 'Responda com a mensagem de teste.' },
  })
  const runId = (await json<{ runId: string }>(queued)).runId
  const deadline = Date.now() + agentTimeoutMs
  let runStatus = ''
  while (Date.now() < deadline) {
    const runResponse = await expectStatus(webUrl, `/api/assistant/runs/${runId}`, 200, { cookie })
    const run = await json<{ status: string; errorCode?: string | null }>(runResponse)
    runStatus = run.status
    if (runStatus === 'COMPLETED') break
    if (['FAILED', 'CANCELLED', 'REJECTED'].includes(runStatus)) {
      throw new Error(`Smoke do agente terminou em ${runStatus} (${run.errorCode ?? 'sem código'})`)
    }
    await Bun.sleep(250)
  }
  equal(runStatus, 'COMPLETED', `run do agente não concluiu em ${agentTimeoutMs} ms`)

  const conversationResponse = await expectStatus(webUrl, `/api/assistant/conversations/${conversationId}`, 200, { cookie })
  const conversation = await json<{ messages: Array<{ role: string; content: string }> }>(conversationResponse)
  assert(conversation.messages.some(message => message.role === 'ASSISTANT' && message.content === 'Resposta determinística do agente de teste.'), 'resposta determinística do agente não foi persistida')
}

await expectStatus(webUrl, '/', 200)
await expectStatus(apiUrl, '/health/live', 200)
await expectStatus(apiUrl, '/health/ready', 200)
await expectStatus(webUrl, '/api/auth/me', 401)
console.log(`OK raiz, readiness e 401 sem sessão (${webUrl})`)

const adminCookie = await login(adminEmail, adminPassword)
await expectStatus(webUrl, '/api/auth/me', 200, { cookie: adminCookie })
console.log('OK login/cookie e /api/auth/me autenticado')

const projectId = await createProject(adminCookie, `Smoke principal ${crypto.randomUUID()}`)
const viewerCreated = await expectStatus(webUrl, '/api/users', 201, {
  method: 'POST', cookie: adminCookie,
  body: { email: viewerEmail, name: 'Viewer Smoke', password: viewerPassword, globalGroup: 'TEAM_MEMBER' },
})
assert((await json<{ email: string }>(viewerCreated)).email === viewerEmail, 'usuário viewer não foi criado')
await expectStatus(webUrl, `/api/projects/${projectId}/members`, 201, {
  method: 'POST', cookie: adminCookie, body: { email: viewerEmail, role: 'VIEWER' },
})
const viewerCookie = await login(viewerEmail, viewerPassword)
await expectStatus(webUrl, `/api/projects/${projectId}`, 200, { cookie: viewerCookie })

const columnsResponse = await expectStatus(webUrl, `/api/projects/${projectId}/columns`, 200, { cookie: adminCookie })
const columns = await json<Array<{ id: string; baseStatus: string }>>(columnsResponse)
const doingColumn = columns.find(column => column.baseStatus === 'IN_PROGRESS')
assert(doingColumn, 'projeto não possui coluna IN_PROGRESS')

const createdItem = await expectStatus(webUrl, `/api/projects/${projectId}/items`, 201, {
  method: 'POST', cookie: adminCookie, body: { title: 'Smoke item original', type: 'TASK' },
})
const item = await json<{ id: string; title: string; updatedAt: string; columnId: string | null }>(createdItem)
const readItem = await expectStatus(webUrl, `/api/projects/${projectId}/items/${item.id}`, 200, { cookie: adminCookie })
const beforeUpdate = await json<{ updatedAt: string }>(readItem)
await expectStatus(webUrl, `/api/projects/${projectId}/items/${item.id}`, 200, {
  method: 'PATCH', cookie: adminCookie, body: { title: 'Smoke item editado', expectedUpdatedAt: beforeUpdate.updatedAt },
})
await expectStatus(webUrl, `/api/projects/${projectId}/items/${item.id}/move`, 200, {
  method: 'PATCH', cookie: adminCookie, body: { columnId: doingColumn.id },
})
const persistedResponse = await expectStatus(webUrl, `/api/projects/${projectId}/items/${item.id}`, 200, { cookie: adminCookie })
const persisted = await json<{ title: string; columnId: string | null }>(persistedResponse)
equal(persisted.title, 'Smoke item editado', 'edição não persistiu')
equal(persisted.columnId, doingColumn.id, 'movimento não persistiu')
const viewerMutation = await call(webUrl, `/api/projects/${projectId}/items/${item.id}`, {
  method: 'PATCH', cookie: viewerCookie, body: { title: 'mutação proibida' },
})
equal(viewerMutation.status, 403, 'VIEWER conseguiu editar item')
console.log('OK criação/edição/movimento/readback e VIEWER sem permissão de mutação')

const secondaryCookie = await login(secondaryEmail, secondaryPassword)
const otherProjectId = await createProject(secondaryCookie, `Smoke tenant isolado ${crypto.randomUUID()}`)
const crossTenant = await call(webUrl, `/api/projects/${otherProjectId}`, { cookie: adminCookie })
equal(crossTenant.status, 404, 'primeiro tenant leu projeto de outro tenant')
const reverseCrossTenant = await call(webUrl, `/api/projects/${projectId}`, { cookie: secondaryCookie })
equal(reverseCrossTenant.status, 404, 'segundo tenant leu projeto de outro tenant')
console.log('OK isolamento entre tenants nos dois sentidos')

await smokeAgent(adminCookie, projectId)
console.log('OK jornada do Azy Agent com provider determinístico e worker do perfil')
console.log(`Smoke de negócio concluído: perfil=${Bun.env.AZYBOARD_INSTALL_PROFILE ?? 'desconhecido'} web=${webUrl} api=${apiUrl}`)
