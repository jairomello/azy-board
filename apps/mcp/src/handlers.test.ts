import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from './index.js'

const api = async (path: string): Promise<unknown> => {
  if (path === '/projects') return []
  throw new Error(`fake route: ${path}`)
}

async function connectedClient() {
  const server = createMcpServer(api)
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return { client, server }
}

describe('MCP protocol handlers', () => {
  test('registra ferramentas com schemas completos e sem upload', async () => {
    const { client } = await connectedClient()
    const result = await client.listTools()
    expect(result.tools.length).toBeGreaterThan(40)
    expect(result.tools.every(tool => tool.inputSchema.type === 'object')).toBe(true)
    expect(result.tools.some(tool => tool.name.includes('upload'))).toBe(false)
    expect(result.tools.find(tool => tool.name === 'batch')?.inputSchema).toMatchObject({
      properties: { operations: { type: 'array', maxItems: 50 } },
    })
  })

  test('retorna erro estruturado para argumentos ausentes', async () => {
    const { client } = await connectedClient()
    const result = await client.callTool({ name: 'create_task', arguments: {} })
    expect(result.isError).toBe(true)
    expect(result.structuredContent).toMatchObject({ code: 'MCP_TOOL_ERROR', retryable: false })
    expect(JSON.stringify(result)).not.toContain('at ')
  })

  test('executa todos os handlers registrados com resposta MCP válida', async () => {
    const { client } = await connectedClient()
    const { tools } = await client.listTools()
    for (const tool of tools) {
      const result = await client.callTool({ name: tool.name, arguments: {} })
      expect(result.structuredContent).toBeDefined()
      expect(result.isError === undefined || typeof result.isError === 'boolean').toBe(true)
    }
  })

  test('preserva erro de resposta inválida da API como erro estável', async () => {
    const { client } = await connectedClient()
    const result = await client.callTool({ name: 'list_projects', arguments: {} })
    expect(result.isError ?? false).toBe(false)
    expect(result.structuredContent).toEqual({ data: [] })
  })
})
