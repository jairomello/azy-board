import { describe, expect, test } from 'bun:test'
import type { BoardFilterState } from '../../../components/BoardFilters'
import { DEFAULT_FILTERS } from './types'
import type { ItemData } from './types'
import {
  buildEpicGroups,
  groupEpicsByModule,
  selectBoardCards,
  selectOrphanCards,
  selectProgressPopulation,
  selectStoryVirtualCards,
  selectUnifiedCards,
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

describe('boardView — Kanban unificado', () => {
  test('mantém todos os cards do recorte, de épicos diferentes, em uma única lista', () => {
    const taskA = item({ id: 'task-a', type: 'TASK', title: 'A', ancestryPath: storyPath('epic-1', 'story-1'), columnId: 'col-1' })
    const taskB = item({ id: 'task-b', type: 'TASK', title: 'B', ancestryPath: storyPath('epic-2', 'story-2'), columnId: 'col-2' })
    const cards = selectUnifiedCards([taskA, taskB], [{ id: 'col-1' }, { id: 'col-2' }])
    expect(cards.map(card => card.id)).toEqual(['task-a', 'task-b'])
  })

  test('card sem coluna entra na primeira coluna do fluxo', () => {
    const semColuna = item({ id: 'task-sem-coluna', type: 'TASK', title: 'Sem coluna', columnId: null })
    const cards = selectUnifiedCards([semColuna], [{ id: 'col-1' }, { id: 'col-2' }])
    expect(cards[0]?.columnId).toBe('col-1')
  })

  test('sem colunas não inventa destino', () => {
    const semColuna = item({ id: 'task-sem-coluna', type: 'TASK', title: 'Sem coluna', columnId: null })
    expect(selectUnifiedCards([semColuna], [])[0]?.columnId).toBeNull()
  })
})

describe('boardView — filtro de última alteração (T57)', () => {
  const epic = item({ id: 'epic-1', type: 'EPIC', title: 'Épico' })
  const story = item({ id: 'story-1', type: 'STORY', title: 'História', parentId: 'epic-1', ancestryPath: epicPath('epic-1') })
  const recent = item({
    id: 'task-recent', type: 'TASK', title: 'Recente', parentId: 'story-1',
    ancestryPath: storyPath('epic-1', 'story-1'), updatedAt: new Date().toISOString(),
  })
  const old = item({
    id: 'task-old', type: 'TASK', title: 'Antigo', parentId: 'story-1',
    ancestryPath: storyPath('epic-1', 'story-1'), updatedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
  })
  const sprintItem = item({
    id: 'task-sprint', type: 'TASK', title: 'Da sprint', parentId: 'story-1',
    ancestryPath: storyPath('epic-1', 'story-1'), itemSprints: [{ sprintId: 'sprint-current' }],
  })

  const select = (updatedWithin: string, activeSprintId: string | null = null) => selectBoardCards({
    ...baseInput, allItems: [epic, story, recent, old, sprintItem], filters: filters({ updatedWithin }),
    epics: [epic], stories: [story], storyIdSet: new Set(['story-1']), activeSprintId,
  }).map(card => card.id)

  test('janela de semana mantém o recente e remove o antigo', () => {
    const ids = select('1w')
    expect(ids).toContain('task-recent')
    expect(ids).not.toContain('task-old')
  })

  test('janela de mês inclui o antigo', () => {
    expect(select('1m')).toContain('task-old')
  })

  test('current-sprint usa a sprint vigente', () => {
    expect(select('current-sprint', 'sprint-current')).toEqual(['task-sprint'])
    expect(select('current-sprint', null)).toEqual([])
  })
})

// B19 — o progresso do board usa a mesma população da árvore e do dashboard, sem
// mudar os cards exibidos: folhas de qualquer tipo (Leaf Rule), com os mesmos filtros.
describe('boardView — população de progresso (B19)', () => {
  const epic = item({ id: 'epic-1', type: 'EPIC', title: 'Épico', isLeaf: false })
  const emptyEpic = item({ id: 'epic-2', type: 'EPIC', title: 'Épico vazio', isLeaf: true })
  const leafStory = item({ id: 'story-leaf', type: 'STORY', title: 'História sem tarefas', status: 'DONE', ancestryPath: epicPath('epic-1'), parentId: 'epic-1', isLeaf: true })
  const story = item({ id: 'story-1', type: 'STORY', title: 'História', ancestryPath: epicPath('epic-1'), parentId: 'epic-1', isLeaf: false })
  const parentTask = item({ id: 'task-1', type: 'TASK', title: 'Tarefa pai', ancestryPath: storyPath('epic-1', 'story-1'), parentId: 'story-1', isLeaf: false })
  const subtask = item({ id: 'sub-1', type: 'TASK', title: 'Subtarefa', ancestryPath: storyPath('epic-1', 'story-1'), parentId: 'task-1', isLeaf: true })
  const allItems = [epic, emptyEpic, leafStory, story, parentTask, subtask]
  const input = {
    ...baseInput, allItems, epics: [epic, emptyEpic], stories: [leafStory, story], storyIdSet: new Set(['story-leaf', 'story-1']),
  }

  test('inclui subtarefas folha, histórias sem filhos e épicos vazios', () => {
    const population = selectProgressPopulation({ ...input, filters: filters(), onlyModuleFilter: true })
    expect(population.map(card => card.id).sort()).toEqual(['epic-2', 'story-leaf', 'sub-1'])
    // Os cards exibidos continuam os de antes.
    expect(selectBoardCards({ ...input, filters: filters() }).map(card => card.id)).toEqual(['task-1'])
  })

  test('com filtro de população ativo não acrescenta épicos vazios', () => {
    const population = selectProgressPopulation({ ...input, filters: filters({ priority: 'HIGH' }), onlyModuleFilter: false })
    expect(population.some(card => card.id === 'epic-2')).toBe(false)
  })

  test('lanes de épico e de história usam a população de progresso', () => {
    const progressCards = selectProgressPopulation({ ...input, filters: filters({ storyDisplay: 'lanes' }), onlyModuleFilter: true })
    const groups = buildEpicGroups({
      epics: [epic, emptyEpic], stories: [leafStory, story], allDisplayed: [parentTask],
      filters: filters({ storyDisplay: 'lanes' }), noStoryLabel: 'Sem história', progressCards,
    })
    const main = groups.find(group => group.epic.id === 'epic-1')!
    expect(main.progressTasks.map(card => card.id).sort()).toEqual(['story-leaf', 'sub-1'])
    expect(main.storyGroups.find(group => group.id === 'story-leaf')?.progressTasks?.map(card => card.id)).toEqual(['story-leaf'])
    expect(main.storyGroups.find(group => group.id === 'story-1')?.progressTasks?.map(card => card.id)).toEqual(['sub-1'])
    expect(groups.find(group => group.epic.id === 'epic-2')?.progressTasks.map(card => card.id)).toEqual(['epic-2'])
  })
})

// T92 — a busca é um recorte adicional, combinado com os filtros e aplicado
// antes do agrupamento. Subtasks entram mesmo com "Mostrar subtasks" desligado.
describe('boardView — busca de cards (T92)', () => {
  const epic = item({ id: 'epic-1', type: 'EPIC', title: 'Fase 1', isLeaf: false })
  const story = item({ id: 'story-1', type: 'STORY', title: 'Fluxo contínuo', parentId: 'epic-1', ancestryPath: epicPath('epic-1'), isLeaf: false })
  const task = item({
    id: 'task-busca', type: 'TASK', title: 'Busca de cards no board', sequenceCode: 'T92',
    parentId: 'story-1', ancestryPath: storyPath('epic-1', 'story-1'), assigneeId: 'u1',
    assignee: { id: 'u1', name: 'Jairo Silva', avatarUrl: null },
  })
  const other = item({ id: 'task-outro', type: 'TASK', title: 'Ajuste de layout', sequenceCode: 'T93', parentId: 'story-1', ancestryPath: storyPath('epic-1', 'story-1') })
  const subtask = item({ id: 'sub-busca', type: 'TASK', title: 'Busca interna', sequenceCode: 'T94', parentId: 'task-busca', ancestryPath: storyPath('epic-1', 'story-1') })
  const allItems = [epic, story, task, other, subtask]
  const input = { ...baseInput, allItems, epics: [epic], stories: [story], storyIdSet: new Set(['story-1']) }

  test('recorta por título, código e responsável', () => {
    expect(selectBoardCards({ ...input, filters: filters(), searchQuery: 'cards' }).map(card => card.id)).toEqual(['task-busca'])
    expect(selectBoardCards({ ...input, filters: filters(), searchQuery: 'T92' }).map(card => card.id)).toEqual(['task-busca'])
    expect(selectBoardCards({ ...input, filters: filters(), searchQuery: 'jairo' }).map(card => card.id)).toEqual(['task-busca'])
    expect(selectBoardCards({ ...input, filters: filters(), searchQuery: 'busca' }).map(card => card.id).sort()).toEqual(['sub-busca', 'task-busca'])
  })

  test('inclui subtasks mesmo com "Mostrar subtasks" desligado', () => {
    expect(selectBoardCards({ ...input, filters: filters(), searchQuery: 'interna' }).map(card => card.id)).toEqual(['sub-busca'])
  })

  test('combina busca com filtros ativos', () => {
    expect(selectBoardCards({
      ...input, filters: filters({ status: 'DONE' }), searchQuery: 'busca',
    })).toEqual([])
    expect(selectBoardCards({
      ...input, filters: filters({ assigneeId: 'u1' }), searchQuery: 'busca',
    }).map(card => card.id)).toEqual(['task-busca'])
  })

  test('não mistura histórias folha nem cards virtuais na busca', () => {
    const leafStory = item({ id: 'story-leaf', type: 'STORY', title: 'Busca folha', parentId: 'epic-1', ancestryPath: epicPath('epic-1'), isLeaf: true })
    const result = selectBoardCards({
      ...input, allItems: [...allItems, leafStory], filters: filters({ storyDisplay: 'cards' }), searchQuery: 'cards',
    })
    expect(result.map(card => card.id)).toEqual(['task-busca'])
    expect(selectStoryVirtualCards([story], filters({ storyDisplay: 'cards' }), [{ id: 'col-1' }], 'cards')).toEqual([])
  })

  test('agrupamento esconde lanes vazias durante a busca', () => {
    const cards = selectBoardCards({ ...input, filters: filters(), searchQuery: 'cards' })
    const groups = buildEpicGroups({
      epics: [epic], stories: [story], allDisplayed: cards, filters: filters(),
      noStoryLabel: 'Sem história', searchActive: true,
    })
    expect(groups.map(group => group.epic.id)).toEqual(['epic-1'])
    expect(groups[0]!.storyGroups.map(group => group.id)).toEqual(['story-1'])
  })

  test('população de progresso acompanha a busca', () => {
    const population = selectProgressPopulation({ ...input, filters: filters(), onlyModuleFilter: false, searchQuery: 'cards' })
    expect(population.map(card => card.id)).toEqual(['task-busca'])
  })
})
