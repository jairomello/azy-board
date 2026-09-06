import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Bot, User, ChevronDown } from 'lucide-react'
import { api } from '../lib/api'

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
  itemTitle: string
  projectId: string
  onClose: () => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
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
  const label = log.actorLabel ?? log.author?.name ?? (log.actorType === 'SYSTEM' ? 'Sistema' : 'Usuário')
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {isAgent ? <Bot className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" /> : <User className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
      <span className="text-xs font-medium text-foreground truncate">{label}</span>
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
        {isAgent ? t('accordion.agent') : log.actorType === 'SYSTEM' ? t('accordion.system') : t('accordion.human')}
      </span>
      <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatDate(log.createdAt)}</span>
    </div>
  )
}

export function ActivityLogModal({ itemId, itemTitle, projectId, onClose }: Props) {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async (p: number, append = false) => {
    setLoading(true)
    try {
      const res = await api.get<{ data: AuditLog[]; total: number }>(
        `/projects/${projectId}/items/${itemId}/audit?page=${p}&limit=20`
      )
      setLogs(prev => append ? [...prev, ...res.data] : res.data)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }, [itemId, projectId])

  useEffect(() => { fetchLogs(1).catch(() => setLogs([])) }, [fetchLogs])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between p-4 border-b border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{t('accordion.activityHistoryTitle')}</p>
            <p className="text-sm font-semibold text-foreground truncate max-w-xs">{itemTitle}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar histórico" className="text-muted-foreground hover:text-foreground transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && logs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>}
          {!loading && logs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4 italic">{t('accordion.noAudit')}</p>}
          {logs.map(log => (
            <article key={log.id} className="rounded-lg border border-border bg-background p-3">
              <Actor log={log} t={t} />
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-foreground">{readableActivity(log.activity)}</p>
            </article>
          ))}
          {logs.length < total && (
            <button onClick={() => { const next = page + 1; setPage(next); fetchLogs(next, true).catch(() => undefined) }} disabled={loading} className="flex w-full items-center justify-center gap-1 py-2 text-xs text-primary hover:underline disabled:opacity-50">
              <ChevronDown className="h-3.5 w-3.5" /> {t('accordion.loadMore')} ({total - logs.length})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
