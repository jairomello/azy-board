import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Clock3, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import type { WorkLog } from '@azy-board/types'
import { formatWorkDuration, parseWorkDuration } from '../lib/workLog'
import { formatDateTime } from '../lib/formatters'

interface Props {
  itemId: string
  projectId: string
  currentUserId: string
  currentUserRole: string
  onCountChange?: (count: number) => void
  onTotalChange?: (total: number | null) => void
}

export function WorkLogPanel({ itemId, projectId, currentUserId, currentUserRole, onCountChange, onTotalChange }: Props) {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [activity, setActivity] = useState('')
  const [duration, setDuration] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await api.get<{ data: WorkLog[]; total: number }>(`/projects/${projectId}/items/${itemId}/work-log?limit=100`)
      setLogs(res.data)
      setTotal(res.total)
      onCountChange?.(res.total)
      onTotalChange?.(res.data.reduce((sum, log) => sum + (log.durationMin ?? 0), 0) || null)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [itemId, projectId, onCountChange, onTotalChange])

  useEffect(() => { void fetchLogs() }, [fetchLogs])

  function resetEditor() {
    setShowForm(false); setActivity(''); setDuration(''); setEditing(null); setFormError('')
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape' && (showForm || editing)) { event.stopPropagation(); resetEditor() }
  }

  function startEdit(log: WorkLog) {
    setEditing(log.id); setShowForm(false); setFormError(''); setActivity(log.activity); setDuration(log.durationMin == null ? '' : formatWorkDuration(log.durationMin))
  }

  async function saveLog() {
    const durationMin = duration ? parseWorkDuration(duration) : null
    if (!activity.trim()) { setFormError(t('accordion.descriptionRequired')); return }
    if (duration !== '' && durationMin == null) { setFormError(t('accordion.invalidDuration')); return }
    if (saving) return
    setSaving(true); setFormError('')
    try {
      if (editing) await api.patch(`/projects/${projectId}/items/${itemId}/work-log/${editing}`, { activity: activity.trim(), duration: duration || null })
      else await api.post(`/projects/${projectId}/items/${itemId}/work-log`, { activity: activity.trim(), duration: duration || null })
      resetEditor(); await fetchLogs()
    } catch { setFormError(t('accordion.workLogError')) } finally { setSaving(false) }
  }

  async function removeLog(logId: string) {
    if (!window.confirm(t('board:deleteWorkLogConfirmation'))) return
    try { await api.delete(`/projects/${projectId}/items/${itemId}/work-log/${logId}`); await fetchLogs() } catch { setError(true) }
  }

  const form = <div className="space-y-2 border-t border-border p-3" onKeyDown={handleKeyDown}>
    <textarea value={activity} onChange={event => setActivity(event.target.value)} rows={3} autoFocus={!editing} aria-label={t('board:activityPlaceholder')} placeholder={t('board:activityPlaceholder')} className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30" />
    <div className="flex flex-wrap items-center gap-2"><input value={duration} onChange={event => setDuration(event.target.value)} placeholder={t('accordion.hoursPlaceholder')} aria-label={t('accordion.hoursPlaceholder')} className="w-32 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30" /><button type="button" onClick={() => void saveLog()} disabled={saving || !activity.trim()} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"><Check className="h-3 w-3" />{t('board:save')}</button><button type="button" onClick={resetEditor} className="inline-flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground"><X className="h-3 w-3" />{t('board:cancel')}</button></div>
    <p className="text-[10px] text-muted-foreground">{t('accordion.durationHelp')}</p>
    {formError && <p role="alert" className="text-xs text-destructive">{formError}</p>}
  </div>

  return (
    <section aria-labelledby={`activity-work-title-${itemId}`} className="flex min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card" onKeyDown={handleKeyDown}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3"><div className="min-w-0"><h3 id={`activity-work-title-${itemId}`} className="truncate text-sm font-semibold text-foreground">{t('accordion.workLog')}</h3><p className="text-xs text-muted-foreground">{t(total === 1 ? 'accordion.workLogCountOne' : 'accordion.workLogCountMany', { count: total })}{' · '}{formatWorkDuration(logs.reduce((sum, log) => sum + (log.durationMin ?? 0), 0))} {t('board:worked')}</p></div><Clock3 className="h-4 w-4 shrink-0 text-primary" /></header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {loading && logs.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">{t('loading')}</p>}
        {error && <div className="flex flex-col items-center gap-2 py-6 text-center"><p className="text-xs text-destructive">{t('accordion.workLogError')}</p><button type="button" onClick={() => void fetchLogs()} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><RotateCcw className="h-3.5 w-3.5" />{t('accordion.retry')}</button></div>}
        {!loading && !error && logs.length === 0 && <div className="py-6 text-center"><p className="text-xs italic text-muted-foreground">{t('accordion.noWorkLog')}</p>{!showForm && <button type="button" onClick={() => setShowForm(true)} className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"><Plus className="h-3.5 w-3.5" />{t('accordion.registerWork')}</button>}</div>}
        {logs.map(log => { const canManage = log.authorId === currentUserId || currentUserRole === 'ADMIN'; return <article key={log.id} className="rounded-lg border border-border bg-background p-3" onKeyDown={handleKeyDown}>{editing === log.id ? form : <><div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-primary" /><span className="truncate text-xs font-medium">{log.author?.name ?? t('accordion.human')}</span><span className="text-[10px] text-muted-foreground">{formatDateTime(log.createdAt)}</span></div>{canManage && <div className="flex gap-1"><button type="button" aria-label={t('edit')} onClick={() => startEdit(log)} className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"><Pencil className="h-3 w-3" /></button><button type="button" aria-label={t('delete')} onClick={() => void removeLog(log.id)} className="rounded p-1 text-muted-foreground hover:text-destructive focus-visible:ring-2 focus-visible:ring-primary"><Trash2 className="h-3 w-3" /></button></div>}</div><p className="mt-2 whitespace-pre-line text-xs leading-relaxed">{log.activity}</p>{log.durationMin != null && <p className="mt-1 text-[10px] font-medium text-primary">{formatWorkDuration(log.durationMin)} {t('board:worked')}</p>}</>}</article> })}
      </div>
      {!error && !showForm && !editing && <div className="border-t border-border p-3"><button type="button" onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"><Plus className="h-3.5 w-3.5" />{t('accordion.registerWork')}</button></div>}
      {showForm && form}
    </section>
  )
}
