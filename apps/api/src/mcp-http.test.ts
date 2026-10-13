import { beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

process.env.DATABASE_URL = ':memory:'
process.env.JWT_SECRET = 'mcp-http-test-secret'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { tenants, users, items } = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')
const { executeSharedTool } = await import('./services/assistantTools')
const { authorizeAssistantTool } = await import('./routes/assistant')
const { createWorkerToolApi } = await import('./services/workerContext')

await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })

interface JsonRpcResult { result?: Record<string, unknown>; error?: { code: number; message: string } }

async function request(path: string, session: string, init: RequestInit = {}) {
  return app.fetch(new Request(`http://test.local/api${path}`, {
    ...init,
    headers: { cookie: `session=${session}`, ...init.headers },
  }))
}

function mcpKeyRequest(apiKey: string, body: unknown, headers: Record<string, string> = {}) {
  return app.fetch(new Request('http://test.local/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${apiKey}`,
      ...headers,
    },
    body: JSON.stringify(body),
  }))
}

async function rpc(apiKey: string, body: unknown, headers: Record<string, string> = {}): Promise<JsonRpcResult> {
  const response = await mcpKeyRequest(apiKey, body, headers)
  expect(response.status).toBe(200)
  return response.json() as Promise<JsonRpcResult>
}

function toolResult(result: JsonRpcResult): { structuredContent?: Record<string, unknown>; isError?: boolean } {
  return (result.result ?? {}) as { structuredContent?: Record<string, unknown>; isError?: boolean }
}

describe('MCP remoto por Streamable HTTP', () => {
  let tenantId: string
  let ownerId: string
  let session: string
  let readKey: string
  let writeKey: string
  let projectId: string

  beforeAll(async () => {
    tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Tenant MCP', slug: `mcp-${tenantId}`, createdAt: new Date().toISOString() })
    ownerId = generateId()
    await db.insert(users).values({
      id: ownerId, tenantId, email: 'mcp@test.local', passwordHash: 'test-hash', name: 'Owner MCP',
      theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', globalGroup: 'ADMIN', createdAt: new Date().toISOString(),
    })
    session = await signJwt({ sub: ownerId, tenantId, email: 'mcp@test.local', role: 'user' })

    const projectResponse = await request('/projects', session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Projeto MCP remoto', boardMode: 'SIMPLE' }),
    })
    expect(projectResponse.status).toBe(201)
    projectId = (await projectResponse.json() as { id: string }).id

    async function createKey(name: string, scope: string[]): Promise<string> {
      const created = await request('/api-keys', session, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, projectScope: [projectId], permissionScope: scope }),
      })
      expect(created.status).toBe(201)
      return (await created.json() as { key: string }).key
    }
    readKey = await createKey('MCP leitura', ['read'])
    writeKey = await createKey('MCP escrita', ['read', 'write'])
  })

  test('completa o handshake e lista o mesmo catálogo do transporte local', async () => {
    const init = await rpc(readKey, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } })
    expect(init.error).toBeUndefined()
    expect(init.result).toMatchObject({ serverInfo: { name: 'azy-board' } })

    const listed = await rpc(readKey, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
    const tools = (listed.result?.tools ?? []) as Array<{ name: string; inputSchema: { type: string } }>
    expect(tools.length).toBeGreaterThan(40)
    expect(tools.some(tool => tool.name === 'list_tasks')).toBe(true)
    expect(tools.some(tool => tool.name === 'list_modules')).toBe(true)
    expect(tools.every(tool => tool.inputSchema.type === 'object')).toBe(true)
  })

  test('executa tools/call com a identidade da chave', async () => {
    const result = await rpc(readKey, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_projects', arguments: {} } })
    const structured = toolResult(result).structuredContent as { data?: Array<{ id: string }> } | undefined
    expect(toolResult(result).isError ?? false).toBe(false)
    expect((structured?.data ?? []).some(project => project.id === projectId)).toBe(true)
  })

  test('repetição idempotente da mutação não duplica o efeito', async () => {
    const call = { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'create_task', arguments: { projectId, title: 'Tarefa idempotente', type: 'TASK' } } }
    const first = await rpc(writeKey, call, { 'Idempotency-Key': 'mcp-retry-1' })
    const firstData = toolResult(first).structuredContent as { id?: string } | undefined
    expect(firstData?.id).toBeTruthy()

    const retry = await rpc(writeKey, call, { 'Idempotency-Key': 'mcp-retry-1' })
    const retryData = toolResult(retry).structuredContent as { id?: string } | undefined
    expect(retryData?.id).toBe(firstData?.id)

    const created = await db.select().from(items).where(eq(items.projectId, projectId))
    expect(created.filter(item => item.title === 'Tarefa idempotente')).toHaveLength(1)
  })

  test('projectId explícito e contexto de sessão opcional', async () => {
    const explicit = await rpc(readKey, { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'list_modules', arguments: { projectId } } })
    expect(toolResult(explicit).isError ?? false).toBe(false)

    // Contexto de sessão (cabeçalho) torna projectId opcional para a chamada.
    const contextual = await rpc(readKey, { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'list_modules', arguments: {} } }, { 'X-Azyboard-Project-Id': projectId })
    expect(toolResult(contextual).isError ?? false).toBe(false)

    // Ausente e sem contexto: falha acionável, sem executar.
    const missing = await rpc(readKey, { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'list_modules', arguments: {} } })
    const error = toolResult(missing).structuredContent as { error?: { code?: string; message?: string } } | undefined
    expect(toolResult(missing).isError).toBe(true)
    expect(error?.error?.message).toContain('projectId')
  })

  test('recusa identidade forjada nos argumentos sem mutação', async () => {
    const before = await db.select().from(items).where(eq(items.projectId, projectId))
    const result = await rpc(writeKey, { jsonrpc: '2.0', id: 8, method: 'tools/call', params: {
      name: 'create_task',
      arguments: { projectId, title: 'Escalada', type: 'TASK', globalGroup: 'ROOT', tenantId: 'outro-tenant' },
    } })
    const payload = toolResult(result).structuredContent as { error?: { code?: string; details?: { fields?: string[] } } } | undefined
    expect(toolResult(result).isError).toBe(true)
    expect(payload?.error?.code).toBe('MCP_IDENTITY_ARGUMENT_FORBIDDEN')
    expect(payload?.error?.details?.fields ?? []).toEqual(expect.arrayContaining(['globalGroup', 'tenantId']))

    const after = await db.select().from(items).where(eq(items.projectId, projectId))
    expect(after).toHaveLength(before.length)
  })

  test('401 sem credencial e 403 fora do escopo, sem vazar a chave', async () => {
    const unauth = await app.fetch(new Request('http://test.local/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list', params: {} }),
    }))
    expect(unauth.status).toBe(401)
    const unauthBody = await unauth.text()
    expect(unauthBody).not.toContain('azb_')

    const otherProject = generateId()
    const denied = await rpc(writeKey, { jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'list_tasks', arguments: { projectId: otherProject } } })
    const deniedPayload = toolResult(denied).structuredContent as { error?: { code?: string; message?: string; retryable?: boolean; details?: unknown } } | undefined
    expect(toolResult(denied).isError).toBe(true)
    expect(deniedPayload?.error?.code).toBeDefined()
    expect(JSON.stringify(denied)).not.toContain('azb_')
  })

  test('endpoint desabilitado não responde chamadas MCP', async () => {
    process.env.AZYBOARD_MCP_HTTP_ENABLED = 'false'
    try {
      const response = await mcpKeyRequest(readKey, { jsonrpc: '2.0', id: 11, method: 'tools/list', params: {} })
      expect(response.status).toBe(404)
      const body = await response.json() as { error?: { code?: string } }
      expect(body.error?.code).toBe('MCP_DISABLED')
    } finally {
      delete process.env.AZYBOARD_MCP_HTTP_ENABLED
    }
  })

  test('paridade REST/MCP HTTP/agente para criação de tarefa', async () => {
    const rest = await request(`/projects/${projectId}/items`, session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Paridade REST', type: 'TASK' }),
    })
    expect(rest.status).toBe(201)
    const restItem = await rest.json() as { id: string; type: string; status: string; columnId: string | null }

    const mcp = await rpc(writeKey, { jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name: 'create_task', arguments: { projectId, title: 'Paridade MCP', type: 'TASK' } } })
    const mcpItem = toolResult(mcp).structuredContent as { id?: string } | undefined
    expect(mcpItem?.id).toBeTruthy()

    const agentApi = await createWorkerToolApi(tenantId, ownerId)
    const agentItem = await executeSharedTool('create_task', { projectId, title: 'Paridade agente', type: 'TASK' }, {
      api: agentApi,
      context: { source: 'azy-agent', userId: ownerId, tenantId, globalGroup: 'ADMIN', projectId },
      authorize: authorizeAssistantTool,
    }) as { id: string }

    const read = async (id: string) => (await (await request(`/projects/${projectId}/items/${id}`, session)).json()) as { type: string; status: string; columnId: string | null; title: string }
    for (const [id, title] of [[restItem.id, 'Paridade REST'], [mcpItem!.id!, 'Paridade MCP'], [agentItem.id, 'Paridade agente']] as const) {
      const item = await read(id)
      expect(item.title).toBe(title)
      expect(item.type).toBe('TASK')
      expect(item.status).toBe(restItem.status)
      expect(item.columnId).toBe(restItem.columnId)
      expect(item.columnId).toBeTruthy()
    }
  })
})
