import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from './index.js'
import { executeSharedTool, resolveProjectId } from './registry.js'
import { validateToolArguments } from '@azy-board/tool-registry'
import type { ApiCall } from './tools.js'

const PROJECT_UUID = '0f6d7c1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f'
const mcpContext = { source: 'mcp' as const, userId: 'api-key-owner', tenantId: 'api-key-tenant', globalGroup: 'TEAM_MEMBER' as const }

type Recorded = { path: string; method: string; body?: unknown }

function recordingApi(response: unknown = []) {
  const calls: Recorded[] = []
  const api: ApiCall = async (path, method = 'GET', body) => {
    calls.push({ path, method, body })
    return typeof response === 'function' ? (response as (path: string) => unknown)(path) : response
  }
  return { api, calls }
}

async function connectedClient(defaultProjectId?: string) {
  const projects = [{ id: PROJECT_UUID, name: 'Azyboard' }]
  const { api, calls } = recordingApi((path: string) => path === '/projects' ? projects : [])
  const server = createMcpServer(api, { defaultProjectId })
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return { client, calls }
}

describe('resolveProjectId', () => {
  test('UUID passa direto sem chamar a API', async () => {
    const { api, calls } = recordingApi([])
    await expect(resolveProjectId(api, PROJECT_UUID)).resolves.toBe(PROJECT_UUID)
    expect(calls).toHaveLength(0)
  })

  test('resolve nome exato ignorando maiúsculas e acentos', async () => {
    const { api, calls } = recordingApi([{ id: PROJECT_UUID, name: 'Azyboard' }])
    await expect(resolveProjectId(api, 'azyboard')).resolves.toBe(PROJECT_UUID)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.path).toBe('/projects')
  })

  test('rejeita nome ambíguo e nome inexistente sem executar operação', async () => {
    const ambiguous = recordingApi([
      { id: PROJECT_UUID, name: 'Duplicado' },
      { id: '1f6d7c1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f', name: 'Duplicado' },
    ])
    await expect(resolveProjectId(ambiguous.api, 'Duplicado')).rejects.toThrow('AMBIGUOUS_PROJECT_NAME')
    const missing = recordingApi([])
    await expect(resolveProjectId(missing.api, 'Inexistente')).rejects.toThrow('PROJECT_NOT_FOUND')
  })

  test('executeSharedTool aceita nome de projeto em vez de ID', async () => {
    const { api, calls } = recordingApi((path: string) => path === '/projects' ? [{ id: PROJECT_UUID, name: 'Azyboard' }] : { ok: true })
    await executeSharedTool('get_board', { projectId: 'Azyboard' }, { api, context: mcpContext })
    expect(calls.map(call => call.path)).toEqual(['/projects', `/projects/${PROJECT_UUID}/board`])
  })
})

describe('batch_move', () => {
  test('despacha atualização atômica de coluna para os itens informados', async () => {
    const { api, calls } = recordingApi({ updatedCount: 2 })
    const result = await executeSharedTool('batch_move', { projectId: PROJECT_UUID, itemIds: ['i1', 'i2'], columnName: 'A Fazer' }, { api, context: mcpContext })
    expect(result).toEqual({ updatedCount: 2 })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.path).toBe(`/projects/${PROJECT_UUID}/batch/items/update`)
    expect(calls[0]!.method).toBe('POST')
    const body = calls[0]!.body as { filters: { itemIds: string[]; matchAll: boolean }; changes: Array<{ field: string; operation: string; value: string }> }
    expect(body.filters.itemIds).toEqual(['i1', 'i2'])
    expect(body.filters.matchAll).toBe(false)
    expect(body.changes).toEqual([{ field: 'column', operation: 'SET', value: 'A Fazer' }])
  })

  test('valida itemIds e columnName antes da rede', () => {
    expect(() => validateToolArguments('batch_move', { projectId: 'p', itemIds: [], columnName: 'A Fazer' })).toThrow('itemIds')
    expect(() => validateToolArguments('batch_move', { projectId: 'p', itemIds: Array.from({ length: 501 }, (_, index) => `i${index}`), columnName: 'A Fazer' })).toThrow('itemIds')
    expect(() => validateToolArguments('batch_move', { projectId: 'p', itemIds: ['i1'] })).toThrow('Campo obrigatório ausente: columnName')
    expect(() => validateToolArguments('batch_move', { projectId: 'p', itemIds: ['i1'], columnName: ' ' })).toThrow('columnName')
    expect(() => validateToolArguments('batch_move', { projectId: 'p', itemIds: ['i1'], columnName: 'A Fazer' })).not.toThrow()
  })

  test('expõe schema, política e routing completos', async () => {
    const { client } = await connectedClient()
    const { tools } = await client.listTools()
    const tool = tools.find(candidate => candidate.name === 'batch_move')
    expect(tool?.inputSchema).toMatchObject({
      properties: { itemIds: { type: 'array', maxItems: 500 }, columnName: { type: 'string' } },
      required: ['projectId', 'itemIds', 'columnName'],
    })
    expect(tool?.description).toContain('atomic')
  })
})

describe('AZYBOARD_PROJECT_ID (projeto padrão)', () => {
  test('projectId vira opcional nos schemas quando há projeto padrão', async () => {
    const { client } = await connectedClient(PROJECT_UUID)
    const { tools } = await client.listTools()
    const board = tools.find(tool => tool.name === 'get_board')!
    expect(board.inputSchema.required).not.toContain('projectId')
    expect(JSON.stringify(board.inputSchema.properties!.projectId)).toContain('AZYBOARD_PROJECT_ID')
    const projects = tools.find(tool => tool.name === 'list_projects')!
    expect(projects.inputSchema.required).not.toContain('projectId')
  })

  test('mantém projectId obrigatório sem projeto padrão', async () => {
    const { client } = await connectedClient()
    const { tools } = await client.listTools()
    const board = tools.find(tool => tool.name === 'get_board')!
    expect(board.inputSchema.required).toContain('projectId')
  })

  test('injeta o projeto padrão quando projectId é omitido', async () => {
    const { client, calls } = await connectedClient(PROJECT_UUID)
    const result = await client.callTool({ name: 'get_board', arguments: {} })
    expect(result.isError ?? false).toBe(false)
    expect(calls.map(call => call.path)).toEqual([`/projects/${PROJECT_UUID}/board`])
  })

  test('projectId explícito tem precedência sobre o padrão', async () => {
    const other = '2f6d7c1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f'
    const { client, calls } = await connectedClient(PROJECT_UUID)
    await client.callTool({ name: 'get_board', arguments: { projectId: other } })
    expect(calls.map(call => call.path)).toEqual([`/projects/${other}/board`])
  })
})

describe('update_item com changes em array via servidor MCP', () => {
  test('não rejeita changes array (bug histórico do validador duplicado)', async () => {
    const { client } = await connectedClient(PROJECT_UUID)
    const result = await client.callTool({
      name: 'update_item',
      arguments: { itemId: 'i1', changes: [{ field: 'title', operation: 'SET', value: 'Novo título' }] },
    })
    expect(result.isError ?? false).toBe(false)
  })
})
