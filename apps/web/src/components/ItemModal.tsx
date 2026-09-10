import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Info, Plus, Check, X, Clock, ChevronLeft } from 'lucide-react'
import type { Priority, TaskStatus, ItemType, Checklist } from '@azy-board/types'
import { InlineEdit } from './InlineEdit'
import { TagSelector, type Tag } from './TagSelector'
import { StorySelector } from './StorySelector'
import { AddCardForm } from './AddCardForm'
import { ChecklistSection } from './ChecklistSection'
import { CardChildrenSection } from './CardChildrenSection'
import { ActivityLogModal } from './ActivityLogModal'
import { WorkLogModal } from './WorkLogModal'
import { RichTextEditor } from './RichTextEditor'
import { AccordionSection } from './AccordionSection'
import { AccordionToolbar } from './AccordionToolbar'
import { ChecklistSummary, NeutralSummary } from './AccordionSummary'
import { api } from '../lib/api'

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
  const { t } = useTranslation()
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
  const [showSubtaskForm, setShowSubtaskForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [showWorkLog, setShowWorkLog] = useState(false)
  const [childStack, setChildStack] = useState<ChildModalState[]>([])
  const [totalMinutes, setTotalMinutes] = useState<number | null>(null)
  const [workLogCount, setWorkLogCount] = useState(0)
  const [activityCount, setActivityCount] = useState(0)
  const [subtaskCount, setSubtaskCount] = useState(0)
  const [subtaskRefreshKey, setSubtaskRefreshKey] = useState(0)
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(['item-fields']))
  const sectionIds = ['item-fields', 'item-description', 'item-subtasks', 'item-checklists', 'item-activity', 'item-work-log']

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
    setActivityCount(0)
    setWorkLogCount(0)
    setSubtaskCount(0)
    setSubtaskRefreshKey(0)
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
      }, selectedTags.map(t => t.id))
      onClose()
    } catch {
      setError(t('errorSave'))
    } finally {
      setSaving(false)
    }
  }

  const zIndex = 50 + _depth * 10

  return (
    <>
      <div className={`fixed inset-0 z-[${zIndex}] flex items-center justify-center p-4`} style={{ zIndex }}>
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => {
            if (_onBack) _onBack()
            else onClose()
          }}
        />
        <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between p-6 pb-4 border-b border-border sticky top-0 bg-card z-10">
            <div className="flex items-center gap-2 flex-1 mr-4 min-w-0">
              {/* Tarefa 8.1 — botão Voltar em modais filhas */}
              {_onBack && (
                <button onClick={_onBack} className="flex-shrink-0 text-muted-foreground hover:text-foreground transition">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <InlineEdit
                value={title}
                onSave={setTitle}
                className="text-base font-semibold"
                autoEdit={item.id === '__new__'}
                 placeholder={item.type === 'BUG' ? `${t('newTask')} (${t('typeBug')})` : t('newTask')}
              />
            </div>
            <button
              onClick={_onCloseAll ?? onClose}
              className="text-muted-foreground hover:text-foreground transition flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

           <div className="p-6 space-y-4">
             <AccordionToolbar sectionIds={sectionIds} openIds={openSections} onChange={setOpenSections} />
             {/* Box informativa para cards bloqueados (com subtasks) */}
              <AccordionSection id="item-fields" title={t('accordion.itemFields')} summary={t('accordion.itemType', { type: t(type === 'BUG' ? 'accordion.bug' : 'accordion.taskType') })} isOpen={openSections.has('item-fields')} onToggle={id => setOpenSections(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })}>
               {!item.isLeaf && (
               <div className="flex gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">
                   {t('moveBlocked')}
                </p>
              </div>
               )}

             <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
             <div>
                 <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('itemTypeLabel')}</label>
                <select value={type} onChange={e => setType(e.target.value as 'TASK' | 'BUG')}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary">
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                 <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('statusLabel')}</label>
                <select value={status} onChange={e => setStatus(e.target.value as TaskStatus)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary">
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                 <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('priorityLabel')}</label>
                <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary">
                  {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                 <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('filterAssignee')}</label>
                <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary">
                   <option value="">{t('unassigned')}</option>
                  {members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
                </select>
              </div>
              <div>
                 <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('filterSprint')}</label>
                <select aria-label="Sprint" value={sprintId} onChange={e => setSprintId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary">
                   <option value="">{t('noSprint')}</option>
                   {projectSprints.length === 0 && <option disabled>{t('noSprints')}</option>}
                  {projectSprints.filter(sprint => sprint.status !== 'CLOSED').map(sprint => (
                    <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
                  ))}
                </select>
              </div>
              <div>
                 <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('filterVersion')}</label>
                <select value={versionId} onChange={e => setVersionId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary">
                   <option value="">{t('noVersion')}</option>
                   {projectVersions.length === 0 && <option disabled>{t('noVersions')}</option>}
                  {projectVersions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              {/* Campo Centro de Custo — exibido apenas quando o projeto possui centros cadastrados */}
              {projectCostCenters.length > 0 && (
                <div>
                   <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('costCenterLabel')}</label>
                  <select value={costCenterId} onChange={e => setCostCenterId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary">
                     <option value="">{t('none')}</option>
                    {projectCostCenters.map(cc => (
                      <option key={cc.id} value={cc.id}>{cc.code}{cc.description ? ` — ${cc.description}` : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Tarefa 9.1 — campo Autor somente leitura */}
              <div>
                 <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('authorLabel')}</label>
                <div className="flex items-center gap-2 px-3 py-2 text-sm bg-background border border-border rounded-lg">
                  {item.author ? (
                    <>
                      {item.author.avatarUrl ? (
                        <img src={item.author.avatarUrl} alt={item.author.name}
                          className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-primary">
                            {item.author.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="truncate text-foreground">{item.author.name}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <div>
                 <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('pointsLabel')}</label>
                <input type="number" min="0" value={points} onChange={e => setPoints(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
                  placeholder="0" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                   <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('startDate')}</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full px-2 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary" />
                </div>
                <div>
                   <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('dueDate')}</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    className="w-full px-2 py-2 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary" />
                </div>
              </div>
             </div>

             {epics.length > 0 && (
              <div>
                 <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('parentStory')}</label>
                <StorySelector
                  epics={epics}
                  stories={stories}
                  value={parentId}
                  onChange={setParentId}
                  onCreateStory={onCreateStory}
                />
              </div>
            )}

             <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('tagsLabel')}</label>
              <TagSelector
                allTags={projectTags}
                selected={selectedTags}
                onSelect={setSelectedTags}
                onCreate={onCreateTag}
                onEdit={onEditTag}
               />
              </div>
             </div>
             </AccordionSection>

             <AccordionSection id="item-description" title={t('accordion.description')} summary={description ? t('accordion.contentPresent') : <NeutralSummary />} isOpen={openSections.has('item-description')} onToggle={id => setOpenSections(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })}>
             <div>
               <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('descriptionLabel')}</label>
              <RichTextEditor
                key={item.id}
                content={description}
                onChange={setDescription}
                placeholder={t('richText.itemPlaceholder')}
                fieldLabel={t('richText.itemField')}
                minHeight="80px"
              />
             </div>
             </AccordionSection>

              <AccordionSection id="item-subtasks" title={t('accordion.subtasks')} summary={subtaskCount > 0 ? t(subtaskCount === 1 ? 'accordion.subtaskCountOne' : 'accordion.subtaskCountMany', { count: subtaskCount }) : <NeutralSummary />} isOpen={openSections.has('item-subtasks')} onToggle={id => setOpenSections(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })}>
              {item.id !== '__new__' && (
                <CardChildrenSection
                  itemId={item.id}
                  projectId={projectId}
                  onOpenChild={handleOpenChild}
                  onCountChange={setSubtaskCount}
                  refreshKey={subtaskRefreshKey}
                />
              )}
              {item.isLeaf && (
               <div>
                 <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('showSubtasks')}</label>
                {showSubtaskForm ? (
                  <AddCardForm
                    onAdd={async (subTitle, subType) => {
                      await onAddSubtask(item.id, subTitle, subType)
                      setSubtaskRefreshKey(key => key + 1)
                      setShowSubtaskForm(false)
                    }}
                    onCancel={() => setShowSubtaskForm(false)}
                  />
                ) : (
                  <button onClick={() => setShowSubtaskForm(true)}
                    className="flex items-center gap-1 text-sm text-primary hover:underline">
                    <Plus className="w-3.5 h-3.5" />
                     {t('addSubtask')}
                  </button>
                )}
              </div>
             )}
             {item.id === '__new__' && <p className="text-sm text-muted-foreground">{t('accordion.noAdditionalContent')}</p>}
             </AccordionSection>

             <AccordionSection id="item-checklists" title={t('accordion.checklists')} summary={checklists.length > 0 ? <ChecklistSummary checked={checklists.reduce((sum, list) => sum + list.items.filter(i => i.checked).length, 0)} total={checklists.reduce((sum, list) => sum + list.items.length, 0)} /> : <NeutralSummary />} isOpen={openSections.has('item-checklists')} onToggle={id => setOpenSections(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })}>
             {item.id !== '__new__' ? (
               <div>
                 <ChecklistSection
                  itemId={item.id}
                  projectId={projectId}
                   initialChecklists={checklists}
                   onChange={setChecklists}
                 />
               </div>
             ) : <p className="text-sm text-muted-foreground">{t('accordion.noAdditionalContent')}</p>}
             </AccordionSection>

            {error && <p className="text-sm text-red-500">{error}</p>}

             {/* Histórico e atividades ficam separados da seção de Subtasks acima. */}
               <AccordionSection id="item-activity" title={t('accordion.activity')} summary={activityCount > 0 ? t(activityCount === 1 ? 'accordion.activityCountOne' : 'accordion.activityCountMany', { count: activityCount }) : <NeutralSummary />} isOpen={openSections.has('item-activity')} onToggle={id => setOpenSections(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })}>
             {item.id !== '__new__' && (
               <div className="flex items-center gap-3">
                 <button
                   onClick={() => setShowActivityLog(true)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
                >
                  <Clock className="w-4 h-4" />
                   {t('changeHistory')}
                </button>
                {totalMinutes != null && (
                  <span className="text-xs text-muted-foreground">
                     ⏱ {formatDuration(totalMinutes, t('worked'))}
                  </span>
                )}
              </div>
            )}

              {item.id === '__new__' && <p className="text-sm text-muted-foreground">{t('accordion.noAdditionalContent')}</p>}
              </AccordionSection>

              <AccordionSection id="item-work-log" title={t('accordion.workLog')} summary={workLogCount > 0 ? t(workLogCount === 1 ? 'accordion.workLogCountOne' : 'accordion.workLogCountMany', { count: workLogCount }) : <NeutralSummary />} isOpen={openSections.has('item-work-log')} onToggle={id => setOpenSections(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })}>
              {item.id !== '__new__' ? (
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowWorkLog(true)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
                    <Clock className="h-4 w-4" />
                     {t('registerWork')}
                  </button>
                   {totalMinutes != null && <span className="text-xs font-medium text-primary">{formatDuration(totalMinutes, t('worked'))}</span>}
                </div>
              ) : <p className="text-sm text-muted-foreground">{t('accordion.noAdditionalContent')}</p>}
              </AccordionSection>
          </div>

          <div className="flex gap-2 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition">
              <Check className="w-4 h-4" />
               {saving ? t('saving') : t('save')}
            </button>
            <button onClick={_onBack ?? onClose}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition">
              <X className="w-4 h-4" />
               {_onBack ? t('back') : t('cancel')}
            </button>
          </div>
        </div>
      </div>

      {/* Tarefa 10.3 — ActivityLogModal sobre a modal */}
      {showActivityLog && currentUserId && (
        <ActivityLogModal
          itemId={item.id}
          itemTitle={item.title}
          projectId={projectId}
          onClose={() => setShowActivityLog(false)}
        />
      )}
      {showWorkLog && currentUserId && (
        <WorkLogModal
          itemId={item.id}
          itemTitle={item.title}
          projectId={projectId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onCountChange={setWorkLogCount}
          onTotalChange={setTotalMinutes}
          onClose={() => setShowWorkLog(false)}
        />
      )}

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
