import { BookOpen, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ItemType } from '@azy-board/domain'
import { ModuleSwimlane } from '../../../components/ModuleSwimlane'
import { BoardColumns } from './BoardColumns'
import type { ProjectVersion } from '../../../components/ItemModal'
import type { Column, ItemData, Module, Sprint, StoryLaneGroup } from '../model/types'

export interface EpicLaneGroup {
  epic: ItemData
  tasks: ItemData[]
  storyGroups: StoryLaneGroup[]
}

interface BoardLanesProps {
  simpleBoard: boolean
  simpleStory?: ItemData
  simpleCards: ItemData[]
  showStoryLanes: boolean
  orphanCards: ItemData[]
  moduleGroups: Array<{ module: Module; epics: EpicLaneGroup[] }>
  visibleModuleGroups: Array<{ module: Module; epics: EpicLaneGroup[] }>
  columns: Column[]
  versions: ProjectVersion[]
  sprints: Sprint[]
  collapsedEpics: Set<string>
  collapsedModules: Set<string>
  collapsedStories: Set<string>
  columnAddForms: Record<string, boolean>
  onToggleEpic: (id: string) => void
  onToggleModule: (id: string) => void
  onToggleStory: (id: string) => void
  onShowAddForm: (id: string) => void
  onHideAddForm: (id: string) => void
  onCardCreate: (columnId: string, title: string, type: ItemType, parentId?: string, formKey?: string, versionId?: string, sprintId?: string) => Promise<void>
  onOpenDetail: (id: string) => void
  onTitleSave: (id: string, title: string) => void
  onDelete: (id: string) => void
  onArchive: (id: string) => void
  onEditStory: (story: ItemData) => void
  onEditEpic: (epic: ItemData) => void
  noModuleLabel: string
}

export function BoardLanes({
  simpleBoard, simpleStory, simpleCards, showStoryLanes, orphanCards, moduleGroups, visibleModuleGroups, columns, versions, sprints,
  collapsedEpics, collapsedModules, collapsedStories, columnAddForms, onToggleEpic, onToggleModule, onToggleStory,
  onShowAddForm, onHideAddForm, onCardCreate, onOpenDetail, onTitleSave, onDelete, onArchive, onEditStory, onEditEpic,
  noModuleLabel,
}: BoardLanesProps) {
  return (
    <>
      {simpleBoard && simpleStory && <Swimlane {...laneProps(simpleStory.id, simpleStory.title, columns, versions, sprints, simpleCards, false, columnAddForms, onShowAddForm, onHideAddForm, onCardCreate, onOpenDetail, onTitleSave, onDelete, onArchive, null)} />}
      {!simpleBoard && orphanCards.length > 0 && <Swimlane {...laneProps('orphan', noModuleLabel, columns, versions, sprints, orphanCards, collapsedEpics.has('orphan'), columnAddForms, onShowAddForm, onHideAddForm, onCardCreate, onOpenDetail, onTitleSave, onDelete, onArchive, null)} allowAdd={false} onToggle={() => onToggleEpic('orphan')} />}
      {!simpleBoard && visibleModuleGroups.map(({ module, epics }) => (
        <ModuleSwimlane key={module.id} title={module.name} epicCount={epics.length} progress={moduleProgress(epics)} points={modulePoints(epics)} collapsed={collapsedModules.has(module.id)} onToggle={() => onToggleModule(module.id)}>
          {epics.map(group => (
            <Swimlane key={group.epic.id} {...laneProps(group.epic.id, group.epic.title, columns, versions, sprints, group.tasks, collapsedEpics.has(group.epic.id), columnAddForms, onShowAddForm, onHideAddForm, onCardCreate, onOpenDetail, onTitleSave, onDelete, onArchive, () => onEditEpic(group.epic))}
              storyGroups={showStoryLanes ? group.storyGroups : undefined}
              collapsedStories={collapsedStories}
              onToggleStory={onToggleStory}
              onEditStory={onEditStory}
              defaultParentId={group.storyGroups.find(story => story.story)?.story?.id ?? null}
            />
          ))}
        </ModuleSwimlane>
      ))}
    </>
  )
}

function laneProps(
  swimlaneId: string, title: string, columns: Column[], versions: ProjectVersion[], sprints: Sprint[], tasks: ItemData[], collapsed: boolean,
  columnAddForms: Record<string, boolean>, onShowAddForm: (id: string) => void, onHideAddForm: (id: string) => void,
  onCardCreate: BoardLanesProps['onCardCreate'], onOpenDetail: (id: string) => void, onTitleSave: (id: string, title: string) => void,
  onDelete: (id: string) => void, onArchive: (id: string) => void, onEditEpic: (() => void) | null,
) {
  return { swimlaneId, title, columns, versions, sprints, tasks, collapsed, onToggle: () => {}, columnAddForms, onShowAddForm, onHideAddForm, onCardCreate, onOpenDetail, onTitleSave, onDelete, onArchive, onEditEpic }
}

function moduleProgress(epics: EpicLaneGroup[]) {
  const leaves = epics.flatMap(group => group.tasks).filter(item => item.isLeaf && ['TASK', 'BUG'].includes(item.type))
  return leaves.length ? Math.round((leaves.filter(item => item.status === 'DONE').length / leaves.length) * 100) : 0
}

function modulePoints(epics: EpicLaneGroup[]) {
  return epics.flatMap(group => group.tasks).filter(item => item.isLeaf && ['TASK', 'BUG'].includes(item.type)).reduce((sum, item) => sum + (item.points ?? 0), 0)
}

interface SwimlaneProps {
  swimlaneId: string; title: string; columns: Column[]; versions: ProjectVersion[]; sprints: Sprint[]; tasks: ItemData[]; collapsed: boolean; onToggle: () => void
  columnAddForms: Record<string, boolean>; onShowAddForm: (id: string) => void; onHideAddForm: (id: string) => void; onCardCreate: BoardLanesProps['onCardCreate']
  onOpenDetail: (id: string) => void; onTitleSave: (id: string, title: string) => void; onDelete: (id: string) => void; onArchive: (id: string) => void
  onEditEpic: (() => void) | null; storyGroups?: StoryLaneGroup[]; collapsedStories?: Set<string>; onToggleStory?: (id: string) => void; defaultParentId?: string | null; allowAdd?: boolean; onEditStory?: (story: ItemData) => void
}

function Swimlane(props: SwimlaneProps) {
  const { t } = useTranslation('board')
  const { tasks, collapsed, storyGroups } = props
  const progress = tasks.length ? Math.round((tasks.filter(task => task.status === 'DONE').length / tasks.length) * 100) : 0
  return <section className="mb-4 rounded-xl border border-border/80 bg-surface p-2.5 sm:p-3 shadow-sm">
    <div className="flex items-center gap-3 w-full mb-3 px-1">
      <button onClick={props.onToggle} aria-expanded={!collapsed} className="flex items-center gap-2.5 flex-1 text-left group min-w-0">
        <svg className={`w-4 h-4 text-muted-foreground transition-transform ${collapsed ? '' : 'rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <div className="min-w-0"><span className="font-semibold text-sm text-foreground block truncate">{props.title}</span><span className="text-[11px] text-muted-foreground">{storyGroups ? `${storyGroups.length} ${storyGroups.length === 1 ? 'história' : 'histórias'} · ${tasks.length} ${tasks.length === 1 ? 'card' : 'cards'}` : `${tasks.length} ${tasks.length === 1 ? 'item' : 'itens'}`}</span></div>
        <div className="ml-auto hidden sm:flex items-center gap-2 w-36"><div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden"><div className="h-full bg-status-done rounded-full" style={{ width: `${progress}%` }} /></div><span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{progress}%</span></div>
      </button>
      {props.onEditEpic && <button onClick={props.onEditEpic} className="text-muted-foreground hover:text-foreground transition flex-shrink-0 p-1 rounded hover:bg-muted" title={t('editEpic')}><Pencil className="w-3.5 h-3.5" /></button>}
    </div>
    {!collapsed && storyGroups && <div className="ml-2 sm:ml-4 pl-3 sm:pl-5 border-l-2 border-violet-400/30 space-y-2.5">{storyGroups.length === 0 && <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">{t('noStoriesInEpic')}</div>}{storyGroups.map(group => <StorySwimlane key={group.id} group={group} {...props} collapsed={props.collapsedStories?.has(group.id) ?? false} onToggle={() => props.onToggleStory?.(group.id)} onEdit={group.story ? () => props.onEditStory?.(group.story!) : undefined} />)}</div>}
    {!collapsed && !storyGroups && <BoardColumns laneId={props.swimlaneId} columns={props.columns} versions={props.versions} sprints={props.sprints} tasks={props.tasks} parentId={props.defaultParentId ?? undefined} allowAdd={props.allowAdd ?? true} columnAddForms={props.columnAddForms} onShowAddForm={props.onShowAddForm} onHideAddForm={props.onHideAddForm} onCardCreate={props.onCardCreate} onOpenDetail={props.onOpenDetail} onTitleSave={props.onTitleSave} onDelete={props.onDelete} onArchive={props.onArchive} />}
  </section>
}

function StorySwimlane({ group, columns, versions, sprints, columnAddForms, onShowAddForm, onHideAddForm, onCardCreate, onOpenDetail, onTitleSave, onDelete, onArchive, collapsed, onToggle, onEdit }: SwimlaneProps & { group: StoryLaneGroup; onEdit?: () => void }) {
  const { t } = useTranslation('board')
  const progress = group.tasks.length ? Math.round((group.tasks.filter(task => task.status === 'DONE').length / group.tasks.length) * 100) : 0
  return <section className="relative rounded-lg border border-violet-300/50 dark:border-violet-500/25 bg-surface-raised overflow-hidden"><span className="absolute -left-[22px] sm:-left-[30px] top-6 w-4 sm:w-6 h-px bg-violet-400/40" aria-hidden /><div className={`flex items-center gap-2.5 px-3 py-2.5 ${collapsed ? '' : 'border-b border-border/70'} bg-violet-500/[0.045]`}><button onClick={onToggle} aria-expanded={!collapsed} className="min-w-0 flex-1 flex items-center gap-2.5 text-left"><svg className={`w-3.5 h-3.5 text-violet-500 transition-transform ${collapsed ? '' : 'rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg><BookOpen className="w-3.5 h-3.5 text-violet-600" /><span className="min-w-0"><span className="block text-[10px] uppercase tracking-[0.12em] font-semibold text-violet-600">{group.story ? 'História' : 'Agrupamento'}</span><span className="block text-sm font-semibold text-foreground truncate">{group.title}</span></span><span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">{group.tasks.length} {group.tasks.length === 1 ? 'card' : 'cards'}</span><span className="hidden sm:flex items-center gap-2 w-28"><span className="h-1 flex-1 bg-muted rounded-full overflow-hidden"><span className="block h-full bg-status-done" style={{ width: `${progress}%` }} /></span><span className="text-[10px] tabular-nums font-semibold text-muted-foreground">{progress}%</span></span></button>{onEdit && <button onClick={onEdit} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition" title={t('editStory')} aria-label={`${t('editStory')} ${group.title}`}><Pencil className="w-3.5 h-3.5" /></button>}</div>{!collapsed && <div className="p-2.5"><BoardColumns laneId={`story-${group.id}`} columns={columns} versions={versions} sprints={sprints} tasks={group.tasks} parentId={group.story?.id} columnAddForms={columnAddForms} onShowAddForm={onShowAddForm} onHideAddForm={onHideAddForm} onCardCreate={onCardCreate} onOpenDetail={onOpenDetail} onTitleSave={onTitleSave} onDelete={onDelete} onArchive={onArchive} /></div>}</section>
}
