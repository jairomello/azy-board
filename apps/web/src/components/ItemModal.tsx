import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, Plus, Check, X, ChevronLeft, ChevronRight, CheckSquare, ListChecks, History, CalendarDays, UserRound } from 'lucide-react'
import type { ItemType, Priority, TaskStatus } from '@azy-board/domain'
import type { Checklist } from '@azy-board/ui-contracts'
import { InlineEdit } from './InlineEdit'
import { TagSelector, type Tag } from './TagSelector'
import { StorySelector } from './StorySelector'
import { AddCardForm } from './AddCardForm'
import { ChecklistSection } from './ChecklistSection'
import { CardChildrenSection } from './CardChildrenSection'
import { ActivityLogPanel } from './ActivityLogPanel'
import { WorkLogPanel } from './WorkLogPanel'
import { RichTextEditor } from './RichTextEditor'
import { itemTypeMeta } from '../lib/itemTypeMeta'
import { api } from '../lib/api'
import { resolveAppUrl } from '../lib/appUrl'

interface Epic { id: string; title: string }
interface StoryOption { id: string; title: string; epicId: string }

export interface ProjectMember {
  userId: string
  name: string
  email: string
  avatarUrl?: string | null
  role: string
  squadId?: string | null
}

export interface ProjectVersion {
  id: string
  name: string
  status: 'PLANNED' | 'IN_DEV' | 'RELEASED' | 'CANCELLED'
}

export interface ProjectSprint {
  id: string
  name: string
  status: 'PROPOSED' | 'OPEN' | 'CLOSED'
}

export interface CostCenter {
  id: string
  code: string
  description?: string | null
  sortOrder: number
}

export interface FullItemData {
  id: string
  title: string
  status: TaskStatus
  priority: Priority
  type?: ItemType | null
  sequenceCode?: string | null
  points?: number | null
  description?: string | null
  startDate?: string | null
  dueDate?: string | null
  parentId?: string | null
  assigneeId?: string | null
  assignee?: { id: string; name: string; avatarUrl: string | null } | null
  author?: { id: string; name: string; avatarUrl: string | null } | null
  versionId?: string | null
  itemSprints?: Array<{ sprintId: string }>
  sprintId?: string | null
  costCenterId?: string | null
  itemTags?: Array<{ tag: Tag }>
  taskTags?: Array<{ tag: Tag }>
  isLeaf: boolean
  ancestryPath: string
}

function formatDuration(min: number, worked: string): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min ${worked}`
  if (m === 0) return `${h}h ${worked}`
  return `${h}h ${m}min ${worked}`
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'LOW', label: 'Baixa' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'CRITICAL', label: 'Crítica' },
]

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'NOT_STARTED', label: 'Não iniciada' },
  { value: 'IN_PROGRESS', label: 'Em andamento' },
  { value: 'BLOCKED', label: 'Bloqueada' },
  { value: 'DONE', label: 'Concluída' },
  { value: 'CANCELLED', label: 'Cancelada' },
]

const TYPE_OPTIONS: { value: 'TASK' | 'BUG'; label: string }[] = [
  { value: 'TASK', label: 'Tarefa' },
  { value: 'BUG', label: 'Bug' },
]

interface ChildModalState {
  id: string
  data: FullItemData | null
  loading: boolean
}

type ItemArea = 'details' | 'subtasks' | 'checklists' | 'activity'

interface Props {
  item: FullItemData
  projectId: string
  epics: Epic[]
  stories: StoryOption[]
  projectTags: Tag[]
  members: ProjectMember[]
  currentUserId?: string
  projectVersions?: ProjectVersion[]
  projectSprints?: ProjectSprint[]
  projectCostCenters?: CostCenter[]
  advancedChecklists?: boolean
  onClose: () => void
  onSave: (itemId: string, changes: Partial<FullItemData>, tagIds: string[]) => Promise<void>
  onAddSubtask: (parentId: string, title: string, type: ItemType) => Promise<void>
  onCreateTag: (name: string, color: string) => Promise<Tag>
  onEditTag: (tagId: string, name: string, color: string) => Promise<void>
  onCreateStory: (title: string, epicId: string) => Promise<StoryOption>
  // props internas para modais filhas — não usar externamente
  _depth?: number
  _onBack?: () => void
  _onCloseAll?: () => void
}

export function ItemModal({
  item,
  projectId,
  epics,
  stories,
  projectTags,
  members,
  currentUserId,
  projectVersions = [],
  projectSprints = [],
  projectCostCenters = [],
  advancedChecklists = false,
  onClose,
  onSave,
  onAddSubtask,
  onCreateTag,
  onEditTag,
  onCreateStory,
  _depth = 0,
  _onBack,
  _onCloseAll,
}: Props) {
  const { t } = useTranslation('board')
  const [title, setTitle] = useState(item.title)
  const [priority, setPriority] = useState<Priority>(item.priority)
  const [status, setStatus] = useState<TaskStatus>(item.status)
  const [type, setType] = useState<'TASK' | 'BUG'>((item.type === 'BUG' ? 'BUG' : 'TASK'))
  const [assigneeId, setAssigneeId] = useState<string>(item.assigneeId ?? item.assignee?.id ?? '')
  const [parentId, setParentId] = useState<string | null>(item.parentId ?? null)
  const [selectedTags, setSelectedTags] = useState<Tag[]>(
    (item.itemTags ?? item.taskTags ?? []).map(it => it.tag)
  )
  const [versionId, setVersionId] = useState<string>(item.versionId ?? '')
  const [sprintId, setSprintId] = useState<string>(item.itemSprints?.[0]?.sprintId ?? '')
  const [costCenterId, setCostCenterId] = useState<string>(item.costCenterId ?? '')
  const [points, setPoints] = useState(item.points?.toString() ?? '')
  const [startDate, setStartDate] = useState(item.startDate ?? '')
  const [dueDate, setDueDate] = useState(item.dueDate ?? '')
  const [description, setDescription] = useState(item.description ?? '')
  const [sequenceCode, setSequenceCode] = useState(item.sequenceCode ?? '')
  const [showSubtaskForm, setShowSubtaskForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [childStack, setChildStack] = useState<ChildModalState[]>([])
  const [totalMinutes, setTotalMinutes] = useState<number | null>(null)
  const [workLogCount, setWorkLogCount] = useState(0)
  const [activityCount, setActivityCount] = useState(0)
  const [subtaskCount, setSubtaskCount] = useState(0)
  const [subtaskRefreshKey, setSubtaskRefreshKey] = useState(0)
  const [activeArea, setActiveArea] = useState<ItemArea>('details')

  // Resolução do papel do usuário atual no projeto
  const currentUserRole = members.find(m => m.userId === currentUserId)?.role ?? 'MEMBER'

  // Carrega checklists ao abrir modal de item existente
  useEffect(() => {
    if (item.id === '__new__') { setChecklists([]); return }
    let cancelled = false
    setChecklists([])
    api.get<Checklist[]>(`/projects/${projectId}/items/${item.id}/checklists`)
      .then(data => { if (!cancelled) setChecklists(data) })
      .catch(() => { if (!cancelled) setChecklists([]) })
    return () => { cancelled = true }
  }, [item.id, projectId])

  // Tarefa 10.2 — carrega soma de horas trabalhadas (logs manuais com durationMin)
  useEffect(() => {
    if (item.id === '__new__') { setTotalMinutes(null); return }
    let cancelled = false
    api.get<{ data: Array<{ durationMin: number | null }>; total: number }>(
      `/projects/${projectId}/items/${item.id}/work-log?limit=100`
    )
      .then(res => {
        if (cancelled) return
        const sum = res.data
          .filter(l => l.durationMin != null)
          .reduce((acc, l) => acc + (l.durationMin ?? 0), 0)
        setTotalMinutes(sum > 0 ? sum : null)
        setWorkLogCount(res.total)
      })
      .catch(() => {
        if (cancelled) return
        setTotalMinutes(null)
        setWorkLogCount(0)
      })
    return () => { cancelled = true }
  }, [item.id, projectId])

  useEffect(() => {
    if (item.id === '__new__') { setActivityCount(0); return }
    let cancelled = false
    api.get<{ total: number }>(`/projects/${projectId}/items/${item.id}/audit?limit=1`)
      .then(res => { if (!cancelled) setActivityCount(res.total) })
      .catch(() => { if (!cancelled) setActivityCount(0) })
    return () => { cancelled = true }
  }, [item.id, projectId])

  useEffect(() => {
    setTitle(item.title)
    setPriority(item.priority)
    setStatus(item.status)
    setType(item.type === 'BUG' ? 'BUG' : 'TASK')
    setAssigneeId(item.assigneeId ?? item.assignee?.id ?? '')
    setParentId(item.parentId ?? null)
    setSelectedTags((item.itemTags ?? item.taskTags ?? []).map(it => it.tag))
    setVersionId(item.versionId ?? '')
    setSprintId(item.itemSprints?.[0]?.sprintId ?? '')
    setCostCenterId(item.costCenterId ?? '')
    setPoints(item.points?.toString() ?? '')
    setStartDate(item.startDate ?? '')
    setDueDate(item.dueDate ?? '')
    setDescription(item.description ?? '')
    setSequenceCode(item.sequenceCode ?? '')
    setActivityCount(0)
    setWorkLogCount(0)
    setTotalMinutes(null)
    setSubtaskCount(0)
    setSubtaskRefreshKey(0)
    setActiveArea('details')
  }, [item.id])

  // Escape: pop child se houver, senão fecha a modal atual
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (childStack.length > 0) {
        setChildStack(prev => prev.slice(0, -1))
      } else if (_onBack) {
        _onBack()
      } else {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [childStack.length, _onBack, onClose])

  // Tarefa 8.1 — abrir modal filho por empilhamento
  const handleOpenChild = useCallback((childId: string) => {
    const MAX_DEPTH = 5
    if (_depth >= MAX_DEPTH) {
      // substituir o topo em vez de empilhar (Tarefa 6.3)
      setChildStack(prev => [
        ...prev.slice(0, -1),
        { id: childId, data: null, loading: true },
      ])
    } else {
      setChildStack(prev => [...prev, { id: childId, data: null, loading: true }])
    }
    api.get<FullItemData>(`/projects/${projectId}/items/${childId}`)
      .then(data => {
        setChildStack(prev => prev.map(s => s.id === childId ? { ...s, data, loading: false } : s))
      })
      .catch(() => {
        setChildStack(prev => prev.filter(s => s.id !== childId))
      })
  }, [projectId, _depth])

  const closeAllChildren = useCallback(() => {
    setChildStack([])
    if (_onCloseAll) _onCloseAll()
  }, [_onCloseAll])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await onSave(item.id, {
        title,
        priority,
        status,
        type,
        parentId,
        assigneeId: assigneeId || null,
        points: points ? parseInt(points) : null,
        versionId: versionId || null,
        sprintId: sprintId || null,
        costCenterId: costCenterId || null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        description: description || null,
        sequenceCode: sequenceCode || null,
      }, selectedTags.map(t => t.id))
      onClose()
    } catch {
      setError(t('errorSave'))
    } finally {
      setSaving(false)
    }
  }

  const zIndex = 50 + _depth * 10
  const ancestry = (() => {
    try { return JSON.parse(item.ancestryPath || '[]') as Array<{ title: string; type: string }> } catch { return [] }
  })()
  const areas: Array<{ id: ItemArea; label: string; icon: typeof CheckSquare; count?: number; summary?: string }> = [
    { id: 'details', label: t('areaDetails'), icon: CheckSquare },
    { id: 'subtasks', label: t('areaSubtasks'), icon: ListChecks, count: subtaskCount },
    { id: 'checklists', label: t('areaChecklists'), icon: ListChecks, count: checklists.length },
    { id: 'activity', label: t('areaActivity'), icon: History, count: activityCount, summary: totalMinutes != null ? formatDuration(totalMinutes, t('worked')) : undefined },
  ]
  const fieldClass = 'w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30'
  const property = (label: string, content: React.ReactNode) => <div><label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>{content}</div>
  const typeMeta = itemTypeMeta(type)
  const TypeIcon = typeMeta.icon

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-4" style={{ zIndex }}>
        <div className="absolute inset-0 bg-black/50" onClick={_onBack ?? onClose} />
        <section role="dialog" aria-modal="true" aria-labelledby="item-modal-title" className="item-modal-frame relative flex w-full max-w-[1120px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              {_onBack && <button type="button" onClick={_onBack} aria-label={t('back')} className="mt-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"><ChevronLeft className="h-5 w-5" /></button>}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{t('boardContext')}</span><ChevronRight className="h-3 w-3" />
                  {ancestry.slice(-2).map((node, index) => <span key={`${node.title}-${index}`} className="flex items-center gap-2"><span className="max-w-32 truncate">{node.title}</span><ChevronRight className="h-3 w-3" /></span>)}
                  <span>{item.id === '__new__' ? t('newTask') : (item.sequenceCode || item.title)}</span>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${typeMeta.iconClass}`}><TypeIcon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1"><h2 id="item-modal-title" className="text-base font-semibold text-foreground sm:text-lg"><InlineEdit value={title} onSave={setTitle} autoEdit={item.id === '__new__'} placeholder={type === 'TASK' ? t('newTask') : `${t('newTask')} (${t(typeMeta.labelKey)})`} /></h2><div className="mt-1 flex flex-wrap items-center gap-2 text-xs"><span className={`rounded px-1.5 py-0.5 font-medium ${typeMeta.chipClass}`}>{t(typeMeta.labelKey)}</span><span className="rounded bg-muted px-1.5 py-0.5">{t(`status${status === 'NOT_STARTED' ? 'NotStarted' : status === 'IN_PROGRESS' ? 'InProgress' : status === 'BLOCKED' ? 'Blocked' : status === 'DONE' ? 'Done' : 'Cancelled'}`)}</span>{sequenceCode && <span className="text-muted-foreground">#{sequenceCode}</span>}</div></div>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1"><button type="button" aria-label={t('cancel')} onClick={_onCloseAll ?? onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"><X className="h-5 w-5" /></button></div>
          </header>

          <nav role="tablist" aria-label={t('itemAreas')} className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-4 sm:px-6">
            {areas.map(area => { const Icon = area.icon; return <button key={area.id} id={`item-tab-${area.id}`} type="button" role="tab" aria-selected={activeArea === area.id} aria-controls={`item-area-${area.id}`} onClick={() => setActiveArea(area.id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-2 py-3 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-primary sm:px-3 ${activeArea === area.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Icon className="h-4 w-4" />{area.label}{area.count != null && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{area.count}</span>}{area.summary && <span className="hidden text-[10px] text-muted-foreground sm:inline">{area.summary}</span>}</button> })}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <main id={`item-area-${activeArea}`} role="tabpanel" aria-labelledby={`item-tab-${activeArea}`} className="min-w-0 space-y-4">
                {activeArea === 'details' && <>
                  {!item.isLeaf && <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p className="text-xs leading-relaxed">{t('moveBlocked')}</p></div>}
                  <div className="rounded-lg border border-border bg-card p-4"><h3 className="mb-3 text-sm font-semibold">{t('descriptionLabel')}</h3><RichTextEditor key={item.id} content={description} onChange={setDescription} placeholder={t('richText.itemPlaceholder')} fieldLabel={t('richText.itemField')} minHeight="120px" /></div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {property(t('itemTypeLabel'), <select value={type} onChange={e => setType(e.target.value as 'TASK' | 'BUG')} className={fieldClass}>{TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>)}
                    {epics.length > 0 && property(t('parentStory'), <StorySelector epics={epics} stories={stories} value={parentId} onChange={setParentId} onCreateStory={onCreateStory} />)}
                    {property(t('tagsLabel'), <TagSelector allTags={projectTags} selected={selectedTags} onSelect={setSelectedTags} onCreate={onCreateTag} onEdit={onEditTag} />)}
                    {projectCostCenters.length > 0 && property(t('costCenterLabel'), <select value={costCenterId} onChange={e => setCostCenterId(e.target.value)} className={fieldClass}><option value="">{t('none')}</option>{projectCostCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.code}{cc.description ? ` — ${cc.description}` : ''}</option>)}</select>)}
                  </div>
                </>}
                {activeArea === 'subtasks' && <div className="rounded-lg border border-border p-4"><div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-semibold">{t('areaSubtasks')} ({subtaskCount})</h3>{item.isLeaf && <button type="button" onClick={() => setShowSubtaskForm(true)} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20"><Plus className="h-3.5 w-3.5" />{t('addSubtask')}</button>}</div>{item.id !== '__new__' && <CardChildrenSection itemId={item.id} projectId={projectId} onOpenChild={handleOpenChild} onCountChange={setSubtaskCount} refreshKey={subtaskRefreshKey} />}{showSubtaskForm && <div className="mt-4"><AddCardForm onAdd={async (subTitle, subType) => { await onAddSubtask(item.id, subTitle, subType); setSubtaskRefreshKey(key => key + 1); setShowSubtaskForm(false) }} onCancel={() => setShowSubtaskForm(false)} /></div>}{item.id === '__new__' && <p className="text-sm text-muted-foreground">{t('accordion.noAdditionalContent')}</p>}</div>}
                {activeArea === 'checklists' && <div className="rounded-lg border border-border p-4">{item.id !== '__new__' ? <ChecklistSection itemId={item.id} projectId={projectId} initialChecklists={checklists} onChange={setChecklists} advancedChecklists={advancedChecklists} members={members} /> : <p className="text-sm text-muted-foreground">{t('accordion.noAdditionalContent')}</p>}</div>}
                {activeArea === 'activity' && <div id="item-area-activity" className="grid min-h-[360px] min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">{item.id !== '__new__' ? <><ActivityLogPanel itemId={item.id} projectId={projectId} onCountChange={setActivityCount} /><WorkLogPanel itemId={item.id} projectId={projectId} currentUserId={currentUserId ?? ''} currentUserRole={currentUserRole} onCountChange={setWorkLogCount} onTotalChange={setTotalMinutes} /></> : <p className="col-span-full rounded-lg border border-border p-6 text-sm text-muted-foreground">{t('accordion.noAdditionalContent')}</p>}</div>}
                {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
              </main>

              <aside className="min-w-0 space-y-5 rounded-lg border border-border bg-muted/20 p-4">
                <div><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><CheckSquare className="h-4 w-4 text-primary" />{t('properties')}</h3><div className="space-y-3">{property(t('statusLabel'), <select value={status} onChange={e => setStatus(e.target.value as TaskStatus)} className={fieldClass}>{STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>)}{property(t('filterAssignee'), <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className={fieldClass}><option value="">{t('unassigned')}</option>{members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select>)}{property(t('priorityLabel'), <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className={fieldClass}>{PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>)}</div></div>
                <div><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-primary" />{t('planning')}</h3><div className="space-y-3">{property(t('filterSprint'), <select value={sprintId} onChange={e => setSprintId(e.target.value)} className={fieldClass}><option value="">{t('noSprint')}</option>{projectSprints.length === 0 && <option disabled>{t('noSprints')}</option>}{projectSprints.filter(sprint => sprint.status !== 'CLOSED').map(sprint => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select>)}{property(t('filterVersion'), <select value={versionId} onChange={e => setVersionId(e.target.value)} className={fieldClass}><option value="">{t('noVersion')}</option>{projectVersions.length === 0 && <option disabled>{t('noVersions')}</option>}{projectVersions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>)}{property(t('pointsLabel'), <input type="number" min="0" value={points} onChange={e => setPoints(e.target.value)} className={fieldClass} placeholder="0" />)}<div className="grid grid-cols-2 gap-2">{property(t('startDate'), <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={fieldClass} />)}{property(t('dueDate'), <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={fieldClass} />)}</div></div></div>
                <div><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4 text-primary" />{t('information')}</h3><div className="space-y-3">{property(t('codeLabel'), <input value={sequenceCode} onChange={e => setSequenceCode(e.target.value)} placeholder={t('autoGenerated')} className={fieldClass} />)}{property(t('authorLabel'), <div className={`${fieldClass} flex items-center gap-2 text-muted-foreground`}>{item.author?.avatarUrl ? <img src={resolveAppUrl(item.author.avatarUrl)} alt={item.author.name} className="h-5 w-5 rounded-full" /> : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">{item.author?.name?.charAt(0).toUpperCase() ?? '?'}</span>}<span className="truncate">{item.author?.name ?? '—'}</span></div>)}</div></div>
              </aside>
            </div>
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-card px-4 py-3 sm:flex-row sm:justify-end sm:px-6"><button type="button" onClick={_onBack ?? onClose} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-primary"><X className="h-4 w-4" />{_onBack ? t('back') : t('cancel')}</button><button type="button" onClick={handleSave} disabled={saving || !title.trim()} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary"><Check className="h-4 w-4" />{saving ? t('saving') : t('saveChanges')}</button></footer>
        </section>
      </div>

      {/* Tarefas 8.1, 8.3 — modais de filhos empilhadas com z-index incremental */}
      {childStack.map((child, idx) => {
        if (child.loading || !child.data) return null
        const childZIndex = zIndex + (idx + 1) * 10
        return (
          <div key={child.id} style={{ zIndex: childZIndex }} className="fixed inset-0 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setChildStack(prev => prev.slice(0, idx))}
            />
            <ItemModal
              item={child.data}
              projectId={projectId}
              epics={epics}
              stories={stories}
              projectTags={projectTags}
              members={members}
              currentUserId={currentUserId}
              projectVersions={projectVersions}
              projectSprints={projectSprints}
              onClose={() => setChildStack(prev => prev.slice(0, idx))}
              onSave={onSave}
              onAddSubtask={onAddSubtask}
              onCreateTag={onCreateTag}
              onEditTag={onEditTag}
              onCreateStory={onCreateStory}
              _depth={_depth + idx + 1}
              _onBack={() => setChildStack(prev => prev.slice(0, -1))}
              _onCloseAll={closeAllChildren}
            />
          </div>
        )
      })}
    </>
  )
}
