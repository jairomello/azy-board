import '../../../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useBoardArchiving } from './useBoardArchiving'
import type { ToastOptions } from '../../../components/Toast'
import type { ItemData } from '../model/types'

const fetchOriginal = globalThis.fetch
const calls: string[] = []

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
  calls.length = 0
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    if (url.includes('/items/task-1/archive') || url.includes('/items/task-1/unarchive')) {
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

  test('oferece "Desfazer" no toast e restaura o item na grade', async () => {
    let boardCalls = 0
    let treeCalls = 0
    const toasts: Array<{ message: string; options?: ToastOptions }> = []

    const { result } = renderHook(() => useBoardArchiving({
      projectId: 'project-1',
      allItems: [item],
      setAllItems: () => {},
      invalidateBoard: () => { boardCalls += 1 },
      invalidateTree: async () => { treeCalls += 1 },
      toast: (message, _type, options) => { toasts.push({ message, options }) },
      tBoard: key => key,
    }))

    act(() => { result.current.requestArchive('task-1') })

    await waitFor(() => expect(toasts).toHaveLength(1))
    const action = toasts[0]?.options?.action
    expect(action?.label).toBe('undo')
    // A janela de arrependimento precisa durar mais que o toast comum (3,5s).
    expect(toasts[0]?.options?.durationMs ?? 0).toBeGreaterThanOrEqual(5000)

    act(() => { action?.onClick() })

    await waitFor(() => expect(calls.some(url => url.includes('/items/task-1/unarchive'))).toBe(true))
    await waitFor(() => expect(treeCalls).toBe(2))
    expect(boardCalls).toBe(2)
  })
})
