import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Clock3, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import type { WorkLog } from '@azy-board/types'
import { formatWorkDuration, parseWorkDuration } from '../lib/workLog'

interface Props {
  itemId: string
  itemTitle: string
  projectId: string
  currentUserId: string
  currentUserRole: string
  onClose: () => void
  onCountChange?: (count: number) => void
  onTotalChange?: (total: number) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function WorkLogModal({ itemId, itemTitle, projectId, currentUserId, currentUserRole, onClose, onCountChange, onTotalChange }: Props) {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [activity, setActivity] = useState('')
  const [duration, setDuration] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ data: WorkLog[]; total: number }>(`/projects/${projectId}/items/${itemId}/work-log?limit=100`)
      setLogs(res.data)
      setTotal(res.total)
      onCountChange?.(res.total)
      onTotalChange?.(res.data.reduce((sum, log) => sum + (log.durationMin ?? 0), 0))
    } finally {
      setLoading(false)
    }
  }, [itemId, projectId, onCountChange, onTotalChange])

  useEffect(() => { fetchLogs().catch(() => setLogs([])) }, [fetchLogs])
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function saveLog() {
    const durationMin = duration ? parseWorkDuration(duration) : null
    if (!activity.trim() || (duration !== '' && durationMin == null) || saving) return
    setSaving(true)
    try {
      if (editing) await api.patch(`/projects/${projectId}/items/${itemId}/work-log/${editing}`, { activity: activity.trim(), duration: duration || null })
      else await api.post(`/projects/${projectId}/items/${itemId}/work-log`, { activity: activity.trim(), duration: duration || null })
      setActivity(''); setDuration(''); setEditing(null); setShowForm(false)
      await fetchLogs()
    } finally { setSaving(false) }
  }

  async function removeLog(logId: string) {
    if (!window.confirm('Excluir este registro de trabalho?')) return
    await api.delete(`/projects/${projectId}/items/${itemId}/work-log/${logId}`)
    await fetchLogs()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border p-4">
          <div><p className="mb-0.5 text-xs text-muted-foreground">Diário de trabalho</p><p className="max-w-xs truncate text-sm font-semibold text-foreground">{itemTitle}</p></div>
          <button onClick={onClose} aria-label="Fechar diário" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loading && logs.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Carregando...</p>}
          {!loading && logs.length === 0 && <p className="py-4 text-center text-xs italic text-muted-foreground">{t('accordion.noWorkLog')}</p>}
          {logs.map(log => {
            const canManage = log.authorId === currentUserId || currentUserRole === 'ADMIN'
            return <article key={log.id} className="rounded-lg border border-border bg-background p-3">
              {editing === log.id ? <div className="space-y-2">
                <textarea value={activity} onChange={e => setActivity(e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs outline-none focus:border-primary" />
                <input value={duration} onChange={e => setDuration(e.target.value)} placeholder={t('accordion.hoursPlaceholder')} aria-label={t('accordion.hoursPlaceholder')} className="w-32 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs outline-none focus:border-primary" />
                <div className="flex gap-2"><button onClick={saveLog} disabled={saving} className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs text-primary-foreground"><Check className="h-3 w-3" /> Salvar</button><button onClick={() => setEditing(null)} className="rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">Cancelar</button></div>
              </div> : <>
                <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-primary" /><span className="truncate text-xs font-medium">{log.author?.name ?? 'Usuário'}</span><span className="text-[10px] text-muted-foreground">{formatDate(log.createdAt)}</span></div>{canManage && <div className="flex gap-1"><button aria-label="Editar registro" onClick={() => { setEditing(log.id); setActivity(log.activity); setDuration(log.durationMin == null ? '' : formatWorkDuration(log.durationMin)) }} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button><button aria-label="Excluir registro" onClick={() => removeLog(log.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button></div>}</div>
                <p className="mt-2 whitespace-pre-line text-xs leading-relaxed">{log.activity}</p>
                {log.durationMin != null && <p className="mt-1 text-[10px] font-medium text-primary">{formatWorkDuration(log.durationMin)} trabalhadas</p>}
              </>}
            </article>
          })}
        </div>
        {showForm ? <div className="space-y-2 border-t border-border p-4"><textarea value={activity} onChange={e => setActivity(e.target.value)} rows={3} autoFocus placeholder="Descreva o trabalho realizado..." className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary" /><div className="flex items-center gap-2"><input value={duration} onChange={e => setDuration(e.target.value)} placeholder={t('accordion.hoursPlaceholder')} aria-label={t('accordion.hoursPlaceholder')} className="w-32 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary" /><button onClick={saveLog} disabled={saving || !activity.trim()} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground"><Check className="h-3 w-3" /> Salvar</button><button onClick={() => { setShowForm(false); setActivity(''); setDuration('') }} className="rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">Cancelar</button></div><p className="text-[10px] text-muted-foreground">{t('accordion.durationHelp')}</p></div> : <div className="border-t border-border p-3"><button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-xs text-primary hover:underline"><Plus className="h-3.5 w-3.5" /> {t('accordion.registerWork')}</button></div>}
      </div>
    </div>
  )
}
