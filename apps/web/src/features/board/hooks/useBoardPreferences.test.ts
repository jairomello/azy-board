import { describe, expect, test } from 'bun:test'
import { normalizePersistedFilters } from './useBoardPreferences'
import { DEFAULT_FILTERS, EMPTY_FILTER_VALUE } from '../model/types'

describe('restauração de filtros persistidos', () => {
  test('preserva o sentinela de valor vazio ao mesclar com os defaults', () => {
    const restored = normalizePersistedFilters({
      sprintId: EMPTY_FILTER_VALUE,
      versionId: EMPTY_FILTER_VALUE,
      assigneeId: EMPTY_FILTER_VALUE,
      authorId: EMPTY_FILTER_VALUE,
      costCenterId: EMPTY_FILTER_VALUE,
    })
    expect(restored.sprintId).toBe(EMPTY_FILTER_VALUE)
    expect(restored.versionId).toBe(EMPTY_FILTER_VALUE)
    expect(restored.assigneeId).toBe(EMPTY_FILTER_VALUE)
    expect(restored.authorId).toBe(EMPTY_FILTER_VALUE)
    expect(restored.costCenterId).toBe(EMPTY_FILTER_VALUE)
  })

  test('preenche defaults para campos ausentes e normaliza listas', () => {
    const restored = normalizePersistedFilters({ sprintId: EMPTY_FILTER_VALUE, types: undefined as never })
    expect(restored.types).toEqual([])
    expect(restored.tagIds).toEqual([])
    expect(restored.hideEmptyEpics).toBe(DEFAULT_FILTERS.hideEmptyEpics)
    expect(restored.storyDisplay).toBe(DEFAULT_FILTERS.storyDisplay)
  })

  test('remove a chave legada showStories sem afetar o sentinela', () => {
    const restored = normalizePersistedFilters({ showStories: true, versionId: EMPTY_FILTER_VALUE })
    expect(restored.versionId).toBe(EMPTY_FILTER_VALUE)
    expect((restored as unknown as Record<string, unknown>).showStories).toBeUndefined()
  })
})
