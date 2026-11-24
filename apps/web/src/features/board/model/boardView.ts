// Controller puro de filtros/população do board (T-card de modularização).
//
// Extrai de `BoardScreen` a seleção de cards visíveis, os cards virtuais de
// histórias, o agrupamento EPIC → STORY → CARD e o agrupamento por módulo. Sem
// HTTP e sem estado: a tela só compõe o resultado. Preserva a Leaf Rule, os
// filtros por projeto e a fonte única de motivos de visibilidade (T18).
import { populationFilterReasons, type ItemVisibilityInput, type VisibilityFilterState } from '@azy-board/ui-contracts'
import { updatedWithinStart, type UpdatedWithin } from '@azy-board/domain'
import type { Tag } from '../../../components/TagSelector'
import type { BoardFilterState } from '../../../components/BoardFilters'
import {
  getEpicIdFromPath,
  getStoryIdFromPath,
  matchesMemberFilter,
  matchesScalarFilter,
  matchesSprintFilter,
  type ItemData,
  type Module,
  type StoryLaneGroup,
} from './types'
import { matchesCardSearch } from './cardSearchMatch'

export interface BoardPopulationInput {
  allItems: ItemData[]
  filters: BoardFilterState
  columns: Array<{ id: string }>
  epics: ItemData[]
  stories: ItemData[]
  storyIdSet: Set<string>
  squadMembersMap: Map<string, Set<string>>
  isSimpleBoard: boolean
  activeSprintId?: string | null
  /** T92 — recorte textual por título, código e responsável. */
  searchQuery?: string
  /** T92 — população do dropdown: todos os TASK/BUG, sem a Leaf Rule de exibição. */
  includeAllTasks?: boolean
}

export interface EpicGroup {
  epic: ItemData
  tasks: ItemData[]
  storyGroups: StoryLaneGroup[]
  /** B19 — folhas de progresso do épico, na mesma população da árvore e do dashboard. */
  progressTasks: ItemData[]
}

// [T57] Recorte por última alteração (dias-calendário no fuso do projeto) ou
// pela sprint vigente (`current-sprint`).
function matchesUpdatedWithin(item: ItemData, updatedWithin: string, activeSprintId: string | null | undefined): boolean {
  if (!updatedWithin) return true
  if (updatedWithin === 'current-sprint') {
    return Boolean(activeSprintId && item.itemSprints?.some(link => link.sprintId === activeSprintId))
  }
  const boundary = updatedWithinStart(updatedWithin as Exclude<UpdatedWithin, 'current-sprint'>, new Date())
  return (item.updatedAt ?? '') >= boundary
}

// Cards visíveis: primeiro nível (pai é STORY ou órfão) ou Leaf Rule quando
// `showSubtasks`, sempre passando pelos motivos de visibilidade compartilhados
// com o avaliador de escopo do agente.
export function selectBoardCards(input: BoardPopulationInput): ItemData[] {
  const { allItems, filters, columns, epics, stories, storyIdSet, squadMembersMap, isSimpleBoard, activeSprintId, searchQuery, includeAllTasks = false } = input
  const searchActive = Boolean(searchQuery?.trim())

  let result: ItemData[]
  if (searchActive || includeAllTasks) {
    // Durante a busca o recorte é todos os TASK/BUG, pais e folhas: o card
    // procurado pode ser uma subtask, e um pai que casa não pode sumir só por
    // ter filhos. A Leaf Rule/preferência de exibição voltam ao limpar a busca.
    result = allItems.filter(item => ['TASK', 'BUG'].includes(item.type))
  } else if (filters.showSubtasks) {
    // Leaf Rule: TASK/BUG que não são pai de nenhum outro item.
    const parentIdSet = new Set(allItems.map(item => item.parentId).filter(Boolean) as string[])
    result = allItems.filter(item => ['TASK', 'BUG'].includes(item.type) && !parentIdSet.has(item.id))
  } else {
    // Primeiro nível: TASK/BUG cujo pai imediato é uma STORY (ou sem pai = órfão).
    result = allItems.filter(item =>
      ['TASK', 'BUG'].includes(item.type) &&
      (!item.parentId || storyIdSet.has(item.parentId)),
    )
  }

  // Fonte única dos motivos de exclusão (mesma lógica do board).
  const epicModuleById = new Map(epics.map(epic => [epic.id, epic.moduleId ?? null]))
  const visibilityFilters: VisibilityFilterState = {
    moduleId: filters.moduleId, sprintId: filters.sprintId, assigneeId: filters.assigneeId,
    squadId: filters.squadId, versionId: filters.versionId, priority: filters.priority,
    status: filters.status, authorId: filters.authorId, costCenterId: filters.costCenterId,
    types: filters.types, tagIds: filters.tagIds,
  }
  const toVisibilityInput = (item: ItemData): ItemVisibilityInput => ({
    type: item.type, status: item.status, parentId: item.parentId ?? null,
    moduleId: item.moduleId ?? null, versionId: item.versionId ?? null,
    assigneeId: item.assigneeId ?? null, assigneeUserId: item.assignee?.id ?? null,
    authorId: item.authorId ?? null, authorUserId: item.author?.id ?? null,
    costCenterId: item.costCenterId ?? null, priority: item.priority,
    itemSprints: item.itemSprints, tagIds: (item.itemTags ?? item.taskTags ?? []).map(it => it.tag.id),
    epicModuleId: epicModuleById.get(getEpicIdFromPath(item.ancestryPath) ?? '') ?? null,
    squadMemberIds: filters.squadId ? [...(squadMembersMap.get(filters.squadId) ?? [])] : undefined,
  })
  result = result.filter(item => populationFilterReasons(toVisibilityInput(item), visibilityFilters).length === 0)
  result = result.filter(item => matchesUpdatedWithin(item, filters.updatedWithin, activeSprintId))
  if (searchActive) result = result.filter(item => matchesCardSearch(item, searchQuery!))

  // Histórias folha aparecem como cards arrastáveis quando "Histórias no board" ativo.
  // Durante a busca o recorte é só de TASK/BUG: histórias são agrupadores, não cards.
  if (!searchActive && !isSimpleBoard && filters.storyDisplay === 'cards' && columns.length > 0) {
    const firstColId = columns[0]!.id
    let leafStories = stories
      .filter(story => story.isLeaf)
      .map(story => ({ ...story, columnId: story.columnId ?? firstColId }))
    if (filters.moduleId) {
      const epicIds = new Set(epics.filter(epic => epic.moduleId === filters.moduleId).map(epic => epic.id))
      leafStories = leafStories.filter(story => {
        const epicId = getEpicIdFromPath(story.ancestryPath)
        return epicId ? epicIds.has(epicId) : false
      })
    }
    if (filters.assigneeId) {
      leafStories = leafStories.filter(story => matchesMemberFilter(story.assigneeId, story.assignee?.id, filters.assigneeId))
    }
    if (filters.squadId) {
      const squadUsers = squadMembersMap.get(filters.squadId)
      leafStories = leafStories.filter(story => {
        const uid = story.assigneeId ?? story.assignee?.id
        return uid != null && squadUsers?.has(uid)
      })
    }
    if (filters.tagIds.length > 0) {
      leafStories = leafStories.filter(story =>
        (story.itemTags ?? story.taskTags ?? []).some((it: { tag: Tag }) => filters.tagIds.includes(it.tag.id)),
      )
    }
    if (filters.sprintId) leafStories = leafStories.filter(story => matchesSprintFilter(story.itemSprints, filters.sprintId))
    if (filters.versionId) leafStories = leafStories.filter(story => matchesScalarFilter(story.versionId, filters.versionId))
    if (filters.priority) leafStories = leafStories.filter(story => story.priority === filters.priority)
    if (filters.status) {
      const statuses = filters.status.split(',').map(status => status.trim()).filter(Boolean)
      leafStories = leafStories.filter(story => statuses.includes(story.status))
    }
    if (filters.authorId) leafStories = leafStories.filter(story => matchesMemberFilter(story.authorId, story.author?.id, filters.authorId))
    if (filters.costCenterId) leafStories = leafStories.filter(story => matchesScalarFilter(story.costCenterId, filters.costCenterId))
    leafStories = leafStories.filter(story => matchesUpdatedWithin(story, filters.updatedWithin, activeSprintId))
    result = [...result, ...leafStories]
  }

  return result
}

// Cards virtuais de histórias NÃO-folha quando o toggle "Mostrar histórias" está
// ativo; histórias folha aparecem como cards reais em `selectBoardCards`.
export function selectStoryVirtualCards(
  stories: ItemData[],
  filters: BoardFilterState,
  columns: Array<{ id: string }>,
  searchQuery = '',
): ItemData[] {
  if (searchQuery.trim()) return []
  if (filters.storyDisplay !== 'cards' || columns.length === 0) return []
  const firstColId = columns[0]!.id
  return stories
    .filter(story => !story.isLeaf)
    .map(story => ({ ...story, id: `story-virtual-${story.id}`, columnId: firstColId, isLeaf: false }))
}

export interface EpicGroupsInput {
  epics: ItemData[]
  stories: ItemData[]
  allDisplayed: ItemData[]
  filters: BoardFilterState
  noStoryLabel: string
  /** B19 — população de progresso (`selectProgressPopulation`); sem ela, usa os cards exibidos. */
  progressCards?: ItemData[]
  /** T92 — durante a busca, lanes sem card encontrado não aparecem. */
  searchActive?: boolean
}

// Agrupa por EPIC. No modo de lanes, cada grupo contém as histórias do épico e
// seus cards visíveis, formando EPIC → STORY → CARD.
export function buildEpicGroups(input: EpicGroupsInput): EpicGroup[] {
  const { epics, stories, allDisplayed, filters, noStoryLabel, searchActive = false } = input
  const hideEmpty = filters.hideEmptyEpics || !!filters.squadId || searchActive
  const progressSource = (input.progressCards ?? allDisplayed).filter(item => !item.id.startsWith('story-virtual-'))
  return epics
    .map(epic => {
      const epicCards = allDisplayed.filter(item => getEpicIdFromPath(item.ancestryPath) === epic.id)
      const epicProgress = epic.isLeaf && input.progressCards?.some(item => item.id === epic.id)
        ? [epic]
        : progressSource.filter(item => item.id !== epic.id && getEpicIdFromPath(item.ancestryPath) === epic.id)
      const storyGroups: StoryLaneGroup[] = filters.storyDisplay === 'lanes'
        ? stories
            .filter(story => story.parentId === epic.id || getEpicIdFromPath(story.ancestryPath) === epic.id)
            .map(story => ({
              id: story.id,
              title: story.title,
              story,
              tasks: epicCards.filter(card => getStoryIdFromPath(card.ancestryPath) === story.id),
              progressTasks: epicProgress.filter(item => item.id === story.id || getStoryIdFromPath(item.ancestryPath) === story.id),
            }))
            .filter(group => !(filters.hideEmptyStories || searchActive) || group.tasks.length > 0)
        : []

      if (filters.storyDisplay === 'lanes') {
        const cardsWithoutStory = epicCards.filter(card => !getStoryIdFromPath(card.ancestryPath))
        if (cardsWithoutStory.length > 0) {
          storyGroups.push({
            id: `no-story-${epic.id}`, title: noStoryLabel, story: undefined, tasks: cardsWithoutStory,
            progressTasks: epicProgress.filter(item => item.type !== 'STORY' && !getStoryIdFromPath(item.ancestryPath)),
          })
        }
      }

      return { epic, tasks: epicCards, storyGroups, progressTasks: epicProgress }
    })
    .filter(group => !hideEmpty || group.tasks.length > 0)
}

export interface ModuleGroupsInput {
  epicGroups: EpicGroup[]
  modules: Module[]
  isSimpleBoard: boolean
  noModuleLabel: string
}

export function groupEpicsByModule(input: ModuleGroupsInput): Array<{ module: Module; epics: EpicGroup[] }> {
  const { epicGroups, modules, isSimpleBoard, noModuleLabel } = input
  if (isSimpleBoard) return []
  const groups = new Map<string, { module: Module; epics: EpicGroup[] }>()
  for (const group of epicGroups) {
    const moduleId = group.epic.moduleId ?? '__no-module__'
    const module = modules.find(item => item.id === moduleId) ?? { id: moduleId, name: noModuleLabel, position: Number.MAX_SAFE_INTEGER }
    const existing = groups.get(moduleId)
    if (existing) existing.epics.push(group)
    else groups.set(moduleId, { module, epics: [group] })
  }
  return [...groups.values()].sort((a, b) => (a.module.position ?? Number.MAX_SAFE_INTEGER) - (b.module.position ?? Number.MAX_SAFE_INTEGER))
}

/**
 * B19 — população de progresso do board: as folhas de progresso (Leaf Rule, incluindo
 * histórias sem filhos) com os mesmos filtros dos cards, mais os épicos sem filhos quando
 * nenhum filtro além de módulo está ativo — o mesmo recorte da árvore e do dashboard.
 * Não altera os cards exibidos; só alimenta percentuais e contagens.
 */
export function selectProgressPopulation(input: BoardPopulationInput & { onlyModuleFilter: boolean }): ItemData[] {
  const leaves = selectBoardCards({ ...input, filters: { ...input.filters, showSubtasks: true, storyDisplay: 'cards' } })
    .filter(item => item.isLeaf !== false && !item.id.startsWith('story-virtual-'))
  if (input.isSimpleBoard || !input.onlyModuleFilter) return leaves
  const leafEpics = input.epics.filter(epic => epic.isLeaf && (!input.filters.moduleId || epic.moduleId === input.filters.moduleId))
  return [...leaves, ...leafEpics]
}

export function selectOrphanCards(allDisplayed: ItemData[]): ItemData[] {
  return allDisplayed.filter(item =>
    ['TASK', 'BUG'].includes(item.type) && !getEpicIdFromPath(item.ancestryPath) && !item.id.startsWith('story-virtual-'),
  )
}

/**
 * Cards do Kanban unificado: todo o recorte em uma única faixa de colunas.
 *
 * Cards sem coluna (histórias virtuais e itens recém-criados) entram na primeira
 * coluna do fluxo, senão desapareceriam do quadro — no layout em lanes eles
 * apareciam pela lane, que aqui não existe.
 */
export function selectUnifiedCards(cards: ItemData[], columns: Array<{ id: string }>): ItemData[] {
  const firstColumnId = columns[0]?.id
  if (!firstColumnId) return cards
  return cards.map(card => (card.columnId ? card : { ...card, columnId: firstColumnId }))
}
