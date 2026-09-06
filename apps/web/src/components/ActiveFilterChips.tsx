import { X } from 'lucide-react'
import type { Tag } from './TagSelector'
import type { BoardFilterState } from './BoardFilters'

export type ActiveFilterKey =
  | 'moduleId' | 'sprintId' | 'versionId' | 'squadId' | 'assigneeId' | 'authorId'
  | 'costCenterId' | 'priority' | 'status' | 'types' | 'tagIds'
  | 'hideEmptyEpics' | 'hideEmptyStories' | 'showSubtasks' | 'storyDisplay' | 'moduleViewMode'

export interface ActiveFilter {
  key: ActiveFilterKey
  value?: string
  filterLabel: string
  valueLabel: string
}

interface NamedOption { id: string; name: string }
interface CostCenter { id: string; code: string; description?: string | null }

export interface ActiveFilterCatalogs {
  modules: NamedOption[]
  sprints: NamedOption[]
  versions: NamedOption[]
  squads: NamedOption[]
  members: Array<{ userId: string; name: string }>
  tags: Tag[]
  costCenters: CostCenter[]
}

export interface ActiveFilterLabels {
  filterLabel: string
  module: string; sprint: string; version: string; squad: string; assignee: string; author: string
  costCenter: string; priority: string; status: string; type: string; tag: string
  hideEmptyEpics: string; hideEmptyStories: string; showSubtasks: string; storyDisplay: string; moduleViewMode: string
  typeValues: Record<string, string>; priorityValues: Record<string, string>; statusValues: Record<string, string>
  storyDisplayCards: string; moduleViewTabs: string; enabled: string; remove: string
}

export interface ActiveFilterVisualContext {
  isSimpleBoard?: boolean
  view?: 'kanban' | 'tree'
}

const shortId = (id: string) => id.length > 12 ? `${id.slice(0, 8)}...` : id
const catalogName = (options: NamedOption[], id: string) => options.find(option => option.id === id)?.name ?? shortId(id)
const memberName = (members: ActiveFilterCatalogs['members'], id: string) => members.find(member => member.userId === id)?.name ?? shortId(id)

export function normalizeActiveBoardFilters(filters: BoardFilterState, catalogs: ActiveFilterCatalogs, labels: ActiveFilterLabels, context: ActiveFilterVisualContext = {}): ActiveFilter[] {
  const result: ActiveFilter[] = []
  const add = (key: ActiveFilterKey, value: string | undefined, filterLabel: string, valueLabel: string) => {
    if (value) result.push({ key, value, filterLabel, valueLabel })
  }
  add('moduleId', filters.moduleId, labels.module, catalogName(catalogs.modules, filters.moduleId))
  add('sprintId', filters.sprintId, labels.sprint, catalogName(catalogs.sprints, filters.sprintId))
  add('versionId', filters.versionId, labels.version, catalogName(catalogs.versions, filters.versionId))
  add('squadId', filters.squadId, labels.squad, catalogName(catalogs.squads, filters.squadId))
  add('assigneeId', filters.assigneeId, labels.assignee, memberName(catalogs.members, filters.assigneeId))
  add('authorId', filters.authorId, labels.author, memberName(catalogs.members, filters.authorId))
  add('costCenterId', filters.costCenterId, labels.costCenter, (() => {
    const center = catalogs.costCenters.find(item => item.id === filters.costCenterId)
    return center ? `${center.code}${center.description ? ` - ${center.description}` : ''}` : shortId(filters.costCenterId)
  })())
  add('priority', filters.priority, labels.priority, labels.priorityValues[filters.priority] ?? shortId(filters.priority))
  add('status', filters.status, labels.status, labels.statusValues[filters.status] ?? shortId(filters.status))
  for (const type of filters.types) add('types', type, labels.type, labels.typeValues[type] ?? shortId(type))
  for (const tagId of filters.tagIds) add('tagIds', tagId, labels.tag, catalogs.tags.find(tag => tag.id === tagId)?.name ?? shortId(tagId))
  if (filters.hideEmptyEpics) add('hideEmptyEpics', 'true', labels.hideEmptyEpics, labels.enabled)
  if (filters.hideEmptyStories && filters.storyDisplay === 'lanes' && context.view !== 'tree') add('hideEmptyStories', 'true', labels.hideEmptyStories, labels.enabled)
  if (filters.showSubtasks && context.view !== 'tree') add('showSubtasks', 'true', labels.showSubtasks, labels.enabled)
  if (filters.storyDisplay === 'cards' && !context.isSimpleBoard && context.view !== 'tree') add('storyDisplay', 'cards', labels.storyDisplay, labels.storyDisplayCards)
  if (filters.moduleViewMode === 'tabs' && !context.isSimpleBoard && context.view !== 'tree') add('moduleViewMode', 'tabs', labels.moduleViewMode, labels.moduleViewTabs)
  return result
}

export function removeActiveBoardFilter(filters: BoardFilterState, key: ActiveFilterKey, value?: string): BoardFilterState {
  if (key === 'types' || key === 'tagIds') return { ...filters, [key]: filters[key].filter(item => item !== value) }
  if (key === 'hideEmptyEpics' || key === 'hideEmptyStories' || key === 'showSubtasks') return { ...filters, [key]: false }
  if (key === 'storyDisplay') return { ...filters, storyDisplay: 'lanes' }
  if (key === 'moduleViewMode') return { ...filters, moduleViewMode: 'hierarchy' }
  return { ...filters, [key]: '' }
}

interface Props {
  filters: BoardFilterState
  catalogs: ActiveFilterCatalogs
  labels: ActiveFilterLabels
  visualContext?: ActiveFilterVisualContext
  onRemove: (key: ActiveFilterKey, value?: string) => void
}

export function ActiveFilterChips({ filters, catalogs, labels, visualContext, onRemove }: Props) {
  const activeFilters = normalizeActiveBoardFilters(filters, catalogs, labels, visualContext)
  if (activeFilters.length === 0) return null
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-xl border border-border/70 bg-surface/70 px-3 py-2" aria-label={labels.filterLabel} role="list">
      {activeFilters.map(filter => {
        const accessibleLabel = `${labels.remove}: ${filter.filterLabel} ${filter.valueLabel}`
        return (
          <span key={`${filter.key}-${filter.value}`} role="listitem" className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/25 bg-primary/10 py-0.5 pl-2 pr-0.5 text-[11px] text-foreground">
            <span className="max-w-[min(14rem,60vw)] truncate" title={`${filter.filterLabel}: ${filter.valueLabel}`}>
              <span className="font-semibold">{filter.filterLabel}:</span> {filter.valueLabel}
            </span>
            <button type="button" aria-label={accessibleLabel} title={accessibleLabel} onClick={() => onRemove(filter.key, filter.value)} className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1">
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        )
      })}
    </div>
  )
}
