import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from './index.js'
import { executeSharedTool, OPERATION_ARGS_REQUIRED, requiredFieldsFor, SHARED_TOOL_NAMES } from './registry.js'
import { validateToolArguments } from '@azy-board/tool-registry'
import { toolGetBoard, type ApiCall } from './tools.js'

const UUID = '11111111-1111-1111-1111-111111111111'

async function exposedTools() {
  const server = createMcpServer(async () => [])
  const client = new Client({ name: 'optional-fields-test', version: '1.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return (await client.listTools()).tools
}

describe('contrato de campos opcionais do MCP', () => {
  test('o schema exposto só exige os campos realmente obrigatórios', async () => {
    const tools = await exposedTools()
    expect(tools).toHaveLength(SHARED_TOOL_NAMES.length)
    for (const tool of tools) {
      const schema = tool.inputSchema as { required?: string[] }
      expect(new Set(schema.required ?? [])).toEqual(new Set(requiredFieldsFor(tool.name)))
    }
  })

  test('list_tasks expõe apenas projectId como obrigatório e os filtros como opcionais', async () => {
    const tool = (await exposedTools()).find(item => item.name === 'list_tasks')!
    const schema = tool.inputSchema as { required: string[]; properties: Record<string, unknown> }
    expect(schema.required).toEqual(['projectId'])
    expect(schema.properties.type).toBeDefined()
    expect(schema.properties.tagIds).toBeDefined()
    expect(schema.properties.includeDescriptions).toBeDefined()
    expect(schema.required).not.toContain('tagIds')
    expect(schema.required).not.toContain('limit')
  })

  test('create_project expõe apenas name como obrigatório', async () => {
    const tool = (await exposedTools()).find(item => item.name === 'create_project')!
    const schema = tool.inputSchema as { required: string[] }
    expect(schema.required).toEqual(['name'])
  })

  test('operations expõe args exigindo apenas os campos realmente obrigatórios', async () => {
    for (const name of ['batch', 'create_project_structure']) {
      const tool = (await exposedTools()).find(item => item.name === name)!
      const schema = tool.inputSchema as unknown as { properties: { operations: { items: { properties: { args: { required: string[] } } } } } }
      const required = schema.properties.operations.items.properties.args.required
      expect(new Set(required), `${name}.operations[].args.required`).toEqual(new Set(OPERATION_ARGS_REQUIRED))
    }
  })

  test('check_items expõe items[] exigindo apenas itemId e checked', async () => {
    const tool = (await exposedTools()).find(item => item.name === 'check_items')!
    const schema = tool.inputSchema as unknown as { properties: { items: { items: { required: string[] } } } }
    expect(new Set(schema.properties.items.items.required)).toEqual(new Set(['itemId', 'checked']))
  })

  test('update_items permite omitir opcionais aninhados', async () => {
    const tool = (await exposedTools()).find(item => item.name === 'update_items')!
    const schema = tool.inputSchema as unknown as { properties: { filters: { required?: string[] }; changes: { items: { required?: string[] } } } }
    expect(schema.properties.filters.required).toEqual([])
    expect(schema.properties.changes.items.required).toEqual(['field', 'operation'])
    expect(() => validateToolArguments('update_items', {
      projectId: UUID,
      filters: { sprint: 'CURRENT', matchAll: true },
      changes: [{ field: 'title', operation: 'SET', value: 'T' }],
    })).not.toThrow()
  })

  test('update_checklist e update_item_log expõem changes como objetos próprios', async () => {
    const tools = await exposedTools()
    const checklist = tools.find(item => item.name === 'update_checklist')!.inputSchema as unknown as { properties: { changes: { type: string; properties: Record<string, unknown>; required?: string[] } } }
    const log = tools.find(item => item.name === 'update_item_log')!.inputSchema as unknown as { properties: { changes: { type: string; properties: Record<string, unknown>; required?: string[] } } }
    expect(checklist.properties.changes.type).toBe('object')
    expect(Object.keys(checklist.properties.changes.properties)).toEqual(['name', 'position'])
    expect(checklist.properties.changes.required).toEqual([])
    expect(log.properties.changes.type).toBe('object')
    expect(Object.keys(log.properties.changes.properties)).toEqual(['activity', 'durationMin'])
    expect(log.properties.changes.required).toEqual([])
  })

  test('create_item_log expõe durationMin e duration opcionais', async () => {
    const tool = (await exposedTools()).find(item => item.name === 'create_item_log')!
    const schema = tool.inputSchema as { required: string[]; properties: Record<string, unknown> }
    expect(new Set(schema.required)).toEqual(new Set(['projectId', 'itemId', 'activity']))
    expect(schema.properties.durationMin).toBeDefined()
    expect(schema.properties.duration).toBeDefined()
    expect(schema.required).not.toContain('durationMin')
    expect(schema.required).not.toContain('duration')
  })
})

describe('validação aceita null e ausência em campos opcionais', () => {
  test('list_tasks aceita filtros omitidos e nulos', () => {
    expect(() => validateToolArguments('list_tasks', { projectId: UUID })).not.toThrow()
    expect(() => validateToolArguments('list_tasks', { projectId: UUID, tagIds: null, limit: null, type: null, onlyLeaves: null })).not.toThrow()
  })

  test('set_item_tags continua exigindo tagIds', () => {
    expect(() => validateToolArguments('set_item_tags', { projectId: UUID, itemId: 'i1', tagIds: null })).toThrow('Campo obrigatório ausente: tagIds')
  })

  test('check_item aceita resolução por checklistName + position sem text', () => {
    expect(() => validateToolArguments('check_item', { projectId: UUID, itemId: 'i1', checklistName: 'Checklist', position: 2, checked: true })).not.toThrow()
  })

  test('check_items aceita entrada resolvida apenas por checklistName + position', () => {
    expect(() => validateToolArguments('check_items', { projectId: UUID, items: [{ itemId: 'i1', checklistName: 'Checklist', position: 0, checked: true }] })).not.toThrow()
  })

  test('batch aceita assignToCurrentUser omitido e rejeita tipo errado', () => {
    const operation = { tool: 'create_task', args: { ref: 'a', title: 'A', type: 'TASK', parentRef: null, moduleName: null } }
    expect(() => validateToolArguments('batch', { projectId: UUID, operations: [operation] })).not.toThrow()
    expect(() => validateToolArguments('batch', { projectId: UUID, operations: [{ tool: 'create_task', args: { ref: 'a', title: 'A', type: 'TASK', assignToCurrentUser: 'sim' } }] })).toThrow('assignToCurrentUser deve ser booleano')
  })

  test('list_tasks aceita projeção com priority, points, createdAt e updatedAt', () => {
    expect(() => validateToolArguments('list_tasks', { projectId: UUID, fields: ['id', 'priority', 'points', 'createdAt', 'updatedAt'] })).not.toThrow()
    expect(() => validateToolArguments('list_tasks', { projectId: UUID, fields: ['campoInexistente'] })).toThrow('campo desconhecido')
  })

  test('activity aceita o limite alinhado com a API e recusa acima', () => {
    expect(() => validateToolArguments('create_item_log', { projectId: UUID, itemId: 'i1', activity: 'x'.repeat(2_000) })).not.toThrow()
    expect(() => validateToolArguments('create_item_log', { projectId: UUID, itemId: 'i1', activity: 'x'.repeat(20_001) })).toThrow('excede o limite de 20000 caracteres')
  })

  test('a mensagem de limite informa o tamanho recebido', () => {
    expect(() => validateToolArguments('create_item_log', { projectId: UUID, itemId: 'i1', activity: 'x'.repeat(20_005) })).toThrow('recebido: 20005')
  })
})

describe('null vira omitido antes da execução', () => {
  test('executeSharedTool remove chaves nulas do caminho da API', async () => {
    const paths: string[] = []
    const api: ApiCall = async (path) => {
      paths.push(path)
      return []
    }
    await executeSharedTool('list_tasks', { projectId: UUID, tagIds: null, limit: null, type: null, status: null }, {
      api,
      context: { source: 'mcp', userId: 'u1', tenantId: 't1', globalGroup: 'TEAM_MEMBER' },
    })
    expect(paths).toEqual([`/projects/${UUID}/items?leaf=true&limit=50&includeDescriptions=false`])
  })

  test('null aninhado permanece disponível para o batch', async () => {
    let body: unknown
    const api: ApiCall = async (_path, _method, requestBody) => {
      body = requestBody
      return []
    }
    await executeSharedTool('batch', {
      projectId: UUID,
      operations: [{ tool: 'create_task', args: { ref: 't', title: 'T', type: 'TASK', parentRef: null, assignToCurrentUser: false } }],
    }, { api, context: { source: 'mcp', userId: 'u1', tenantId: 't1', globalGroup: 'TEAM_MEMBER' } })
    expect((body as { operations: Array<{ args: { parentRef: null } }> }).operations[0]!.args.parentRef).toBeNull()
  })
})

describe('get_board reduz o payload por padrão', () => {
  test('resume descrições longas e mantém o texto completo sob demanda', async () => {
    const long = `<p>${'A'.repeat(500)}</p>`
    const api: ApiCall = async () => ({ project: { id: 'p', description: long }, items: [{ id: 'i', title: 'T', description: long }] })
    const compact = await toolGetBoard(api, 'p') as { items: Array<{ description: string }> }
    expect(compact.items[0]!.description.length).toBeLessThan(long.length)
    expect(compact.items[0]!.description.endsWith('…')).toBe(true)

    const full = await toolGetBoard(api, 'p', true) as { items: Array<{ description: string }> }
    expect(full.items[0]!.description).toBe(long)
  })
})

describe('coerção de tipos e campos desconhecidos na fronteira de execução', () => {
  const context = { source: 'mcp', userId: 'u1', tenantId: 't1', globalGroup: 'TEAM_MEMBER' } as const

  test('limit/onlyLeaves/includeDescriptions como string geram a query correta', async () => {
    const paths: string[] = []
    const api: ApiCall = async (path) => { paths.push(path); return [] }
    await executeSharedTool('list_tasks', { projectId: UUID, limit: '5', onlyLeaves: 'false', includeDescriptions: 'true' }, { api, context })
    expect(paths[0]).toContain('leaf=false')
    expect(paths[0]).toContain('limit=5')
    expect(paths[0]).toContain('includeDescriptions=true')
  })

  test('fields como string JSON aplica projeção', async () => {
    const paths: string[] = []
    const api: ApiCall = async (path) => { paths.push(path); return [] }
    await executeSharedTool('list_tasks', { projectId: UUID, fields: '["id","title"]' }, { api, context })
    expect(decodeURIComponent(paths[0]!)).toContain('fields=id,title')
  })

  test('campo desconhecido é rejeitado antes de qualquer chamada de rede', async () => {
    let calls = 0
    const api: ApiCall = async () => { calls++; return [] }
    await expect(executeSharedTool('list_tasks', { projectId: UUID, titleContains: 'x' }, { api, context }))
      .rejects.toThrow('Campo desconhecido: titleContains')
    expect(calls).toBe(0)
  })

  test('create_item_log normaliza duration legível e envia durationMin', async () => {
    let body: unknown
    const api: ApiCall = async (_path, _method, requestBody) => { body = requestBody; return { id: 'l1', durationMin: 90 } }
    await executeSharedTool('create_item_log', { projectId: UUID, itemId: 'i1', activity: 'Revisão', duration: '1h30' }, { api, context })
    expect(body).toEqual({ activity: 'Revisão', durationMin: 90 })
  })

  test('batch com atomic interno e booleano aninhado como string', async () => {
    let body: unknown
    const api: ApiCall = async (_path, _method, requestBody) => { body = requestBody; return { results: [] } }
    await executeSharedTool('batch', {
      projectId: UUID,
      atomic: true,
      operations: [{ tool: 'create_task', args: { ref: 'a', title: 'T', type: 'TASK', assignToCurrentUser: 'false' } }],
    }, { api, context })
    expect((body as { atomic: boolean }).atomic).toBe(true)
    const operations = (body as { operations: Array<{ args: { assignToCurrentUser: boolean } }> }).operations
    expect(operations[0]!.args.assignToCurrentUser).toBe(false)
  })
})
