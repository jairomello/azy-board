import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from './index.js'
import { executeSharedTool, requiredFieldsFor, SHARED_TOOL_NAMES } from './registry.js'
import { validateToolArguments } from './validation.js'
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
    expect(schema.properties.includeDescriptions).toBeUndefined()
    expect(schema.required).not.toContain('tagIds')
    expect(schema.required).not.toContain('limit')
  })

  test('create_project expõe apenas name como obrigatório', async () => {
    const tool = (await exposedTools()).find(item => item.name === 'create_project')!
    const schema = tool.inputSchema as { required: string[] }
    expect(schema.required).toEqual(['name'])
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
    expect(paths).toEqual([`/projects/${UUID}/items?leaf=true`])
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
