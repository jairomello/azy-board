import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from './index.js'
import { executeSharedTool, getSharedToolDefinitions, sanitizeToolOutput, selectSharedTools, SHARED_TOOL_NAMES, SKILL_COMMAND_INTENTS } from './registry.js'

describe('shared MCP/Azy Agent registry', () => {
  test('mantém paridade de nomes com o catálogo exposto pelo servidor MCP', async () => {
    const server = createMcpServer(async (path) => path === '/projects' ? [] : [])
    const client = new Client({ name: 'registry-test', version: '1.0.0' })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
    const exposed = (await client.listTools()).tools.map(tool => tool.name).sort()
    expect(exposed).toEqual([...SHARED_TOOL_NAMES].sort())
    expect(getSharedToolDefinitions().every(tool => tool.policy && tool.inputSchema.additionalProperties === false)).toBe(true)
  })

  test('exige contexto humano para o adapter interno e não aceita tool desconhecida', async () => {
    const api = async () => []
    await expect(executeSharedTool('list_projects', {}, { api, context: { source: 'azy-agent', userId: '', tenantId: 't', globalGroup: 'TEAM_MEMBER' }, authorize: async () => {} })).rejects.toThrow('USER_CONTEXT_REQUIRED')
    await expect(executeSharedTool('not-registered', {}, { api, context: { source: 'azy-agent', userId: 'u', tenantId: 't', globalGroup: 'TEAM_MEMBER' } })).rejects.toThrow('TOOL_NOT_REGISTERED')
  })

  test('revalida autorização antes da execução interna', async () => {
    let called = false
    await expect(executeSharedTool('list_projects', {}, { api: async () => { called = true; return [] }, context: { source: 'azy-agent', userId: 'u', tenantId: 't', globalGroup: 'TEAM_MEMBER' } })).rejects.toThrow('AUTHORIZATION_REVALIDATION_REQUIRED')
    expect(called).toBe(false)
  })

  test('seleciona progressivamente leitura e planejamento', () => {
    expect(selectSharedTools('unknown').every(tool => tool.namespace === 'discovery')).toBe(true)
    expect(selectSharedTools('status').some(tool => tool.name === 'create_task')).toBe(false)
    expect(selectSharedTools('plan').some(tool => tool.name === 'create_checklist')).toBe(true)
    expect(Object.keys(SKILL_COMMAND_INTENTS)).toEqual(['status', 'plan', 'start', 'update', 'complete', 'review'])
  })

  test('create_project não pede manager nem campos opcionais desconhecidos', () => {
    const tool = getSharedToolDefinitions(['create_project'])[0]!
    expect(tool.inputSchema.properties).not.toHaveProperty('managerUserId')
    expect(tool.inputSchema.required).toEqual(['name', 'description', 'boardMode'])
    expect(tool.inputSchema.properties.boardMode).toMatchObject({ enum: ['HIERARCHICAL', 'SIMPLE', null] })
    expect(tool.description).toContain('Only name is required')
  })

  test('sanitiza segredos e limita strings de saída', () => {
    const output = sanitizeToolOutput({ token: 'secret', apiKey: 'secret', title: 'ok', nested: { ciphertext: 'secret' }, text: 'x'.repeat(20_001) }) as Record<string, unknown>
    expect(output).not.toHaveProperty('token')
    expect(output).not.toHaveProperty('apiKey')
    expect(output).not.toHaveProperty('nested.ciphertext')
    expect(String(output.text).length).toBe(20_001)
  })
})
