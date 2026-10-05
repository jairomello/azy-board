import { describe, expect, test } from 'bun:test'
import {
  EMPTY_FILTER_VALUE,
  matchesMemberFilter,
  matchesScalarFilter,
  matchesSprintFilter,
  populationFilterReasons,
  type ItemVisibilityInput,
  type VisibilityFilterState,
} from '@azy-board/ui-contracts'

// Card T18 — paridade entre os predicados usados pelo board e o avaliador
// compartilhado. Garante que o conjunto visível do BoardScreen (que agora usa
// populationFilterReasons) coincide com a avaliação de visibilidade.
const baseFilters: VisibilityFilterState = {
  moduleId: '', sprintId: '', assigneeId: '', squadId: '', versionId: '',
  priority: '', status: '', authorId: '', costCenterId: '', types: [], tagIds: [],
}

const items: ItemVisibilityInput[] = [
  { type: 'TASK', status: 'NOT_STARTED', parentId: null, moduleId: 'm1', versionId: 'v1', assigneeId: 'u1', authorId: 'u2', costCenterId: 'c1', priority: 'HIGH', itemSprints: [{ sprintId: 's1' }], tagIds: ['t1'], epicModuleId: 'm1' },
  { type: 'BUG', status: 'DONE', parentId: 'p', moduleId: null, versionId: null, assigneeId: null, authorId: null, costCenterId: null, priority: 'LOW', itemSprints: [], tagIds: [], epicModuleId: null },
]

const filterVariants: VisibilityFilterState[] = [
  baseFilters,
  { ...baseFilters, versionId: 'v1' },
  { ...baseFilters, versionId: EMPTY_FILTER_VALUE },
  { ...baseFilters, sprintId: 's1' },
  { ...baseFilters, sprintId: EMPTY_FILTER_VALUE },
  { ...baseFilters, assigneeId: 'u1' },
  { ...baseFilters, assigneeId: EMPTY_FILTER_VALUE },
  { ...baseFilters, priority: 'HIGH' },
  { ...baseFilters, status: 'DONE' },
  { ...baseFilters, types: ['BUG'] },
  { ...baseFilters, tagIds: ['t1'] },
  { ...baseFilters, moduleId: 'm1' },
]

function passesPredicates(item: ItemVisibilityInput, filters: VisibilityFilterState): boolean {
  if (filters.moduleId && (item.epicModuleId ?? null) !== filters.moduleId) return false
  if (!matchesSprintFilter(item.itemSprints, filters.sprintId)) return false
  if (!matchesScalarFilter(item.versionId, filters.versionId)) return false
  if (!matchesMemberFilter(item.assigneeId, item.assigneeUserId, filters.assigneeId)) return false
  if (!matchesMemberFilter(item.authorId, item.authorUserId, filters.authorId)) return false
  if (!matchesScalarFilter(item.costCenterId, filters.costCenterId)) return false
  if (filters.priority && item.priority !== filters.priority) return false
  if (filters.status && item.status !== filters.status) return false
  if (filters.types.length > 0 && !filters.types.includes(item.type)) return false
  if (filters.tagIds.length > 0 && !(item.tagIds ?? []).some(tagId => filters.tagIds.includes(tagId))) return false
  return true
}

describe('paridade board × avaliador', () => {
  for (const [index, filters] of filterVariants.entries()) {
    test(`variante de filtro ${index}`, () => {
      for (const item of items) {
        const byReasons = populationFilterReasons(item, filters).length === 0
        expect(byReasons).toBe(passesPredicates(item, filters))
      }
    })
  }
})
