import '../../../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useBoardArchiving } from './useBoardArchiving'
import type { ItemData } from '../model/types'

const fetchOriginal = globalThis.fetch

const item: ItemData = {
  id: 'task-1',
  type: 'TASK',
  title: 'Tarefa',
  columnId: 'todo',
  status: 'NOT_STARTED',
  isLeaf: true,
  ancestryPath: '[]',
} as ItemData

beforeEach(() => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).includes('/items/task-1/archive')) {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: 'não esperado' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = fetchOriginal
})

describe('useBoardArchiving — reconciliação da grade', () => {
  test('invalida a árvore além do board para a linha arquivada sumir da grade', async () => {
    let boardCalls = 0
    let treeCalls = 0
    let itemsCalls = 0

    const { result } = renderHook(() => useBoardArchiving({
      projectId: 'project-1',
      allItems: [item],
      setAllItems: () => { itemsCalls += 1 },
      invalidateBoard: () => { boardCalls += 1 },
      invalidateTree: async () => { treeCalls += 1 },
      toast: () => {},
      tBoard: key => key,
    }))

    act(() => { result.current.requestArchive('task-1') })

    await waitFor(() => expect(treeCalls).toBe(1))
    expect(boardCalls).toBe(1)
    expect(itemsCalls).toBe(1)
  })
})
