import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, User, ChevronDown, RotateCcw } from 'lucide-react'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/formatters'

interface AuditLog {
  id: string
  type: 'auto'
  activity: string
  createdAt: string
  author: { id: string; name: string; avatarUrl: string | null } | null
  actorType?: 'HUMAN' | 'AGENT' | 'SYSTEM' | 'UNKNOWN'
  actorLabel?: string | null
  source?: 'REST' | 'MCP' | 'SYSTEM' | 'UNKNOWN'
}

interface Props {
  itemId: string
  projectId: string
  onCountChange?: (count: number) => void
}

function readableActivity(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function Actor({ log, t }: { log: AuditLog; t: (key: string) => string }) {
  const isAgent = log.actorType === 'AGENT' || log.source === 'MCP'
  const label = log.actorLabel ?? log.author?.name ?? (log.actorType === 'SYSTEM' ? t('accordion.system') : t('accordion.human'))
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {isAgent ? <Bot className="h-3.5 w-3.5 shrink-0 text-violet-500" /> : <User className="h-3.5 w-3.5 shrink-0 text-primary" />}
      <span className="truncate text-xs font-medium text-foreground">{label}</span>
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{isAgent ? t('accordion.agent') : log.actorType === 'SYSTEM' ? t('accordion.system') : t('accordion.human')}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground">{formatDateTime(log.createdAt)}</span>
    </div>
  )
}

export function ActivityLogPanel({ itemId, projectId, onCountChange }: Props) {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchLogs = useCallback(async (nextPage: number, append = false) => {
    setLoading(true)
    setError(false)
    try {
      const res = await api.get<{ data: AuditLog[]; total: number }>(`/projects/${projectId}/items/${itemId}/audit?page=${nextPage}&limit=20`)
      setLogs(previous => append ? [...previous, ...res.data] : res.data)
      setTotal(res.total)
      setPage(nextPage)
      onCountChange?.(res.total)
    } catch {
      setError(true)
      if (!append) { setLogs([]); setTotal(0); onCountChange?.(0) }
    } finally {
      setLoading(false)
    }
  }, [itemId, projectId, onCountChange])

  useEffect(() => { void fetchLogs(1) }, [fetchLogs])

  return (
    <section aria-labelledby={`activity-audit-title-${itemId}`} className="flex min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0"><h3 id={`activity-audit-title-${itemId}`} className="truncate text-sm font-semibold text-foreground">{t('accordion.activityHistoryTitle')}</h3><p className="text-xs text-muted-foreground">{t('accordion.activityCountMany', { count: total })}</p></div>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">{t('accordion.system')}</span>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {loading && logs.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">{t('loading')}</p>}
        {error && <div className="flex flex-col items-center gap-2 py-6 text-center"><p className="text-xs text-destructive">{t('accordion.auditError')}</p><button type="button" onClick={() => void fetchLogs(page)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary"><RotateCcw className="h-3.5 w-3.5" />{t('accordion.retry')}</button></div>}
        {!loading && !error && logs.length === 0 && <p className="py-6 text-center text-xs italic text-muted-foreground">{t('accordion.noAudit')}</p>}
        {logs.map(log => <article key={log.id} className="rounded-lg border border-border bg-background p-3"><Actor log={log} t={t} /><p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-foreground">{readableActivity(log.activity)}</p></article>)}
        {!error && logs.length < total && <button type="button" onClick={() => void fetchLogs(page + 1, true)} disabled={loading} className="flex w-full items-center justify-center gap-1 py-2 text-xs text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"><ChevronDown className="h-3.5 w-3.5" />{t('accordion.loadMore')} ({total - logs.length})</button>}
      </div>
    </section>
  )
}
