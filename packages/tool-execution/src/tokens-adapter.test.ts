import { describe, expect, test } from 'bun:test'
import { toolCompleteTask, toolSetItemTokens, type ApiCall } from './http-adapter'

// T77 — adaptador HTTP: registro massivo de tokens e aviso de tokens ausentes.

describe('toolSetItemTokens', () => {
  test('envia o lote em um único POST e normaliza a resposta', async () => {
    const calls: Array<{ path: string; method: string; body: unknown }> = []
    const api: ApiCall = async (path, method, body) => {
      calls.push({ path, method: method ?? 'GET', body })
      return { matchedCount: 2, updatedCount: 2, applied: [{ itemId: 'a', tokensTotal: 1500 }], failed: [] }
    }
    const result = await toolSetItemTokens(api, 'p1', [{ itemId: 'a', tokensInput: 1200, tokensOutput: 300 }, { itemId: 'b' }]) as { matched: number; updated: number; items: unknown[]; failures: unknown[] }

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ path: '/projects/p1/items/tokens', method: 'POST' })
    expect(calls[0]!.body).toEqual({ items: [{ itemId: 'a', tokensInput: 1200, tokensOutput: 300 }, { itemId: 'b', tokensInput: null, tokensOutput: null }] })
    expect(result).toMatchObject({ matched: 2, updated: 2 })
    expect(result.items).toHaveLength(1)
    expect(result.failures).toEqual([])
  })

  test('rejeita lote vazio', async () => {
    const api: ApiCall = async () => ({})
    expect(toolSetItemTokens(api, 'p1', [])).rejects.toThrow('items deve conter entre 1 e 500 entradas')
  })
})

describe('toolCompleteTask — aviso de tokens ausentes', () => {
  test('inclui aviso quando o card é de agente e não tem tokens', async () => {
    const api: ApiCall = async (path) => {
      if (path.endsWith('/columns')) return [{ id: 'done', name: 'Concluídas', baseStatus: 'DONE' }]
      if (path.endsWith('/move')) return { item: { id: 't1' } }
      return { id: 't1', type: 'TASK', isLeaf: true, assigneeApiKeyId: 'key-1', tokensInput: null, tokensOutput: null }
    }
    const result = await toolCompleteTask(api, 'p1', 't1') as { warning?: string }
    expect(result.warning).toContain('tokens')
  })

  test('não inclui aviso quando o card já tem tokens', async () => {
    const api: ApiCall = async (path) => {
      if (path.endsWith('/columns')) return [{ id: 'done', name: 'Concluídas', baseStatus: 'DONE' }]
      if (path.endsWith('/move')) return { item: { id: 't1' } }
      return { id: 't1', type: 'TASK', isLeaf: true, assigneeApiKeyId: 'key-1', tokensInput: 10, tokensOutput: 5 }
    }
    const result = await toolCompleteTask(api, 'p1', 't1') as { warning?: string }
    expect(result.warning).toBeUndefined()
  })

  test('não inclui aviso quando não há indício de execução por agente', async () => {
    const api: ApiCall = async (path) => {
      if (path.endsWith('/columns')) return [{ id: 'done', name: 'Concluídas', baseStatus: 'DONE' }]
      if (path.endsWith('/move')) return { item: { id: 't1' } }
      return { id: 't1', type: 'TASK', isLeaf: true, assigneeApiKeyId: null, tokensInput: null, tokensOutput: null }
    }
    const result = await toolCompleteTask(api, 'p1', 't1') as { warning?: string }
    expect(result.warning).toBeUndefined()
  })
})
