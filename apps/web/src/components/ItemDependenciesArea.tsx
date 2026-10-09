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
  type: 'EPIC' | 'STORY' | 'TASK' | 'BUG'
  sequenceCode: string | null
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
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const baseUrl = `/projects/${projectId}/items/${itemId}/dependencies`

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const [list, projectItems] = await Promise.all([
        api.get<ItemDependency[]>(baseUrl, { signal }),
        api.get<{ data: CandidateItem[] }>(`/projects/${projectId}/items`, { signal }),
      ])
      setDependencies(list)
      setCandidates(projectItems.data)
    } catch (error) {
      if ((error as { name?: string }).name !== 'AbortError') toast(t('dependenciesLoadError'), 'error')
    } finally { setLoading(false) }
  }, [baseUrl, projectId, t, toast])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const linkedIds = useMemo(() => new Set(dependencies.map(dependency => dependency.dependsOnItemId)), [dependencies])
  const availableCandidates = useMemo(
    () => candidates
      .filter(candidate => candidate.id !== itemId && !linkedIds.has(candidate.id))
      .filter(candidate =>
        search.trim() === ''
        || candidate.title.toLowerCase().includes(search.trim().toLowerCase())
        || (candidate.sequenceCode ?? '').toLowerCase().includes(search.trim().toLowerCase()),
      )
      .sort((a, b) => (a.sequenceCode ?? a.title).localeCompare(b.sequenceCode ?? b.title)),
    [candidates, linkedIds, search, itemId],
  )

  async function save() {
    setSaving(true)
    try {
      const payload = {
        dependencyType: draft.dependencyType,
        lagDays: Number.parseInt(draft.lagDays, 10) || 0,
        ...(editingId ? {} : { dependsOnItemId: draft.dependsOnItemId }),
      }
      if (editingId) {
        const updated = await api.patch<ItemDependency>(`${baseUrl}/${editingId}`, payload)
        setDependencies(previous => previous.map(row => row.id === updated.id ? updated : row))
      } else {
        const created = await api.post<ItemDependency>(baseUrl, payload)
        setDependencies(previous => [...previous, created])
      }
      setDraft(emptyDraft)
      setSearch('')
      setEditingId(null)
      setFormOpen(false)
    } catch (error) {
      // Rejeição do servidor (ex.: ciclo, alvo inválido) chega na mensagem do erro.
      toast(error instanceof Error ? error.message : t('dependenciesSaveError'), 'error')
    } finally { setSaving(false) }
  }

  function edit(dependency: ItemDependency) {
    setEditingId(dependency.id)
    setDraft({
      dependsOnItemId: dependency.dependsOnItemId,
      dependencyType: dependency.dependencyType,
      lagDays: String(dependency.lagDays),
    })
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

  function targetLabel(target: ItemDependencyTarget): string {
    return target.sequenceCode ? `${target.sequenceCode} — ${target.title}` : target.title
  }

  const inputClass = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">{t('dependenciesHint')}</p>
      {canEdit && !formOpen && <button type="button" onClick={() => { setDraft(emptyDraft); setFormOpen(true) }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Plus className="h-3.5 w-3.5" />{t('dependenciesAdd')}</button>}
    </div>

    {canEdit && formOpen && <div className="space-y-3 rounded-lg border border-border p-3">
      {!editingId && <>
        <label className="block space-y-1"><span className="text-xs font-medium">{t('dependenciesTarget')}</span><select className={inputClass} value={draft.dependsOnItemId} onChange={event => setDraft(previous => ({ ...previous, dependsOnItemId: event.target.value }))}><option value="">—</option>{availableCandidates.map(candidate => <option key={candidate.id} value={candidate.id}>{(candidate.sequenceCode ? `${candidate.sequenceCode} — ` : '') + candidate.title}</option>)}</select></label>
        <label className="block space-y-1"><span className="text-xs font-medium">{t('dependenciesSearch')}</span><span className="relative block"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><input className={`${inputClass} pl-8`} placeholder={t('dependenciesSearch')} value={search} onChange={event => setSearch(event.target.value)} /></span></label>
      </>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block space-y-1"><span className="text-xs font-medium">{t('dependenciesType')}</span><select className={inputClass} value={draft.dependencyType} onChange={event => setDraft(previous => ({ ...previous, dependencyType: event.target.value as ItemDependencyType }))}>{DEPENDENCY_TYPES.map(type => <option key={type} value={type}>{type} — {typeLabel(type)}</option>)}</select></label>
        <label className="block space-y-1"><span className="text-xs font-medium">{t('dependenciesLag')}</span><input className={inputClass} type="number" step="1" value={draft.lagDays} onChange={event => setDraft(previous => ({ ...previous, lagDays: event.target.value }))} /></label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => { setDraft(emptyDraft); setSearch(''); setEditingId(null); setFormOpen(false) }} disabled={saving} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs"><X className="h-3.5 w-3.5" />{t('attachmentCancel')}</button>
        <button type="button" onClick={() => void save()} disabled={saving || !draft.dependsOnItemId} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{t('attachmentSave')}</button>
      </div>
    </div>}

    {loading && <p className="text-sm text-muted-foreground">{t('dependenciesLoading')}</p>}
    {!loading && dependencies.length === 0 && <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center"><Workflow className="h-5 w-5 text-muted-foreground" /><p className="text-sm text-muted-foreground">{t('dependenciesEmpty')}</p></div>}
    <ul className="space-y-2">{dependencies.map(dependency => <li key={dependency.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
      <Workflow className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{targetLabel(dependency.dependsOn)}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{dependency.dependencyType}</span><span>{typeLabel(dependency.dependencyType)}</span><ArrowRight className="h-3 w-3" /><span>{t('dependenciesLagDays', { days: dependency.lagDays })}</span></p>
      </div>
      {canEdit && <><button type="button" onClick={() => edit(dependency)} aria-label={t('dependenciesEdit')} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button><button type="button" disabled={removingId === dependency.id} onClick={() => void remove(dependency)} aria-label={t('dependenciesRemove')} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">{removingId === dependency.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></>}
    </li>)}</ul>
  </div>
}