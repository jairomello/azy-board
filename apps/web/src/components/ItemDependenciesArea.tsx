import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Loader2, Pencil, Plus, Search, Trash2, Workflow, X, Check } from 'lucide-react'
import type { ItemDependency, ItemDependencyTarget } from '@azy-board/ui-contracts'
import type { ItemDependencyType } from '@azy-board/domain'
import { api } from '../lib/api'
import { useToast } from './Toast'

interface Props { itemId: string; projectId: string; canEdit: boolean }

interface CandidateItem {
  id: string
  title: string
  type: 'EPIC' | 'STORY' | 'TASK' | 'BUG' | 'EXTERNAL'
  sequenceCode: string | null
  parentId: string | null
}

interface Draft {
  dependsOnItemId: string
  dependencyType: ItemDependencyType
  lagDays: string
}

const emptyDraft: Draft = { dependsOnItemId: '', dependencyType: 'FS', lagDays: '0' }
const DEPENDENCY_TYPES: ItemDependencyType[] = ['FS', 'SS', 'SF', 'FF']

export function ItemDependenciesArea({ itemId, projectId, canEdit }: Props) {
  const { t } = useTranslation('board')
  const { toast } = useToast()
  const [dependencies, setDependencies] = useState<ItemDependency[]>([])
  const [candidates, setCandidates] = useState<CandidateItem[]>([])
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [candidateProjectId, setCandidateProjectId] = useState<string>(projectId)
  const [pickerText, setPickerText] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const baseUrl = `/projects/${projectId}/items/${itemId}/dependencies`

  const loadDependencies = useCallback(async (signal?: AbortSignal) => {
    const list = await api.get<ItemDependency[]>(baseUrl, { signal })
    setDependencies(list)
    return list
  }, [baseUrl])

  const loadCandidates = useCallback(async (targetProjectId: string, signal?: AbortSignal) => {
    const projectItems = await api.get<{ data: CandidateItem[] }>(`/projects/${targetProjectId}/items`, { signal })
    setCandidates(projectItems.data)
  }, [])

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const [projectsList] = await Promise.all([
        api.get<Array<{ id: string; name: string }>>('/projects', { signal }).catch(() => []),
        loadDependencies(signal),
      ])
      setProjects(projectsList)
      setCandidateProjectId(projectId)
      await loadCandidates(projectId, signal)
    } catch (error) {
      if ((error as { name?: string }).name !== 'AbortError') toast(t('dependenciesLoadError'), 'error')
    } finally { setLoading(false) }
  }, [loadDependencies, loadCandidates, projectId, t, toast])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  // Troca o projeto de busca do seletor (cross-project): recarrega os candidatos.
  const changeCandidateProject = useCallback((nextProjectId: string) => {
    setCandidateProjectId(nextProjectId)
    setDraft(previous => ({ ...previous, dependsOnItemId: '' }))
    setPickerText('')
    const controller = new AbortController()
    void loadCandidates(nextProjectId, controller.signal).catch(() => {})
  }, [loadCandidates])

  const linkedIds = useMemo(() => new Set(dependencies.map(dependency => dependency.dependsOnItemId)), [dependencies])

  // Seletor em ordem hierárquica (pai antes de filho), com indentação visual
  // por nível via caracteres de árvore. Ordena irmãos por código/título.
  const selectableTree = useMemo(() => {
    const byParent = new Map<string | null, CandidateItem[]>()
    for (const candidate of candidates) {
      const bucket = byParent.get(candidate.parentId) ?? []
      bucket.push(candidate)
      byParent.set(candidate.parentId, bucket)
    }
    const sortBucket = (bucket: CandidateItem[]) =>
      bucket.sort((a, b) => (a.sequenceCode ?? a.title).localeCompare(b.sequenceCode ?? b.title))
    for (const bucket of byParent.values()) sortBucket(bucket)

    const ordered: Array<{ item: CandidateItem; prefix: string }> = []
    const visit = (parentId: string | null, prefixStack: string[]) => {
      sortBucket(byParent.get(parentId) ?? []).forEach((node, index) => {
        const last = index === (byParent.get(parentId) ?? []).length - 1
        const prefix = parentId === null ? '' : prefixStack.join('') + (last ? '└─ ' : '├─ ')
        ordered.push({ item: node, prefix })
        visit(node.id, [...prefixStack, parentId === null ? '' : (last ? '    ' : '│   ')])
      })
    }
    visit(null, [])
    return ordered
  }, [candidates])

  const selectable = useMemo(
    () => selectableTree
      .filter(entry => entry.item.id !== itemId && !linkedIds.has(entry.item.id))
      .filter(entry => {
        if (pickerText.trim() === '') return true
        return candidateLabel(entry.item).toLowerCase().includes(pickerText.trim().toLowerCase())
      }),
    [selectableTree, linkedIds, pickerText, itemId],
  )

  const selectedLabel = useMemo(() => {
    const found = candidates.find(candidate => candidate.id === draft.dependsOnItemId)
    return found ? candidateLabel(found) : ''
  }, [candidates, draft.dependsOnItemId, candidateLabel])

  function pickCandidate(candidate: CandidateItem) {
    setDraft(previous => ({ ...previous, dependsOnItemId: candidate.id }))
    setPickerText(candidateLabel(candidate))
    setPickerOpen(false)
    setHighlight(-1)
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        dependsOnItemId: draft.dependsOnItemId,
        dependsOnProjectId: candidateProjectId === projectId ? null : candidateProjectId,
        dependencyType: draft.dependencyType,
        lagDays: Number.parseInt(draft.lagDays, 10) || 0,
      }
      if (editingId) {
        const updated = await api.patch<ItemDependency>(`${baseUrl}/${editingId}`, payload)
        setDependencies(previous => previous.map(row => row.id === updated.id ? updated : row))
      } else {
        const created = await api.post<ItemDependency>(baseUrl, payload)
        setDependencies(previous => [...previous, created])
      }
      setDraft(emptyDraft)
      setPickerText('')
      setPickerOpen(false)
      setHighlight(-1)
      setEditingId(null)
      setFormOpen(false)
    } catch (error) {
      // Rejeição do servidor (ex.: ciclo, alvo inválido) chega na mensagem do erro.
      toast(error instanceof Error ? error.message : t('dependenciesSaveError'), 'error')
    } finally { setSaving(false) }
  }

  function edit(dependency: ItemDependency) {
    // Dependência cross-project: aponta a busca de candidatos para o projeto do alvo.
    const targetProjectId = dependency.dependsOn.projectId !== projectId ? dependency.dependsOn.projectId : projectId
    if (targetProjectId !== candidateProjectId) {
      setCandidateProjectId(targetProjectId)
      void loadCandidates(targetProjectId).catch(() => {})
    }
    setEditingId(dependency.id)
    setDraft({
      dependsOnItemId: dependency.dependsOnItemId,
      dependencyType: dependency.dependencyType,
      lagDays: String(dependency.lagDays),
    })
    setPickerText(targetLabel(dependency.dependsOn))
    setPickerOpen(false)
    setHighlight(-1)
    setFormOpen(true)
  }

  async function remove(dependency: ItemDependency) {
    if (!confirm(t('dependenciesRemoveConfirm', { name: dependency.dependsOn.title }))) return
    setRemovingId(dependency.id)
    try {
      await api.delete(`${baseUrl}/${dependency.id}`)
      setDependencies(previous => previous.filter(row => row.id !== dependency.id))
    } catch { toast(t('dependenciesRemoveError'), 'error') }
    finally { setRemovingId(null) }
  }

  function typeLabel(type: ItemDependencyType): string {
    return t(`dependenciesType${type}`)
  }

  function itemIdentifier(item: { sequenceCode: string | null }): string | null {
    return item.sequenceCode?.trim() || null
  }

  // Só exibe identificadores sequenciais de negócio (T#, B#, S#, E#).
  // Nunca substitui código ausente por UUID ou tipo do item.
  function candidateLabel(candidate: Pick<CandidateItem, 'sequenceCode' | 'title'>): string {
    const identifier = itemIdentifier(candidate)
    return identifier ? `${identifier} — ${candidate.title}` : candidate.title
  }

  function targetLabel(target: ItemDependencyTarget): string {
    const identifier = itemIdentifier(target)
    return identifier ? `${identifier} — ${target.title}` : target.title
  }

  const inputClass = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">{t('dependenciesHint')}</p>
      {canEdit && !formOpen && <button type="button" onClick={() => { setDraft(emptyDraft); setPickerText(''); setPickerOpen(false); setHighlight(-1); setFormOpen(true) }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Plus className="h-3.5 w-3.5" />{t('dependenciesAdd')}</button>}
    </div>

    {canEdit && formOpen && <div className="space-y-3 rounded-lg border border-border p-3">
      {projects.length > 1 && <label className="block space-y-1">
        <span className="text-xs font-medium">{t('dependenciesProject', { defaultValue: 'Projeto do alvo' })}</span>
        <select aria-label={t('dependenciesProject', { defaultValue: 'Projeto do alvo' })} className={inputClass} value={candidateProjectId} onChange={event => changeCandidateProject(event.target.value)}>
          {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </label>}
      <div className="relative">
          <label className="block space-y-1">
            <span className="text-xs font-medium">{t('dependenciesTarget')}</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                role="combobox"
                aria-expanded={pickerOpen}
                aria-controls="dependencies-picker-listbox"
                aria-autocomplete="list"
                aria-label={t('dependenciesTarget')}
                className={`${inputClass} pl-8 font-mono`}
                placeholder={t('dependenciesSearch')}
                value={pickerText}
                onChange={event => {
                  setPickerText(event.target.value)
                  setPickerOpen(true)
                  setHighlight(-1)
                  if (draft.dependsOnItemId && event.target.value !== selectedLabel) setDraft(previous => ({ ...previous, dependsOnItemId: '' }))
                }}
                onFocus={() => setPickerOpen(true)}
                onBlur={() => { window.setTimeout(() => setPickerOpen(false), 120) }}
                onKeyDown={event => {
                  if (event.key === 'ArrowDown') { event.preventDefault(); const next = Math.min(highlight + 1, selectable.length - 1); setHighlight(next); setPickerOpen(true); return }
                  if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight(Math.max(highlight - 1, 0)); setPickerOpen(true); return }
                  if (event.key === 'Enter') { event.preventDefault(); const entry = selectable[highlight]; if (entry) pickCandidate(entry.item); return }
                  if (event.key === 'Escape') setPickerOpen(false)
                }}
              />
            </span>
          </label>
          {pickerOpen && (
            <ul id="dependencies-picker-listbox" role="listbox" aria-label={t('dependenciesTarget')} className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover p-1 text-sm shadow-xl">
              {selectable.length === 0 && <li className="px-2 py-1.5 text-xs text-muted-foreground">{t('dependenciesEmptyList', { defaultValue: 'Nenhum item encontrado' })}</li>}
              {selectable.map((entry, index) => (
                <li
                  key={entry.item.id}
                  role="option"
                  tabIndex={-1}
                  aria-selected={draft.dependsOnItemId === entry.item.id}
                  className={`flex items-center whitespace-nowrap rounded px-2 py-1.5 font-mono text-xs ${highlight === index ? 'bg-primary/10 ring-1 ring-primary/40' : ''} cursor-pointer hover:bg-muted`}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => pickCandidate(entry.item)}
                >{entry.prefix}{candidateLabel(entry.item)}</li>
              ))}
            </ul>
          )}
        </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block space-y-1"><span className="text-xs font-medium">{t('dependenciesType')}</span><select className={inputClass} value={draft.dependencyType} onChange={event => setDraft(previous => ({ ...previous, dependencyType: event.target.value as ItemDependencyType }))}>{DEPENDENCY_TYPES.map(type => <option key={type} value={type}>{type} — {typeLabel(type)}</option>)}</select></label>
        <label className="block space-y-1"><span className="text-xs font-medium">{t('dependenciesLag')}</span><input className={inputClass} type="number" step="1" value={draft.lagDays} onChange={event => setDraft(previous => ({ ...previous, lagDays: event.target.value }))} /></label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => { setDraft(emptyDraft); setPickerText(''); setPickerOpen(false); setHighlight(-1); setEditingId(null); setFormOpen(false) }} disabled={saving} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs"><X className="h-3.5 w-3.5" />{t('attachmentCancel')}</button>
        <button type="button" onClick={() => void save()} disabled={saving || !draft.dependsOnItemId} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{t('attachmentSave')}</button>
      </div>
    </div>}

    {loading && <p className="text-sm text-muted-foreground">{t('dependenciesLoading')}</p>}
    {!loading && dependencies.length === 0 && <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center"><Workflow className="h-5 w-5 text-muted-foreground" /><p className="text-sm text-muted-foreground">{t('dependenciesEmpty')}</p></div>}
    <ul className="space-y-2">{dependencies.map(dependency => <li key={dependency.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
      <Workflow className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5">
          {itemIdentifier(dependency.dependsOn) && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">{itemIdentifier(dependency.dependsOn)}</span>}
          <span className="min-w-0 truncate text-sm font-medium text-foreground">{dependency.dependsOn.title}</span>
          {dependency.dependsOn.projectId !== projectId && dependency.dependsOn.projectName && <span className="shrink-0 rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">{dependency.dependsOn.projectName}</span>}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{dependency.dependencyType}</span><span>{typeLabel(dependency.dependencyType)}</span><ArrowRight className="h-3 w-3" /><span>{t('dependenciesLagDays', { days: dependency.lagDays })}</span></p>
      </div>
      {canEdit && <><button type="button" onClick={() => edit(dependency)} aria-label={t('dependenciesEdit')} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button><button type="button" disabled={removingId === dependency.id} onClick={() => void remove(dependency)} aria-label={t('dependenciesRemove')} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">{removingId === dependency.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></>}
    </li>)}</ul>
  </div>
}
