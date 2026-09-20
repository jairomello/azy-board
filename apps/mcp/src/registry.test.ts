import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from './index.js'
import { dependencyToolsFor, executeSharedTool, getSharedToolDefinitions, sanitizeToolOutput, searchSharedTools, selectSharedTools, SHARED_TOOL_NAMES, SKILL_COMMAND_INTENTS } from './registry.js'
import { validateToolArguments } from './validation.js'

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
    expect(tool.inputSchema.required).toEqual(['name', 'description', 'boardMode', 'advancedChecklists', 'startDate', 'plannedEndDate', 'plannedPoints', 'plannedHours', 'scope'])
    expect(tool.inputSchema.properties.boardMode).toMatchObject({ enum: ['HIERARCHICAL', 'SIMPLE', null] })
    expect(tool.inputSchema.properties.startDate).toMatchObject({ description: expect.stringContaining('YYYY-MM-DD') })
    expect(tool.inputSchema.properties.plannedPoints).toMatchObject({ type: expect.arrayContaining(['number', 'null']) })
    expect(tool.description).toContain('Only name is required')
  })

  test('documenta a hierarquia semântica dos IDs de checklist', () => {
    const definitions = getSharedToolDefinitions(['add_checklist_item', 'add_checklist_item_to_task', 'check_item'])
    for (const tool of definitions) {
      expect(tool.inputSchema.properties.itemId).toMatchObject({ description: expect.stringContaining('parent card') })
      if (tool.inputSchema.properties.checklistId) expect(tool.inputSchema.properties.checklistId).toMatchObject({ description: expect.stringContaining('itemId') })
    }
    expect(getSharedToolDefinitions(['add_checklist_item_to_task'])[0]?.description).toContain('creates the checklist')
  })

  test('expõe campos avançados opcionais nos passos de checklist', () => {
    const add = getSharedToolDefinitions(['add_checklist_item'])[0]!
    expect(add.inputSchema.properties).toHaveProperty('dueDate')
    expect(add.inputSchema.properties).toHaveProperty('assigneeId')
    expect(add.inputSchema.properties).toHaveProperty('description')
    expect(getSharedToolDefinitions(['add_checklist_item_to_task'])[0]?.inputSchema.properties).toHaveProperty('dueDate')

    const update = getSharedToolDefinitions(['update_checklist_item'])[0]!
    const changes = update.inputSchema.properties.changes as { properties: Record<string, unknown> }
    expect(Object.keys(changes.properties).sort()).toEqual(['assigneeId', 'checked', 'description', 'dueDate', 'text'])
    expect(update.description).toContain('dueDate')
  })

  test('valida os campos avançados das ferramentas de checklist', () => {
    expect(() => validateToolArguments('update_checklist_item', {
      projectId: 'p', itemId: 'i', checklistId: 'c', checklistItemId: 'ci',
      changes: { text: null, checked: null, dueDate: '2026-10-01', assigneeId: 'u', description: '<p>x</p>' },
    })).not.toThrow()
    expect(() => validateToolArguments('add_checklist_item', {
      projectId: 'p', itemId: 'i', checklistId: 'c', text: 'Passo', dueDate: '2026-10-01', assigneeId: 'u', description: '<p>x</p>',
    })).not.toThrow()
    expect(() => validateToolArguments('update_checklist_item', {
      projectId: 'p', itemId: 'i', checklistId: 'c', checklistItemId: 'ci', changes: { dueDate: 'data-invalida' },
    })).toThrow(/dueDate/)
    expect(() => validateToolArguments('update_checklist_item', {
      projectId: 'p', itemId: 'i', checklistId: 'c', checklistItemId: 'ci', changes: { campoDesconhecido: 'x' },
    })).toThrow(/inválido/)
  })

  test('sanitiza segredos e limita strings de saída', () => {
    const output = sanitizeToolOutput({ token: 'secret', apiKey: 'secret', title: 'ok', nested: { ciphertext: 'secret' }, text: 'x'.repeat(20_001) }) as Record<string, unknown>
    expect(output).not.toHaveProperty('token')
    expect(output).not.toHaveProperty('apiKey')
    expect(output).not.toHaveProperty('nested.ciphertext')
    expect(String(output.text).length).toBe(20_001)
  })

  test('expõe metadata de routing e dependencies para todo o catálogo', () => {
    const definitions = getSharedToolDefinitions()
    expect(definitions).toHaveLength(SHARED_TOOL_NAMES.length)
    expect(definitions.every(tool => tool.routing.domain && tool.routing.scope && tool.routing.operation && tool.routing.risk && Array.isArray(tool.routing.supportedScreens))).toBe(true)
    expect(getSharedToolDefinitions(['claim_task'])[0]?.routing.operation).toBe('update')
    expect(getSharedToolDefinitions(['delete_project'])[0]?.routing.risk).toBe('DESTRUCTIVE')
    expect(dependencyToolsFor(['batch'])).toEqual(['list_tasks', 'list_modules', 'list_columns'])
    expect(searchSharedTools('project').map(tool => tool.name)).toContain('create_project')
  })

  test('mantém matriz de telas, intenções e policies coerente', () => {
    const definitions = getSharedToolDefinitions()
    const screens = [...new Set(definitions.flatMap(tool => tool.routing.supportedScreens))]
    const intents = ['read', 'plan', 'start'] as const
    for (const screen of ['projects-index', 'project-board-kanban', 'project-board-tree', 'project-dashboard', 'project-settings', 'item-detail', 'account', 'admin-users', 'admin-assistant', 'global-other']) expect(screens.includes(screen as typeof screens[number])).toBe(true)
    for (const screen of screens) {
      expect(definitions.some(tool => tool.routing.supportedScreens.includes(screen))).toBe(true)
      for (const intent of intents) {
        const selected = selectSharedTools(intent)
        expect(selected.every(tool => tool.policy.globalGroup)).toBe(true)
      }
    }
  })
})
