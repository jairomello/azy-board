import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Link2, Loader2, Pencil, Plus, Trash2, X, Check } from 'lucide-react'
import type { ItemLink } from '@azy-board/ui-contracts'
import type { AssistantFocusEntity } from '@azy-board/assistant-contracts'
import { api } from '../lib/api'
import { onAssistantMutation } from '../lib/dataEvents'
import { MarkdownText } from './MarkdownText'
import { useToast } from './Toast'

interface Props { itemId: string; projectId: string; canEdit: boolean; onEntityFocus?: (entity: AssistantFocusEntity | null) => void }
interface Draft { name: string; url: string; description: string }
const emptyDraft: Draft = { name: '', url: '', description: '' }

export function ItemLinksArea({ itemId, projectId, canEdit, onEntityFocus }: Props) {
  const { t } = useTranslation('board')
  const { toast } = useToast()
  const [links, setLinks] = useState<ItemLink[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [revision, setRevision] = useState(0)
  const baseUrl = `/projects/${projectId}/items/${itemId}/links`

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try { setLinks(await api.get<ItemLink[]>(baseUrl, { signal })) }
    catch (error) { if ((error as { name?: string }).name !== 'AbortError') toast(t('itemLinksLoadError'), 'error') }
    finally { setLoading(false) }
  }, [baseUrl, t, toast])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load, revision])

  // Card T22 — mutação de link concluída pelo assistente recarrega a aba sem
  // recarregamento manual. Filtra pelo item/projeto quando o resultado os expõe.
  useEffect(() => onAssistantMutation(({ toolName, result }) => {
    if (!/_item_link$/.test(toolName)) return
    const payload = result && typeof result === 'object' ? result as Record<string, unknown> : null
    if (typeof payload?.projectId === 'string' && payload.projectId !== projectId) return
    if (typeof payload?.itemId === 'string' && payload.itemId !== itemId) return
    setRevision(previous => previous + 1)
  }), [itemId, projectId])

  async function save() {
    setSaving(true)
    try {
      if (editingId) {
        const updated = await api.patch<ItemLink>(`${baseUrl}/${editingId}`, draft)
        setLinks(previous => previous.map(link => link.id === updated.id ? updated : link))
      } else {
        const created = await api.post<ItemLink>(baseUrl, draft)
        setLinks(previous => [...previous, created])
      }
      setDraft(emptyDraft)
      setEditingId(null)
      setFormOpen(false)
      onEntityFocus?.(null)
    } catch (error) { toast(error instanceof Error ? error.message : t('itemLinksSaveError'), 'error') }
    finally { setSaving(false) }
  }

  async function remove(link: ItemLink) {
    if (!confirm(t('itemLinksRemoveConfirm', { name: link.name }))) return
    setRemovingId(link.id)
    try { await api.delete(`${baseUrl}/${link.id}`); setLinks(previous => previous.filter(row => row.id !== link.id)) }
    catch { toast(t('itemLinksRemoveError'), 'error') }
    finally { setRemovingId(null) }
  }

  function edit(link: ItemLink) {
    setEditingId(link.id)
    setDraft({ name: link.name, url: link.url, description: link.description ?? '' })
    onEntityFocus?.({ kind: 'link', id: link.id })
  }

  const inputClass = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">{t('itemLinksHint')}</p>
      {canEdit && !editingId && !formOpen && <button type="button" onClick={() => { setDraft(emptyDraft); setFormOpen(true) }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Plus className="h-3.5 w-3.5" />{t('itemLinksAdd')}</button>}
    </div>
    {canEdit && (editingId || formOpen) && <div className="space-y-3 rounded-lg border border-border p-3">
      <label className="block space-y-1"><span className="text-xs font-medium">{t('itemLinksName')}</span><input className={inputClass} maxLength={200} required value={draft.name} onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))} /></label>
      <label className="block space-y-1"><span className="text-xs font-medium">{t('itemLinksUrl')}</span><input className={inputClass} type="url" required maxLength={2048} placeholder="https://" value={draft.url} onChange={event => setDraft(previous => ({ ...previous, url: event.target.value }))} /></label>
      <label className="block space-y-1"><span className="text-xs font-medium">{t('itemLinksDescription')}</span><textarea className={inputClass} maxLength={20000} rows={3} value={draft.description} onChange={event => setDraft(previous => ({ ...previous, description: event.target.value }))} /></label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => { setDraft(emptyDraft); setEditingId(null); setFormOpen(false); onEntityFocus?.(null) }} disabled={saving} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs"><X className="h-3.5 w-3.5" />{t('attachmentCancel')}</button>
        <button type="button" onClick={() => void save()} disabled={saving || !draft.name.trim() || !draft.url.trim()} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{t('attachmentSave')}</button>
      </div>
    </div>}
    {loading && <p className="text-sm text-muted-foreground">{t('itemLinksLoading')}</p>}
    {!loading && links.length === 0 && <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center"><Link2 className="h-5 w-5 text-muted-foreground" /><p className="text-sm text-muted-foreground">{t('itemLinksEmpty')}</p></div>}
    <ul className="space-y-2">{links.map(link => <li key={link.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
      <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1"><a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-sm font-medium text-primary hover:underline">{link.name}<ExternalLink className="h-3 w-3 shrink-0" /></a><p className="truncate text-xs text-muted-foreground">{link.url}</p>{link.description && <div className="mt-2 text-xs text-muted-foreground"><MarkdownText content={link.description} /></div>}</div>
      {canEdit && <><button type="button" onClick={() => edit(link)} aria-label={t('itemLinksEdit')} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button><button type="button" disabled={removingId === link.id} onClick={() => void remove(link)} aria-label={t('itemLinksRemove')} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">{removingId === link.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></>}
    </li>)}</ul>
  </div>
}
