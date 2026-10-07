import { describe, expect, test } from 'bun:test'
import type { BoardFilterState } from '../../../components/BoardFilters'
import { DEFAULT_FILTERS } from './types'
import type { ItemData } from './types'
import {
  buildEpicGroups,
  groupEpicsByModule,
  selectBoardCards,
  selectOrphanCards,
  selectStoryVirtualCards,
} from './boardView'

const storyPath = (epicId: string, storyId: string) =>
  JSON.stringify([{ id: epicId, title: 'Épico', type: 'EPIC' }, { id: storyId, title: 'História', type: 'STORY' }])
const epicPath = (epicId: string) => JSON.stringify([{ id: epicId, title: 'Épico', type: 'EPIC' }])

function item(partial: Partial<ItemData> & Pick<ItemData, 'id' | 'type' | 'title'>): ItemData {
  return { status: 'NOT_STARTED', priority: 'MEDIUM', ancestryPath: '[]', isLeaf: true, columnId: 'col-1', ...partial }
}

const filters = (overrides: Partial<BoardFilterState> = {}): BoardFilterState => ({ ...DEFAULT_FILTERS, ...overrides })

const baseInput = {
  columns: [{ id: 'col-1' }],
  squadMembersMap: new Map<string, Set<string>>(),
  isSimpleBoard: false,
}

describe('boardView — Leaf Rule e população', () => {
  const epic = item({ id: 'epic-1', type: 'EPIC', title: 'Épico', ancestryPath: '[]' })
  const story = item({ id: 'story-1', type: 'STORY', title: 'História', ancestryPath: epicPath('epic-1'), parentId: 'epic-1' })
  const task = item({ id: 'task-1', type: 'TASK', title: 'Tarefa', ancestryPath: storyPath('epic-1', 'story-1'), parentId: 'story-1' })
  const subtask = item({ id: 'sub-1', type: 'TASK', title: 'Subtarefa', ancestryPath: storyPath('epic-1', 'story-1'), parentId: 'task-1' })
  const allItems = [epic, story, task, subtask]
  const storyIdSet = new Set(['story-1'])

  test('sem subtasks mostra só TASK/BUG de primeiro nível', () => {
    const cards = selectBoardCards({ ...baseInput, allItems, filters: filters(), epics: [epic], stories: [story], storyIdSet })
    expect(cards.map(card => card.id)).toEqual(['task-1'])
  })

  test('com Leaf Rule mostra só TASK/BUG sem filhos', () => {
    const cards = selectBoardCards({ ...baseInput, allItems, filters: filters({ showSubtasks: true }), epics: [epic], stories: [story], storyIdSet })
    expect(cards.map(card => card.id)).toEqual(['sub-1'])
  })

  test('histórias folha viram cards arrastáveis quando "cards" ativo', () => {
    const leaf = item({ id: 'story-leaf', type: 'STORY', title: 'Folha', ancestryPath: epicPath('epic-1'), parentId: 'epic-1', isLeaf: true })
    const cards = selectBoardCards({
      ...baseInput, allItems: [epic, leaf], filters: filters({ storyDisplay: 'cards' }),
      epics: [epic], stories: [leaf], storyIdSet: new Set(['story-leaf']),
    })
    expect(cards.map(card => card.id)).toEqual(['story-leaf'])
    expect(cards[0]!.columnId).toBe('col-1')
  })

  test('cards virtuais só existem para histórias não-folha em modo cards', () => {
    const nonLeaf = item({ id: 'story-2', type: 'STORY', title: 'Não folha', isLeaf: false })
    expect(selectStoryVirtualCards([nonLeaf], filters({ storyDisplay: 'cards' }), [{ id: 'col-1' }]).map(card => card.id))
      .toEqual(['story-virtual-story-2'])
    expect(selectStoryVirtualCards([nonLeaf], filters({ storyDisplay: 'lanes' }), [{ id: 'col-1' }])).toEqual([])
  })
})

describe('boardView — agrupamento', () => {
  const epic = item({ id: 'epic-1', type: 'EPIC', title: 'Épico', moduleId: 'module-1' })
  const story = item({ id: 'story-1', type: 'STORY', title: 'História', parentId: 'epic-1', ancestryPath: epicPath('epic-1') })
  const task = item({ id: 'task-1', type: 'TASK', title: 'Tarefa', ancestryPath: storyPath('epic-1', 'story-1') })
  const loose = item({ id: 'task-2', type: 'TASK', title: 'Avulsa', ancestryPath: epicPath('epic-1') })

  test('agrupa EPIC → STORY → CARD e cria "Sem história"', () => {
    const groups = buildEpicGroups({
      epics: [epic], stories: [story], allDisplayed: [task, loose], filters: filters(), noStoryLabel: 'Sem história',
    })
    expect(groups).toHaveLength(1)
    expect(groups[0]!.storyGroups.map(group => group.id)).toEqual(['story-1', 'no-story-epic-1'])
    expect(groups[0]!.storyGroups[0]!.tasks.map(card => card.id)).toEqual(['task-1'])
  })

  test('agrupa por módulo ordenando por posição e rotulando sem módulo', () => {
    const noModuleEpic = item({ id: 'epic-2', type: 'EPIC', title: 'Sem módulo' })
    const epicGroups = buildEpicGroups({
      epics: [epic, noModuleEpic], stories: [], allDisplayed: [task], filters: filters(), noStoryLabel: 'Sem história',
    })
    const modules = [{ id: 'module-1', name: 'Pagamentos', position: 1 }]
    const result = groupEpicsByModule({ epicGroups, modules, isSimpleBoard: false, noModuleLabel: 'Sem módulo' })
    expect(result.map(group => group.module.id)).toEqual(['module-1', '__no-module__'])
    expect(result[1]!.module.name).toBe('Sem módulo')
  })

  test('orphan cards excluem tasks de épico e cards virtuais', () => {
    const orphan = item({ id: 'orphan-1', type: 'TASK', title: 'Órfã', ancestryPath: '[]' })
    const virtual = item({ id: 'story-virtual-x', type: 'TASK', title: 'Virtual', ancestryPath: '[]' })
    expect(selectOrphanCards([orphan, virtual, task]).map(card => card.id)).toEqual(['orphan-1'])
  })
})
