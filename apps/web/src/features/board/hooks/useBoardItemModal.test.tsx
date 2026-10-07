import '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { renderHook, waitFor } from '@testing-library/react'
import * as bunTest from 'bun:test'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module

const pending: Array<{ path: string; resolve: (value: unknown) => void; reject: (error: unknown) => void }> = []

mockModule('../../../lib/api', () => ({
  ApiError: class MockApiError extends Error {},
  api: {
    get: (path: string) => new Promise((resolve, reject) => { pending.push({ path, resolve, reject }) }),
  },
}))

const { useBoardItemModal } = await import('./useBoardItemModal')

describe('carregamento da modal: respostas antigas', () => {
  beforeEach(() => { pending.length = 0 })

  test('descarta resposta tardia do item anterior ao trocar de item', async () => {
    const { result, rerender } = renderHook(
      (props: { projectId: string; itemId: string | null }) => useBoardItemModal(props.projectId, props.itemId),
      { initialProps: { projectId: 'p1', itemId: 'a' } },
    )
    const callA = pending[0]!
    expect(callA.path).toBe('/projects/p1/items/a')

    rerender({ projectId: 'p1', itemId: 'b' })
    const callB = pending[1]!
    callB.resolve({ id: 'b', title: 'B' })
    await waitFor(() => expect(result.current?.id).toBe('b'))

    // A resposta do item A chega depois e não pode sobrescrever o item B.
    callA.resolve({ id: 'a', title: 'A' })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(result.current?.id).toBe('b')
  })

  test('descarta resposta tardia ao trocar de projeto', async () => {
    const { result, rerender } = renderHook(
      (props: { projectId: string; itemId: string | null }) => useBoardItemModal(props.projectId, props.itemId),
      { initialProps: { projectId: 'p1', itemId: 'a' } },
    )
    const callP1 = pending[0]!

    rerender({ projectId: 'p2', itemId: 'a' })
    const callP2 = pending[1]!
    expect(callP2.path).toBe('/projects/p2/items/a')
    callP2.resolve({ id: 'a', title: 'P2' })
    await waitFor(() => expect(result.current?.title).toBe('P2'))

    callP1.resolve({ id: 'a', title: 'P1' })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(result.current?.title).toBe('P2')
  })
})
