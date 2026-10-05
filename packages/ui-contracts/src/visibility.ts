// Card T18 — avaliador compartilhado de visibilidade do board.
//
// Fonte única usada pela interface e pelo agente para explicar por que um card
// não aparece. NUNCA infere exclusão apenas pela ausência na lista: cada motivo
// é comprovado a partir do item e do estado de visão.
import type { ItemType, Priority, TaskStatus } from '@azy-board/domain'

// Sentinela de valor vazio do estado de filtros da interface. Distinto de ''
// (sem filtro). Espelha features/board/model/types (EMPTY_FILTER_VALUE).
export const EMPTY_FILTER_VALUE = '__empty__'

export function isEmptyFilterValue(value: string): boolean {
  return value === EMPTY_FILTER_VALUE
}

// Predicados de filtro para campos escalares anuláveis. '' (estado neutro) não
// filtra; o sentinela seleciona apenas itens sem valor; qualquer outro valor
// exige correspondência exata.
export function matchesScalarFilter(itemValue: string | null | undefined, filterValue: string): boolean {
  if (!filterValue) return true
  if (isEmptyFilterValue(filterValue)) return !itemValue
  return itemValue === filterValue
}

export function matchesMemberFilter(
  itemId: string | null | undefined,
  nestedId: string | null | undefined,
  filterValue: string,
): boolean {
  if (!filterValue) return true
  if (isEmptyFilterValue(filterValue)) return !itemId && !nestedId
  return itemId === filterValue || nestedId === filterValue
}

export function matchesSprintFilter(itemSprints: Array<{ sprintId: string }> | undefined, filterValue: string): boolean {
  if (!filterValue) return true
  if (isEmptyFilterValue(filterValue)) return !itemSprints?.length
  return Boolean(itemSprints?.some(sprint => sprint.sprintId === filterValue))
}

// Filtros de população que recortam o conjunto exibido (espelha BoardFilterState).
export interface VisibilityFilterState {
  moduleId: string
  sprintId: string
  assigneeId: string
  squadId: string
  versionId: string
  priority: string
  status: string
  authorId: string
  costCenterId: string
  types: ItemType[]
  tagIds: string[]
}

export interface AncestorRefLike {
  id: string
  type: string
}

export type ItemVisibilityReason =
  | { code: 'ACCESS_DENIED' }
  | { code: 'ARCHIVED' }
  | { code: 'FILTER'; field: string; value: string }
  | { code: 'MODULE_TAB'; moduleId: string }
  | { code: 'SUBTASK_HIDDEN' }
  | { code: 'EMPTY_GROUP_HIDDEN'; groupId: string; groupKind: 'epic' | 'story' }
  | { code: 'COLLAPSED_GROUP'; groupId: string; groupKind: 'epic' | 'story' | 'module' }
  | { code: 'UNKNOWN' }

export type ItemVisibilityReasonCode = ItemVisibilityReason['code']

// Ordem determinística de apresentação dos motivos.
export const VISIBILITY_REASON_ORDER: Record<ItemVisibilityReasonCode, number> = {
  ACCESS_DENIED: 0,
  ARCHIVED: 1,
  FILTER: 2,
  MODULE_TAB: 3,
  SUBTASK_HIDDEN: 4,
  EMPTY_GROUP_HIDDEN: 5,
  COLLAPSED_GROUP: 6,
  UNKNOWN: 7,
}

export function sortVisibilityReasons(reasons: ItemVisibilityReason[]): ItemVisibilityReason[] {
  return [...reasons].sort((a, b) => VISIBILITY_REASON_ORDER[a.code] - VISIBILITY_REASON_ORDER[b.code])
}

// Atributos do item relevantes para a visibilidade. Resolvidos pelo chamador
// (client ou servidor) a partir do item e seus ancestrais.
export interface ItemVisibilityInput {
  type: ItemType
  status: TaskStatus
  parentId: string | null
  moduleId: string | null
  versionId: string | null
  assigneeId: string | null
  authorId: string | null
  // IDs aninhados (assignee/author resolvidos) quando diferem do campo direto.
  assigneeUserId?: string | null
  authorUserId?: string | null
  costCenterId: string | null
  priority: Priority
  itemSprints?: Array<{ sprintId: string }>
  tagIds?: string[]
  // Ancestrais resolvidos (do ancestryPath).
  epicId?: string | null
  storyId?: string | null
  // Módulo do épico ancestral (filtro de módulo e aba).
  epicModuleId?: string | null
  // O pai imediato é uma STORY? (primeiro nível do board)
  parentIsStory?: boolean
  // Possui filhos? (agregador — não é card móvel na regra de folha)
  hasChildren?: boolean
  // Membros do squad filtrado, quando squadId está ativo.
  squadMemberIds?: string[]
}

export interface ItemVisibilityViewState {
  filters: VisibilityFilterState
  moduleViewMode: 'hierarchy' | 'tabs'
  activeModuleId: string | null
  showSubtasks: boolean
  storyDisplay: 'lanes' | 'cards'
  hideEmptyEpics: boolean
  hideEmptyStories: boolean
  collapsedGroupIds: string[]
  // Grupos que ficaram vazios após os filtros (computados pelo chamador sobre a
  // população completa; um item isolado não consegue determinar sozinho).
  emptyEpicIds?: string[]
  emptyStoryIds?: string[]
  // Sem acesso ao projeto/item: interrompe a explicação.
  accessDenied?: boolean
  // O chamador não dispõe de estado suficiente para determinar o motivo.
  undetermined?: boolean
}

// Motivos de filtro de população que excluem o item (cada filtro ativo que falha).
export function populationFilterReasons(item: ItemVisibilityInput, filters: VisibilityFilterState): ItemVisibilityReason[] {
  const reasons: ItemVisibilityReason[] = []
  if (filters.moduleId && (item.epicModuleId ?? null) !== filters.moduleId) {
    reasons.push({ code: 'FILTER', field: 'moduleId', value: filters.moduleId })
  }
  if (filters.sprintId && !matchesSprintFilter(item.itemSprints, filters.sprintId)) {
    reasons.push({ code: 'FILTER', field: 'sprintId', value: filters.sprintId })
  }
  if (filters.versionId && !matchesScalarFilter(item.versionId, filters.versionId)) {
    reasons.push({ code: 'FILTER', field: 'versionId', value: filters.versionId })
  }
  if (filters.assigneeId && !matchesMemberFilter(item.assigneeId, item.assigneeUserId, filters.assigneeId)) {
    reasons.push({ code: 'FILTER', field: 'assigneeId', value: filters.assigneeId })
  }
  if (filters.authorId && !matchesMemberFilter(item.authorId, item.authorUserId, filters.authorId)) {
    reasons.push({ code: 'FILTER', field: 'authorId', value: filters.authorId })
  }
  if (filters.costCenterId && !matchesScalarFilter(item.costCenterId, filters.costCenterId)) {
    reasons.push({ code: 'FILTER', field: 'costCenterId', value: filters.costCenterId })
  }
  if (filters.priority && item.priority !== filters.priority) {
    reasons.push({ code: 'FILTER', field: 'priority', value: filters.priority })
  }
  if (filters.status && item.status !== filters.status) {
    reasons.push({ code: 'FILTER', field: 'status', value: filters.status })
  }
  if (filters.types.length > 0 && !filters.types.includes(item.type)) {
    reasons.push({ code: 'FILTER', field: 'types', value: filters.types.join(',') })
  }
  if (filters.tagIds.length > 0) {
    const itemTags = item.tagIds ?? []
    if (!itemTags.some(tagId => filters.tagIds.includes(tagId))) {
      reasons.push({ code: 'FILTER', field: 'tagIds', value: filters.tagIds.join(',') })
    }
  }
  if (filters.squadId) {
    const uid = item.assigneeId
    const inSquad = item.squadMemberIds ? (uid != null && item.squadMemberIds.includes(uid)) : false
    if (!inSquad) reasons.push({ code: 'FILTER', field: 'squadId', value: filters.squadId })
  }
  return reasons
}

function hiddenByLeafRule(item: ItemVisibilityInput, view: ItemVisibilityViewState): boolean {
  if (item.type !== 'TASK' && item.type !== 'BUG') return false
  if (view.showSubtasks) {
    // Leaf Rule: apenas itens sem filhos aparecem como cards móveis.
    return Boolean(item.hasChildren)
  }
  // Primeiro nível: TASK/BUG cujo pai imediato é uma STORY (ou sem pai).
  return Boolean(item.parentId) && item.parentIsStory === false
}

export interface ItemVisibilityResult {
  visible: boolean
  reasons: ItemVisibilityReason[]
}

export function evaluateItemVisibility(item: ItemVisibilityInput, view: ItemVisibilityViewState): ItemVisibilityResult {
  const reasons: ItemVisibilityReason[] = []
  if (view.accessDenied) return { visible: false, reasons: [{ code: 'ACCESS_DENIED' }] }
  if (item.status === 'ARCHIVED') reasons.push({ code: 'ARCHIVED' })
  reasons.push(...populationFilterReasons(item, view.filters))

  if (view.moduleViewMode === 'tabs' && view.activeModuleId && (item.epicModuleId ?? null) !== view.activeModuleId) {
    reasons.push({ code: 'MODULE_TAB', moduleId: view.activeModuleId })
  }
  if (hiddenByLeafRule(item, view)) reasons.push({ code: 'SUBTASK_HIDDEN' })

  if (view.hideEmptyEpics && item.epicId && view.emptyEpicIds?.includes(item.epicId)) {
    reasons.push({ code: 'EMPTY_GROUP_HIDDEN', groupId: item.epicId, groupKind: 'epic' })
  }
  if (view.hideEmptyStories && item.storyId && view.emptyStoryIds?.includes(item.storyId)) {
    reasons.push({ code: 'EMPTY_GROUP_HIDDEN', groupId: item.storyId, groupKind: 'story' })
  }

  const collapsed = new Set(view.collapsedGroupIds)
  if (item.epicId && collapsed.has(item.epicId)) {
    reasons.push({ code: 'COLLAPSED_GROUP', groupId: item.epicId, groupKind: 'epic' })
  } else if (item.storyId && collapsed.has(item.storyId)) {
    reasons.push({ code: 'COLLAPSED_GROUP', groupId: item.storyId, groupKind: 'story' })
  } else if (item.moduleId && collapsed.has(item.moduleId)) {
    reasons.push({ code: 'COLLAPSED_GROUP', groupId: item.moduleId, groupKind: 'module' })
  }

  if (view.undetermined) reasons.push({ code: 'UNKNOWN' })

  const sorted = sortVisibilityReasons(reasons)
  return { visible: sorted.length === 0, reasons: sorted }
}

// Extrai os IDs de épico/história do ancestryPath desnormalizado.
export function ancestryRefs(ancestryPath: string | AncestorRefLike[] | null | undefined): { epicId: string | null; storyId: string | null } {
  let nodes: AncestorRefLike[]
  if (Array.isArray(ancestryPath)) nodes = ancestryPath
  else {
    try { nodes = JSON.parse(ancestryPath || '[]') as AncestorRefLike[] } catch { nodes = [] }
  }
  return {
    epicId: nodes.find(node => node.type === 'EPIC')?.id ?? null,
    storyId: nodes.find(node => node.type === 'STORY')?.id ?? null,
  }
}
