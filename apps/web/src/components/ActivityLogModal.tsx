import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Pencil, Check, Bot, PenLine } from 'lucide-react'
import { api } from '../lib/api'

interface LogAuthor {
  id: string
  name: string
  avatarUrl: string | null
}

interface ItemLog {
  id: string
  type: 'auto' | 'manual'
  activity: string
  durationMin: number | null
  createdAt: string
  author: LogAuthor | null
}

interface Props {
  itemId: string
  itemTitle: string
  projectId: string
  currentUserId: string
  currentUserRole: string
  onClose: () => void
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function AuthorAvatar({ author }: { author: LogAuthor | null }) {
  if (!author) return <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center"><span className="text-[10px]">?</span></div>
  if (author.avatarUrl) return <img src={author.avatarUrl} alt={author.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
  return (
    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] font-bold text-primary">{author.name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

export function ActivityLogModal({ itemId, itemTitle, projectId, currentUserId, currentUserRole, onClose }: Props) {
  const [logs, setLogs] = useState<ItemLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newActivity, setNewActivity] = useState('')
  const [newDuration, setNewDuration] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editActivity, setEditActivity] = useState('')
  const [editDuration, setEditDuration] = useState('')

  const fetchLogs = useCallback(async (p: number, append = false) => {
    setLoading(true)
    try {
      const res = await api.get<{ data: ItemLog[]; total: number; page: number }>
        (`/projects/${projectId}/items/${itemId}/logs?page=${p}&limit=20`)
      setLogs(prev => append ? [...prev, ...res.data] : res.data)
      setTotal(res.total)
    } catch {
      // silenciar erro de carregamento
    } finally {
      setLoading(false)
    }
  }, [itemId, projectId])

  useEffect(() => { fetchLogs(1) }, [fetchLogs])

  async function handleAddLog() {
    if (!newActivity.trim() || saving) return
    setSaving(true)
    try {
      await api.post(`/projects/${projectId}/items/${itemId}/logs`, {
        activity: newActivity.trim(),
        durationMin: newDuration ? parseInt(newDuration) : null,
      })
      setNewActivity('')
      setNewDuration('')
      setShowForm(false)
      setPage(1)
      fetchLogs(1)
    } catch {
      // silenciar
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit(logId: string) {
    if (!editActivity.trim() || saving) return
    setSaving(true)
    try {
      await api.patch(`/projects/${projectId}/items/${itemId}/logs/${logId}`, {
        activity: editActivity.trim(),
        durationMin: editDuration ? parseInt(editDuration) : null,
      })
      setEditingId(null)
      fetchLogs(page)
    } catch {
      // silenciar
    } finally {
      setSaving(false)
    }
  }

  function startEdit(log: ItemLog) {
    setEditingId(log.id)
    setEditActivity(log.activity)
    setEditDuration(log.durationMin ? String(log.durationMin) : '')
  }

  function canEdit(log: ItemLog): boolean {
    if (log.type === 'auto') return false
    return log.author?.id === currentUserId || currentUserRole === 'ADMIN'
  }

  function loadMore() {
    const nextPage = page + 1
    setPage(nextPage)
    fetchLogs(nextPage, true)
  }

  // Fechar com Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Histórico de atividades</p>
            <p className="text-sm font-semibold text-foreground truncate max-w-xs">{itemTitle}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition flex-shrink-0 ml-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de logs */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && logs.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
          )}
          {!loading && logs.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4 italic">Nenhuma atividade registrada ainda.</p>
          )}

          {logs.map(log => (
            <div key={log.id} className="flex gap-2.5">
              <AuthorAvatar author={log.author} />
              <div className="flex-1 min-w-0">
                {editingId === log.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editActivity}
                      onChange={e => setEditActivity(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-border rounded-lg bg-background resize-none outline-none focus:border-primary"
                      rows={2}
                    />
                    <div className="flex gap-2 items-center">
                      <input
                        type="number" min="0"
                        value={editDuration}
                        onChange={e => setEditDuration(e.target.value)}
                        placeholder="Duração (min)"
                        className="w-32 text-xs px-2.5 py-1.5 border border-border rounded-lg bg-background outline-none focus:border-primary"
                      />
                      <button onClick={() => handleSaveEdit(log.id)} disabled={saving}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition">
                        <Check className="w-3 h-3" /> Salvar
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="text-xs px-2.5 py-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {log.type === 'auto'
                          ? <Bot className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          : <PenLine className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        }
                        <span className="text-xs font-medium text-foreground truncate">{log.author?.name ?? 'Sistema'}</span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatDate(log.createdAt)}</span>
                      </div>
                      {canEdit(log) && (
                        <button onClick={() => startEdit(log)}
                          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition p-0.5">
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-foreground mt-0.5 leading-relaxed">{log.activity}</p>
                    {log.durationMin != null && (
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">
                        ⏱ {formatDuration(log.durationMin)}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Tarefa 11.6 — Carregar mais */}
          {logs.length < total && (
            <button onClick={loadMore} disabled={loading}
              className="w-full text-xs text-primary hover:underline py-2 disabled:opacity-50">
              Carregar mais ({total - logs.length} restantes)
            </button>
          )}
        </div>

        {/* Formulário de novo log */}
        {showForm && (
          <div className="border-t border-border p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Registrar atividade</p>
            <textarea
              value={newActivity}
              onChange={e => setNewActivity(e.target.value)}
              placeholder="Descreva a atividade realizada..."
              className="w-full text-xs px-2.5 py-2 border border-border rounded-lg bg-background resize-none outline-none focus:border-primary"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 items-center">
              <input
                type="number" min="0"
                value={newDuration}
                onChange={e => setNewDuration(e.target.value)}
                placeholder="Duração (min)"
                className="w-32 text-xs px-2.5 py-1.5 border border-border rounded-lg bg-background outline-none focus:border-primary"
              />
              <button onClick={handleAddLog} disabled={saving || !newActivity.trim()}
                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition">
                <Check className="w-3 h-3" /> Salvar
              </button>
              <button onClick={() => { setShowForm(false); setNewActivity(''); setNewDuration('') }}
                className="text-xs px-3 py-1.5 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        {!showForm && (
          <div className="border-t border-border p-3">
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <Plus className="w-3.5 h-3.5" />
              + Registrar atividade
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
