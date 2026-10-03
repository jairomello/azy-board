import type { BoardMode, Column, ItemType, Sprint, TaskStatus } from '@azy-board/domain'
import type { AncestorNode } from '@azy-board/ui-contracts'
import type { BoardFilterState } from '../../../components/BoardFilters'
import type { CardData } from '../../../components/KanbanCard'
import type { CostCenter, ProjectMember, ProjectVersion } from '../../../components/ItemModal'
import type { Tag } from '../../../components/TagSelector'

export const STATUS_LABEL: Partial<Record<TaskStatus, string>> = {
  NOT_STARTED: 'Não iniciada',
  IN_PROGRESS: 'Em andamento',
  BLOCKED: 'Bloqueada',
  DONE: 'Concluída',
  CANCELLED: 'Cancelada',
}

export interface ArchivedItem {
  id: string
  type: ItemType
  title: string
  ancestryPath: string
  statusBeforeArchive: TaskStatus | null
  updatedAt: string
}

export type { Column, Sprint }
export interface Module { id: string; name: string; position?: number }
export interface ProjectContext { name: string; boardMode?: BoardMode; simpleStoryId?: string | null; advancedChecklists?: boolean; icon?: string | null; color?: string | null }

export interface ItemData extends CardData {
  type: ItemType
  columnId: string | null
  parentId?: string | null
  moduleId?: string | null
  description?: string | null
  startDate?: string | null
  dueDate?: string | null
  assigneeId?: string | null
  position?: number
  authorId?: string | null
  versionId?: string | null
  itemSprints?: Array<{ sprintId: string }>
  sprintId?: string | null
  persona?: string | null
  goal?: string | null
  benefit?: string | null
  acceptanceCriteria?: string | null
  notes?: string | null
  updatedAt?: string
}

export interface StoryLaneGroup {
  id: string
  title: string
  story?: ItemData
  tasks: ItemData[]
}

// Sentinela de valor vazio do estado de filtros. Distinto de '' (sem filtro).
// Cobre apenas campos anuláveis (sprint, versão, responsável, autor, centro de custo).
// A comparação é sempre exata pelo helper abaixo; IDs de catálogo são UUIDs e não
// usam o segmento `__`, portanto não colidem com o sentinela.
export const EMPTY_FILTER_VALUE = '__empty__'

export function isEmptyFilterValue(value: string): boolean {
  return value === EMPTY_FILTER_VALUE
}

// Predicados de filtro para campos escalares anuláveis. `''` (estado neutro) não filtra;
// o sentinela seleciona apenas itens sem valor; qualquer outro valor exige correspondência exata.
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

export const DEFAULT_FILTERS: BoardFilterState = {
  moduleId: '',
  sprintId: '',
  assigneeId: '',
  squadId: '',
  types: [],
  tagIds: [],
  versionId: '',
  priority: '',
  status: '',
  authorId: '',
  costCenterId: '',
  hideEmptyEpics: false,
  hideEmptyStories: false,
  showSubtasks: false,
  storyDisplay: 'lanes',
  moduleViewMode: 'hierarchy',
}

export type BoardCatalogs = {
  members: ProjectMember[]
  projectTags: Tag[]
  projectVersions: ProjectVersion[]
  projectCostCenters: CostCenter[]
  projectSquads: Array<{ id: string; name: string }>
}

export function getEpicIdFromPath(ancestryPath: string): string | null {
  try {
    const path: AncestorNode[] = JSON.parse(ancestryPath || '[]')
    return path.find(node => node.type === 'EPIC')?.id ?? null
  } catch { return null }
}

export function getStoryIdFromPath(ancestryPath: string): string | null {
  try {
    const path: AncestorNode[] = JSON.parse(ancestryPath || '[]')
    return path.find(node => node.type === 'STORY')?.id ?? null
  } catch { return null }
}

export function computeIsLeaf(allItems: ItemData[]): ItemData[] {
  const parentIds = new Set(allItems.map(item => item.parentId).filter(Boolean) as string[])
  return allItems.map(item => ({ ...item, isLeaf: !parentIds.has(item.id) }))
}

export function upsertItem(allItems: ItemData[], item: ItemData): ItemData[] {
  return computeIsLeaf([...allItems.filter(existing => existing.id !== item.id), item])
}
