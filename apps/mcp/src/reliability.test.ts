import { describe, expect, test } from 'bun:test'
import { makeApiCall } from './index.js'
import { toolBatch, toolListTasks } from './tools.js'
import { validateToolArguments } from '@azy-board/tool-registry'

describe('MCP reliability contracts', () => {
  test('preserva paginação e permite chamadas concorrentes', async () => {
    const requests: string[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: string) => {
      requests.push(input)
      const url = new URL(input)
      return new Response(JSON.stringify({ data: [{ id: url.searchParams.get('cursor') ?? 'first' }], meta: { limit: 1, hasMore: false } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof fetch
    try {
      const api = await makeApiCall('http://test.invalid', 'key')
      const result = await Promise.all([
        toolListTasks(api, { projectId: 'p', limit: 1 }),
        toolListTasks(api, { projectId: 'p', cursor: 'next', limit: 1 }),
      ])
      expect((result[0] as Array<{ id: string }>)[0]?.id).toBe('first')
      expect((result[1] as Array<{ id: string }>)[0]?.id).toBe('next')
      expect(requests).toHaveLength(2)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('valida limite de batch antes da rede', async () => {
    let calls = 0
    const api = async () => { calls++; return null }
    await expect(toolBatch(api, { projectId: 'p', operations: Array.from({ length: 51 }, () => ({ tool: 'create_task', args: {} })) })).rejects.toThrow()
    expect(calls).toBe(0)
  })

  test('rejeita hierarquia de lote promovida, órfã ou fora de ordem', () => {
    expect(() => validateToolArguments('batch', { projectId: 'p', operations: [
      { tool: 'create_task', args: { ref: 's1', title: 'Story órfã', type: 'STORY', parentRef: null, moduleName: null, assignToCurrentUser: false } },
    ] })).toThrow('STORY deve ter um EPIC')
    expect(() => validateToolArguments('batch', { projectId: 'p', operations: [
      { tool: 'create_task', args: { ref: 'e1', title: 'Epic', type: 'EPIC', parentRef: null, moduleName: 'Geral', assignToCurrentUser: false } },
      { tool: 'create_task', args: { ref: 't1', title: 'Task sob epic', type: 'TASK', parentRef: 'e1', moduleName: null, assignToCurrentUser: true } },
    ] })).toThrow('TASK com parentRef deve apontar para uma STORY')
  })

  test('valida atualizações genéricas filtradas e operações de data', () => {
    const filters = { itemIds: null, types: ['TASK'], statuses: null, sprint: 'CURRENT', version: null, module: null, assignee: null, parent: null, column: null, tag: null, titleContains: null, onlyLeaves: null, matchAll: false }
    expect(() => validateToolArguments('update_items', { projectId: 'p', filters, changes: [{ field: 'dueDate', operation: 'OFFSET_DAYS', value: '1' }] })).not.toThrow()
    expect(() => validateToolArguments('update_items', { projectId: 'p', filters: { ...filters, types: null, sprint: null }, changes: [{ field: 'title', operation: 'SET', value: 'Novo' }] })).toThrow('Informe filtros')
    expect(() => validateToolArguments('update_items', { projectId: 'p', filters, changes: [{ field: 'title', operation: 'TODAY', value: null }] })).toThrow('só pode ser usado em datas')
  })

  test('não duplica chamadas quando o cliente reutiliza a resposta idempotente', async () => {
    let calls = 0
    const api = async (..._args: [string, string?, unknown?]) => { calls++; return { id: 'same' } }
    const first = await api('/projects/p', 'POST', { idempotencyKey: 'k' })
    const second = first
    expect(second).toEqual(first)
    expect(calls).toBe(1)
  })
})
