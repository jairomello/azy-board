// Controller puro de filtros/população do board (T-card de modularização).
//
// Extrai de `BoardScreen` a seleção de cards visíveis, os cards virtuais de
// histórias, o agrupamento EPIC → STORY → CARD e o agrupamento por módulo. Sem
// HTTP e sem estado: a tela só compõe o resultado. Preserva a Leaf Rule, os
// filtros por projeto e a fonte única de motivos de visibilidade (T18).
import { populationFilterReasons, type ItemVisibilityInput, type VisibilityFilterState } from '@azy-board/ui-contracts'
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

export interface BoardPopulationInput {
  allItems: ItemData[]
  filters: BoardFilterState
  columns: Array<{ id: string }>
  epics: ItemData[]
  stories: ItemData[]
  storyIdSet: Set<string>
  squadMembersMap: Map<string, Set<string>>
  isSimpleBoard: boolean
}

export interface EpicGroup {
  epic: ItemData
  tasks: ItemData[]
  storyGroups: StoryLaneGroup[]
}

// Cards visíveis: primeiro nível (pai é STORY ou órfão) ou Leaf Rule quando
// `showSubtasks`, sempre passando pelos motivos de visibilidade compartilhados
// com o avaliador de escopo do agente.
export function selectBoardCards(input: BoardPopulationInput): ItemData[] {
  const { allItems, filters, columns, epics, stories, storyIdSet, squadMembersMap, isSimpleBoard } = input

  let result: ItemData[]
  if (filters.showSubtasks) {
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

  // Histórias folha aparecem como cards arrastáveis quando "Histórias no board" ativo.
  if (!isSimpleBoard && filters.storyDisplay === 'cards' && columns.length > 0) {
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
    if (filters.status) leafStories = leafStories.filter(story => story.status === filters.status)
    if (filters.authorId) leafStories = leafStories.filter(story => matchesMemberFilter(story.authorId, story.author?.id, filters.authorId))
    if (filters.costCenterId) leafStories = leafStories.filter(story => matchesScalarFilter(story.costCenterId, filters.costCenterId))
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
): ItemData[] {
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
}

// Agrupa por EPIC. No modo de lanes, cada grupo contém as histórias do épico e
// seus cards visíveis, formando EPIC → STORY → CARD.
export function buildEpicGroups(input: EpicGroupsInput): EpicGroup[] {
  const { epics, stories, allDisplayed, filters, noStoryLabel } = input
  const hideEmpty = filters.hideEmptyEpics || !!filters.squadId
  return epics
    .map(epic => {
      const epicCards = allDisplayed.filter(item => getEpicIdFromPath(item.ancestryPath) === epic.id)
      const storyGroups: StoryLaneGroup[] = filters.storyDisplay === 'lanes'
        ? stories
            .filter(story => story.parentId === epic.id || getEpicIdFromPath(story.ancestryPath) === epic.id)
            .map(story => ({
              id: story.id,
              title: story.title,
              story,
              tasks: epicCards.filter(card => getStoryIdFromPath(card.ancestryPath) === story.id),
            }))
            .filter(group => !filters.hideEmptyStories || group.tasks.length > 0)
        : []

      if (filters.storyDisplay === 'lanes') {
        const cardsWithoutStory = epicCards.filter(card => !getStoryIdFromPath(card.ancestryPath))
        if (cardsWithoutStory.length > 0) {
          storyGroups.push({ id: `no-story-${epic.id}`, title: noStoryLabel, story: undefined, tasks: cardsWithoutStory })
        }
      }

      return { epic, tasks: epicCards, storyGroups }
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

export function selectOrphanCards(allDisplayed: ItemData[]): ItemData[] {
  return allDisplayed.filter(item =>
    ['TASK', 'BUG'].includes(item.type) && !getEpicIdFromPath(item.ancestryPath) && !item.id.startsWith('story-virtual-'),
  )
}
