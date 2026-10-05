import { describe, expect, test } from 'bun:test'
import {
  ancestryRefs,
  EMPTY_FILTER_VALUE,
  evaluateItemVisibility,
  isEmptyFilterValue,
  matchesMemberFilter,
  matchesScalarFilter,
  matchesSprintFilter,
  populationFilterReasons,
  sortVisibilityReasons,
  type ItemVisibilityInput,
  type ItemVisibilityViewState,
  type VisibilityFilterState,
} from './visibility.js'

const baseFilters: VisibilityFilterState = {
  moduleId: '', sprintId: '', assigneeId: '', squadId: '', versionId: '',
  priority: '', status: '', authorId: '', costCenterId: '', types: [], tagIds: [],
}

function view(partial: Partial<ItemVisibilityViewState> = {}): ItemVisibilityViewState {
  return {
    filters: { ...baseFilters },
    moduleViewMode: 'hierarchy',
    activeModuleId: null,
    showSubtasks: false,
    storyDisplay: 'lanes',
    hideEmptyEpics: false,
    hideEmptyStories: false,
    collapsedGroupIds: [],
    ...partial,
  }
}

function item(partial: Partial<ItemVisibilityInput> = {}): ItemVisibilityInput {
  return {
    type: 'TASK', status: 'NOT_STARTED', parentId: null, moduleId: null, versionId: null,
    assigneeId: null, authorId: null, costCenterId: null, priority: 'MEDIUM', ...partial,
  }
}

describe('predicados compartilhados de filtro', () => {
  test('sentinela de valor vazio', () => {
    expect(isEmptyFilterValue(EMPTY_FILTER_VALUE)).toBe(true)
    expect(isEmptyFilterValue('')).toBe(false)
  })

  test('escalar, membro e sprint', () => {
    expect(matchesScalarFilter(null, EMPTY_FILTER_VALUE)).toBe(true)
    expect(matchesScalarFilter('v1', EMPTY_FILTER_VALUE)).toBe(false)
    expect(matchesMemberFilter(null, undefined, EMPTY_FILTER_VALUE)).toBe(true)
    expect(matchesSprintFilter([], EMPTY_FILTER_VALUE)).toBe(true)
    expect(matchesSprintFilter([{ sprintId: 's1' }], 's1')).toBe(true)
  })
})

describe('avaliador compartilhado de visibilidade', () => {
  test('item visível sem motivos', () => {
    const result = evaluateItemVisibility(item(), view())
    expect(result.visible).toBe(true)
    expect(result.reasons).toEqual([])
  })

  test('arquivado', () => {
    const result = evaluateItemVisibility(item({ status: 'ARCHIVED' }), view())
    expect(result.visible).toBe(false)
    expect(result.reasons).toEqual([{ code: 'ARCHIVED' }])
  })

  test('excluído por filtro de versão vazia', () => {
    const result = evaluateItemVisibility(item({ versionId: 'v1' }), view({ filters: { ...baseFilters, versionId: EMPTY_FILTER_VALUE } }))
    expect(result.visible).toBe(false)
    expect(result.reasons).toContainEqual({ code: 'FILTER', field: 'versionId', value: EMPTY_FILTER_VALUE })
  })

  test('aba de módulo diferente', () => {
    const result = evaluateItemVisibility(item({ epicModuleId: 'm1' }), view({ moduleViewMode: 'tabs', activeModuleId: 'm2' }))
    expect(result.reasons).toContainEqual({ code: 'MODULE_TAB', moduleId: 'm2' })
  })

  test('subtarefa escondida pela regra de primeiro nível', () => {
    const result = evaluateItemVisibility(item({ parentId: 'p1', parentIsStory: false }), view({ showSubtasks: false }))
    expect(result.reasons).toContainEqual({ code: 'SUBTASK_HIDDEN' })
  })

  test('agregador escondido pela regra de folha', () => {
    const result = evaluateItemVisibility(item({ hasChildren: true }), view({ showSubtasks: true }))
    expect(result.reasons).toContainEqual({ code: 'SUBTASK_HIDDEN' })
  })

  test('grupo vazio oculto', () => {
    const result = evaluateItemVisibility(item({ epicId: 'e1' }), view({ hideEmptyEpics: true, emptyEpicIds: ['e1'] }))
    expect(result.reasons).toContainEqual({ code: 'EMPTY_GROUP_HIDDEN', groupId: 'e1', groupKind: 'epic' })
  })

  test('grupo recolhido', () => {
    const result = evaluateItemVisibility(item({ epicId: 'e1', storyId: 's1' }), view({ collapsedGroupIds: ['e1'] }))
    expect(result.reasons).toContainEqual({ code: 'COLLAPSED_GROUP', groupId: 'e1', groupKind: 'epic' })
  })

  test('sem acesso interrompe a explicação', () => {
    const result = evaluateItemVisibility(item(), view({ accessDenied: true }))
    expect(result.reasons).toEqual([{ code: 'ACCESS_DENIED' }])
  })

  test('indeterminado produz UNKNOWN', () => {
    const result = evaluateItemVisibility(item(), view({ undetermined: true }))
    expect(result.reasons).toEqual([{ code: 'UNKNOWN' }])
  })

  test('ordem determinística dos motivos', () => {
    const result = evaluateItemVisibility(
      item({ status: 'ARCHIVED', versionId: 'v1', epicId: 'e1' }),
      view({ filters: { ...baseFilters, versionId: EMPTY_FILTER_VALUE }, collapsedGroupIds: ['e1'], undetermined: true }),
    )
    expect(result.reasons.map(reason => reason.code)).toEqual(['ARCHIVED', 'FILTER', 'COLLAPSED_GROUP', 'UNKNOWN'])
    expect(sortVisibilityReasons([{ code: 'UNKNOWN' }, { code: 'ARCHIVED' }])[0]!.code).toBe('ARCHIVED')
  })
})

describe('populationFilterReasons', () => {
  test('equivalente aos predicados individuais', () => {
    const filters: VisibilityFilterState = { ...baseFilters, sprintId: EMPTY_FILTER_VALUE, types: ['BUG'], tagIds: ['t1'] }
    const reasons = populationFilterReasons(item({ itemSprints: [{ sprintId: 's1' }], tagIds: [] }), filters)
    expect(reasons).toContainEqual({ code: 'FILTER', field: 'sprintId', value: EMPTY_FILTER_VALUE })
    expect(reasons).toContainEqual({ code: 'FILTER', field: 'types', value: 'BUG' })
    expect(reasons).toContainEqual({ code: 'FILTER', field: 'tagIds', value: 't1' })
  })
})

describe('ancestryRefs', () => {
  test('extrai épico e história', () => {
    const refs = ancestryRefs(JSON.stringify([{ id: 'e1', type: 'EPIC' }, { id: 's1', type: 'STORY' }]))
    expect(refs).toEqual({ epicId: 'e1', storyId: 's1' })
  })
})
