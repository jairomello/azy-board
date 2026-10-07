import { describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from './index.js'
import { dependencyToolsFor, executeSharedTool, getSharedToolDefinitions, sanitizeToolOutput, searchSharedTools, selectSharedTools, SHARED_TOOL_NAMES, SKILL_COMMAND_INTENTS } from '@azy-board/tool-execution'
import { validateToolArguments } from '@azy-board/tool-registry'

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
    expect(tool.inputSchema.required).toEqual(['name', 'description', 'boardMode', 'advancedChecklists', 'startDate', 'plannedEndDate', 'plannedPoints', 'plannedHours', 'scope', 'icon', 'color'])
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

  test('registra check_items com limite e política de escrita', () => {
    const tool = getSharedToolDefinitions(['check_items'])[0]!
    expect(tool.policy.localRole).toBe('MEMBER')
    expect(tool.inputSchema.properties.items).toMatchObject({ type: 'array', maxItems: 100 })
    expect(tool.routing.operation).toBe('update')
    expect(() => validateToolArguments('check_items', { projectId: 'p', items: Array.from({ length: 101 }, () => ({ itemId: 'i', checked: true })) })).toThrow('1 e 100')
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

// Baseline de paridade capturado antes de mover o dispatcher para o pacote
// compartilhado. Estes fixtures preservam resolução/coerção, autorização,
// snapshot e forma do resultado; sanitização, null/CLEAR e approval têm também
// casos dedicados neste arquivo e em assistant.test.ts.
const executionContractFixture = {
  project: { id: '11111111-1111-1111-1111-111111111111', name: 'Projeto Contrato', boardMode: 'SIMPLE' },
  logResult: { id: 'log-contract', activity: 'Revisão', durationMin: 90 },
  revisions: { 'card-contract': '2026-10-07T01:02:03.000Z' },
}

describe('baseline de contrato da execução compartilhada (pré-extração T40)', () => {
  test('coage duração, resolve projeto por nome e preserva o formato do resultado', async () => {
    const calls: Array<{ path: string; method: string; body?: unknown }> = []
    const api = async (path: string, method = 'GET', body?: unknown) => {
      calls.push({ path, method, body })
      if (path === '/projects') return [executionContractFixture.project]
      if (path.endsWith('/items/card-contract/logs')) return executionContractFixture.logResult
      return []
    }

    const result = await executeSharedTool('create_item_log', {
      projectId: executionContractFixture.project.name,
      itemId: 'card-contract',
      activity: ' Revisão ',
      duration: '1h30',
    }, { api, context: { source: 'mcp', userId: 'user-contract', tenantId: 'tenant-contract', globalGroup: 'TEAM_MEMBER' } })

    expect(calls).toEqual([
      { path: '/projects', method: 'GET', body: undefined },
      {
        path: `/projects/${executionContractFixture.project.id}/items/card-contract/logs`,
        method: 'POST',
        body: { activity: 'Revisão', durationMin: 90 },
      },
    ])
    expect(result).toEqual(executionContractFixture.logResult)
  })

  test('revalida autorização antes do dispatch e injeta revisões da fotografia', async () => {
    const events: string[] = []
    let requestBody: Record<string, unknown> | undefined
    const context = {
      source: 'azy-agent' as const,
      userId: 'user-contract',
      tenantId: 'tenant-contract',
      globalGroup: 'TEAM_MEMBER' as const,
      projectId: executionContractFixture.project.id,
      runId: 'run-contract',
      screenSnapshot: {
        schemaVersion: 1 as const,
        contextId: 'snapshot-contract',
        capturedAt: '2026-10-07T01:02:03.000Z',
        route: '/projects/11111111-1111-1111-1111-111111111111/board',
        screen: 'project-board-kanban' as const,
        projectId: executionContractFixture.project.id,
        projectName: executionContractFixture.project.name,
        view: { mode: 'kanban' as const, activeModuleId: null, collapsedGroupIds: [] },
        filters: {},
        scope: { mode: 'FILTERED' as const },
        results: {
          displayedItemIds: ['card-contract'],
          displayedCount: 1,
          totalMatchingCount: 1,
          isComplete: true,
          revisions: executionContractFixture.revisions,
        },
        focus: { modalStack: 0, activeItemId: null, activeTab: null, hasUnsavedChanges: false },
      },
    }

    const result = await executeSharedTool('update_items', {
      projectId: executionContractFixture.project.id,
      filters: { itemIds: ['card-contract'] },
      changes: [{ field: 'title', operation: 'SET', value: 'Título atualizado' }],
    }, {
      api: async (_path, method, body) => {
        events.push('dispatch')
        expect(method).toBe('POST')
        requestBody = body as Record<string, unknown>
        return { updatedCount: 1 }
      },
      context,
      operationId: 'op-contract',
      authorize: async (_context, name) => {
        expect(name).toBe('update_items')
        events.push('authorized')
      },
    })

    expect(events).toEqual(['authorized', 'dispatch'])
    expect(requestBody).toMatchObject({
      agentRunId: 'op-contract',
      filters: { itemIds: ['card-contract'], expectedRevisions: executionContractFixture.revisions },
    })
    expect(result).toEqual({ updatedCount: 1 })
  })
})

describe('composição de squad e cadastros pelo catálogo (T25)', () => {
  const projectId = '11111111-1111-1111-1111-111111111111'
  const members = [
    { userId: 'u-ana', name: 'Ana', email: 'ana@test.local' },
    { userId: 'u-bruno', name: 'Bruno', email: 'bruno@test.local' },
  ]
  const squads = [{ id: 'sq-a', name: 'Squad A' }, { id: 'sq-b', name: 'Squad B' }]

  function mockApi(calls: Array<{ path: string; method: string; body?: unknown }>) {
    return async (path: string, method = 'GET', body?: unknown) => {
      calls.push({ path, method, body })
      if (method === 'GET' && path.endsWith('/members')) return members
      if (method === 'GET' && path.endsWith('/squads')) return squads
      return { ok: true }
    }
  }

  test('resolve membro por e-mail e squad por nome antes de executar', async () => {
    const calls: Array<{ path: string; method: string; body?: unknown }> = []
    await executeSharedTool('set_member_squad', { projectId, userId: 'ana@test.local', squadId: 'Squad B' }, {
      api: mockApi(calls), context: { source: 'mcp', userId: 'u', tenantId: 't', globalGroup: 'TEAM_MEMBER' },
    })
    const patch = calls.find(call => call.method === 'PATCH')!
    expect(patch).toEqual({ path: `/projects/${projectId}/members/u-ana`, method: 'PATCH', body: { squadId: 'sq-b' } })
  })

  test('CLEAR envia squadId null sem resolver', async () => {
    const calls: Array<{ path: string; method: string; body?: unknown }> = []
    await executeSharedTool('set_member_squad', { projectId, userId: 'u-bruno', squadId: null }, {
      api: mockApi(calls), context: { source: 'mcp', userId: 'u', tenantId: 't', globalGroup: 'TEAM_MEMBER' },
    })
    expect(calls.find(call => call.method === 'PATCH')).toEqual({ path: `/projects/${projectId}/members/u-bruno`, method: 'PATCH', body: { squadId: null } })
  })

  test('homônimos exigem identificador e squad externo é recusado', async () => {
    const homonymApi = async (path: string) => {
      if (path.endsWith('/members')) return [...members, { userId: 'u-ana-2', name: 'Ana', email: 'ana2@test.local' }]
      return []
    }
    await expect(executeSharedTool('set_member_squad', { projectId, userId: 'Ana', squadId: 'sq-a' }, {
      api: homonymApi, context: { source: 'mcp', userId: 'u', tenantId: 't', globalGroup: 'TEAM_MEMBER' },
    })).rejects.toThrow('AMBIGUOUS_MEMBER')
    const memberOnlyApi = async (path: string) => (path.endsWith('/members') ? members : [])
    await expect(executeSharedTool('set_member_squad', { projectId, userId: 'u-ana', squadId: 'Squad Externo' }, {
      api: memberOnlyApi, context: { source: 'mcp', userId: 'u', tenantId: 't', globalGroup: 'TEAM_MEMBER' },
    })).rejects.toThrow('SQUAD_NOT_FOUND')
  })

  test('update_tag valida cor e despacha PATCH', async () => {
    const calls: Array<{ path: string; method: string; body?: unknown }> = []
    await executeSharedTool('update_tag', { projectId, tagId: '22222222-2222-2222-2222-222222222222', color: '#00ff00' }, {
      api: mockApi(calls), context: { source: 'mcp', userId: 'u', tenantId: 't', globalGroup: 'TEAM_MEMBER' },
    })
    expect(calls.find(call => call.method === 'PATCH')).toMatchObject({ method: 'PATCH', body: { color: '#00ff00' } })
  })
})
