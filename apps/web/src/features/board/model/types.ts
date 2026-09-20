import type { AncestorNode, BoardMode, ItemType, TaskStatus } from '@azy-board/types'
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

export interface Column { id: string; name: string; baseStatus: string; position: number }
export interface Module { id: string; name: string; position?: number }
export interface Sprint { id: string; name: string; status: 'PROPOSED' | 'OPEN' | 'CLOSED' }
export interface ProjectContext { name: string; boardMode?: BoardMode; simpleStoryId?: string | null; advancedChecklists?: boolean }

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
  persona?: string | null
  goal?: string | null
  benefit?: string | null
  acceptanceCriteria?: string | null
  notes?: string | null
}

export interface StoryLaneGroup {
  id: string
  title: string
  story?: ItemData
  tasks: ItemData[]
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
