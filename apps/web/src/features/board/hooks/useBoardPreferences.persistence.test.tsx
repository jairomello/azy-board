import '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'
import { clearBoardFilters } from '../../../components/BoardFilters'
import { DEFAULT_FILTERS } from '../model/types'
import { useBoardPreferences } from './useBoardPreferences'

const PROJECT = 'project-persistencia'
const STORAGE_KEY = `board-filters:${PROJECT}`

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

// Garante o que a UI faz com o estado do filtro: o cabeçalho e o "Limpar"
// compartilham a mesma preferência durável por projeto.
describe('persistência dos filtros do board', () => {
  test('grava o filtro aplicado e restaura ao remontar', async () => {
    const first = renderHook(() => useBoardPreferences(PROJECT))
    act(() => first.result.current.setFilters({ ...DEFAULT_FILTERS, status: 'DONE', priority: 'HIGH' }))

    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').status).toBe('DONE'))
    first.unmount()

    const second = renderHook(() => useBoardPreferences(PROJECT))
    expect(second.result.current.filters.status).toBe('DONE')
    expect(second.result.current.filters.priority).toBe('HIGH')
  })

  test('limpar zera o filtro persistido e não volta no próximo mount', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_FILTERS, status: 'DONE', updatedWithin: '1w' }))
    const first = renderHook(() => useBoardPreferences(PROJECT))
    expect(first.result.current.filters.status).toBe('DONE')

    act(() => first.result.current.setFilters(previous => clearBoardFilters(previous)))
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      expect(stored.status).toBe('')
      expect(stored.updatedWithin).toBe('')
    })
    first.unmount()

    const second = renderHook(() => useBoardPreferences(PROJECT))
    expect(second.result.current.filters.status).toBe('')
  })

  test('overlay de sessão do assistente não regrava a preferência durável', async () => {
    sessionStorage.setItem(`azy-board:view-session:${PROJECT}`, '{}')
    const { result } = renderHook(() => useBoardPreferences(PROJECT))

    await act(async () => {
      result.current.setFilters({ ...DEFAULT_FILTERS, status: 'DONE' })
    })

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
