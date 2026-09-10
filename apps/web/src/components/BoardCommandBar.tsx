import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Archive,
  BookOpen,
  Bug,
  CheckSquare,
  ChevronDown,
  Filter,
  Gauge,
  Layers,
  Network,
  Package,
  SlidersHorizontal,
  Plus,
} from 'lucide-react'
import type { BoardMode, ItemType } from '@azy-board/types'
import type { Tag } from './TagSelector'
import { BoardFilters, type BoardFilterState } from './BoardFilters'

interface Option { id: string; name: string }
interface Member { userId: string; name: string }
interface Sprint extends Option { status: 'PROPOSED' | 'OPEN' | 'CLOSED' }
interface CostCenter { id: string; code: string; description?: string | null; sortOrder: number }

interface Props {
  view: 'kanban' | 'tree'
  onViewChange: (view: 'kanban' | 'tree') => void
  density: 'comfortable' | 'compact'
  onDensityChange: (density: 'comfortable' | 'compact') => void
  modules: Option[]
  boardMode: BoardMode
  sprints: Sprint[]
  members: Member[]
  squads: Option[]
  tags: Tag[]
  versions: Option[]
  costCenters: CostCenter[]
  filters: BoardFilterState
  onFiltersChange: (filters: BoardFilterState) => void
  onExpandAll: () => void
  onCollapseAll: () => void
  onOpenArchived: () => void
  onCreate: (type: ItemType | 'MODULE') => void
}

export function BoardCommandBar({
  view,
  onViewChange,
  density,
  onDensityChange,
  modules,
  boardMode,
  sprints,
  members,
  squads,
  tags,
  versions,
  costCenters,
  filters,
  onFiltersChange,
  onExpandAll,
  onCollapseAll,
  onOpenArchived,
  onCreate,
}: Props) {
  const { t } = useTranslation('board')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const createRef = useRef<HTMLDivElement>(null)

  const activeCount = [
    filters.moduleId,
    filters.sprintId,
    filters.assigneeId,
    filters.squadId,
    filters.types.length > 0,
    filters.tagIds.length > 0,
    filters.versionId,
    filters.priority,
    filters.status,
    filters.authorId,
    filters.costCenterId,
    filters.hideEmptyEpics,
    filters.storyDisplay === 'lanes' && filters.hideEmptyStories,
  ].filter(Boolean).length

  useEffect(() => {
    function closeMenus(event: MouseEvent) {
      const target = event.target as Node
      if (filtersRef.current && !filtersRef.current.contains(target)) setFiltersOpen(false)
      if (optionsRef.current && !optionsRef.current.contains(target)) setOptionsOpen(false)
      if (createRef.current && !createRef.current.contains(target)) setCreateOpen(false)
    }
    document.addEventListener('mousedown', closeMenus)
    return () => document.removeEventListener('mousedown', closeMenus)
  }, [])

  function quickUpdate(partial: Partial<BoardFilterState>) {
    onFiltersChange({ ...filters, ...partial })
  }

  const controlClass = 'h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors'

  return (
    <div className="h-[54px] px-2.5 flex items-center gap-2 overflow-visible">
        <div className="flex items-center rounded-lg bg-muted p-1 flex-shrink-0" aria-label={t('display')}>
        <button
          onClick={() => onViewChange('kanban')}
          aria-pressed={view === 'kanban'}
          className={`h-7 px-2.5 rounded-md text-xs font-semibold transition ${
            view === 'kanban' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('viewBoard')}
        </button>
        <button
          onClick={() => onViewChange('tree')}
          aria-pressed={view === 'tree'}
          className={`h-7 px-2.5 rounded-md text-xs font-semibold transition ${
            view === 'tree' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('viewTree')}
        </button>
      </div>

      <div ref={filtersRef} className="relative flex-shrink-0">
        <button
           onClick={() => { setFiltersOpen(open => !open); setOptionsOpen(false) }}
          aria-expanded={filtersOpen}
          className={`${controlClass} flex items-center gap-2 ${activeCount ? 'border-primary/40 text-primary' : ''}`}
        >
          <Filter className="w-3.5 h-3.5" />
             <span className="hidden sm:inline">{t('filtersMenu')}</span>
          {activeCount > 0 && (
            <span className="min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center text-[10px]">
              {activeCount}
            </span>
          )}
        </button>
        {filtersOpen && (
          <div className="absolute left-0 top-full mt-2 z-40 w-[min(720px,calc(100vw-2rem))] rounded-xl border border-border bg-popover shadow-2xl p-4">
             <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{t('filtersMenu')}</p>
                 <p className="text-xs text-muted-foreground">{t('refineDescription')}</p>
              </div>
              {activeCount > 0 && (
                <button
                  onClick={() => onFiltersChange({
                    ...filters,
                    moduleId: '',
                    sprintId: '',
                    assigneeId: '',
                    squadId: '',
                     types: [],
                     tagIds: [],
                     versionId: '', priority: '', status: '', authorId: '',
                     costCenterId: '',
                     hideEmptyEpics: false, hideEmptyStories: false,
                   })}
                  className="text-xs font-medium text-primary hover:underline"
                >
                   {t('clear')} {activeCount}
                </button>
              )}
            </div>
            <BoardFilters
              modules={modules}
              sprints={sprints}
              members={members}
              squads={squads}
               tags={tags}
               versions={versions}
               costCenters={costCenters}
              filters={filters}
              onChange={onFiltersChange}
              showSubtasks={filters.showSubtasks}
              onToggleSubtasks={() => quickUpdate({ showSubtasks: !filters.showSubtasks })}
              storiesAsCards={filters.storyDisplay === 'cards'}
              onToggleStoryDisplay={() => quickUpdate({
                storyDisplay: filters.storyDisplay === 'cards' ? 'lanes' : 'cards',
              })}
               showExpandCollapse={view === 'kanban' && boardMode === 'HIERARCHICAL'}
               showModuleViewMode={view === 'kanban' && boardMode === 'HIERARCHICAL'}
              onExpandAll={onExpandAll}
               onCollapseAll={onCollapseAll}
               section="filters"
             />
           </div>
         )}
       </div>

       {view === 'kanban' && (
         <div ref={optionsRef} className="relative flex-shrink-0">
           <button
             onClick={() => { setOptionsOpen(open => !open); setFiltersOpen(false) }}
             aria-expanded={optionsOpen}
             className={`${controlClass} flex items-center gap-2 ${optionsOpen ? 'border-primary/40 text-primary' : ''}`}
           >
             <SlidersHorizontal className="w-3.5 h-3.5" />
             <span className="hidden sm:inline">{t('optionsMenu')}</span>
           </button>
           {optionsOpen && (
             <div className="absolute left-0 top-full mt-2 z-40 w-[min(720px,calc(100vw-2rem))] rounded-xl border border-border bg-popover shadow-2xl p-4">
               <div className="mb-3">
                 <p className="text-sm font-semibold text-foreground">{t('optionsMenu')}</p>
                 <p className="text-xs text-muted-foreground">{t('optionsDescription')}</p>
               </div>
               <BoardFilters
                 modules={modules}
                 sprints={sprints}
                 members={members}
                 squads={squads}
                  tags={tags}
                   versions={versions}
                   costCenters={costCenters}
                 filters={filters}
                 onChange={onFiltersChange}
                 showSubtasks={filters.showSubtasks}
                 onToggleSubtasks={() => quickUpdate({ showSubtasks: !filters.showSubtasks })}
                 storiesAsCards={filters.storyDisplay === 'cards'}
                 onToggleStoryDisplay={() => quickUpdate({ storyDisplay: filters.storyDisplay === 'cards' ? 'lanes' : 'cards' })}
                  showExpandCollapse={boardMode === 'HIERARCHICAL'}
                  showModuleViewMode={boardMode === 'HIERARCHICAL'}
                 onExpandAll={onExpandAll}
                 onCollapseAll={onCollapseAll}
                 section="options"
               />
             </div>
           )}
         </div>
       )}

      {squads.length > 0 && (
        <label className="hidden xl:flex items-center gap-1.5 flex-shrink-0">
          <Network className="w-3.5 h-3.5 text-muted-foreground" />
          <select
             aria-label={t('filterSquad')}
            value={filters.squadId}
            onChange={event => quickUpdate({ squadId: event.target.value })}
            className={`${controlClass} max-w-36`}
          >
             <option value="">{t('allSquads')}</option>
            {squads.map(squad => <option key={squad.id} value={squad.id}>{squad.name}</option>)}
          </select>
        </label>
      )}

      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onDensityChange(density === 'comfortable' ? 'compact' : 'comfortable')}
           title={`${t('density')}: ${density === 'comfortable' ? t('comfortable') : t('compact')}`}
           aria-label={t('toggleDensity')}
          className={`${controlClass} hidden sm:flex items-center gap-2`}
        >
          <Gauge className="w-3.5 h-3.5" />
           <span className="hidden xl:inline">{density === 'comfortable' ? t('comfortable') : t('compact')}</span>
        </button>
        <button
          onClick={onOpenArchived}
           title={t('archivedItems')}
           aria-label={t('archivedItems')}
          className={`${controlClass} w-9 !px-0 inline-flex items-center justify-center`}
        >
          <Archive className="w-3.5 h-3.5" />
        </button>

        {view === 'kanban' && (
          <div ref={createRef} className="relative">
            <button
              onClick={() => setCreateOpen(open => !open)}
              aria-expanded={createOpen}
              className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-2 hover:bg-primary/90 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
               {t('create')}
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </button>
            {createOpen && (
              <div className="absolute right-0 top-full mt-2 z-40 w-52 rounded-xl border border-border bg-popover shadow-2xl p-1.5">
                {([
                   ['MODULE', t('moduleLabel'), Package, 'text-slate-600 bg-slate-500/10'],
                   ['EPIC', t('typeEpic'), Layers, 'text-amber-600 bg-amber-500/10'],
                   ['STORY', t('typeStory'), BookOpen, 'text-violet-600 bg-violet-500/10'],
                   ['TASK', t('typeTask'), CheckSquare, 'text-blue-600 bg-blue-500/10'],
                   ['BUG', t('typeBug'), Bug, 'text-red-600 bg-red-500/10'],
                ] as const).filter(([type]) => boardMode === 'HIERARCHICAL' || type === 'TASK' || type === 'BUG').map(([type, label, Icon, colors]) => (
                  <button
                    key={type}
                    onClick={() => {
                      setCreateOpen(false)
                      onCreate(type)
                    }}
                    className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition"
                  >
                    <span className={`w-7 h-7 rounded-md flex items-center justify-center ${colors}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
