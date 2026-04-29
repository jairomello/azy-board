import { useState, useEffect, useCallback } from 'react'
import { X, Bug, CheckSquare, BookOpen, Layers } from 'lucide-react'
import { api } from '../lib/api'
import type { ProjectVersion } from '../pages/SettingsPage'
import type { ItemType } from '@azy-board/types'

interface VersionItem {
  id: string
  title: string
  type: ItemType
  status: string
  priority: string
  assigneeId: string | null
  assignee?: { id: string; name: string; avatarUrl: string | null } | null
}

interface Props {
  version: ProjectVersion
  projectId: string
  mode: 'view' | 'edit'
  onClose: () => void
  onSave: (data: Partial<ProjectVersion>) => Promise<void>
}

const STATUS_LABELS: Record<ProjectVersion['status'], string> = {
  PLANNED: 'Planejada',
  IN_DEV: 'Em desenvolvimento',
  RELEASED: 'Lançada',
  CANCELLED: 'Cancelada',
}

const STATUS_COLORS: Record<ProjectVersion['status'], string> = {
  PLANNED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  IN_DEV: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  RELEASED: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300',
}

function TypeIcon({ type }: { type: ItemType }) {
  if (type === 'BUG') return <Bug className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
  if (type === 'EPIC') return <Layers className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
  if (type === 'STORY') return <BookOpen className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
  return <CheckSquare className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
}

export function VersionDetailModal({ version, projectId, mode, onClose, onSave }: Props) {
  const [editName, setEditName] = useState(version.name)
  const [editDate, setEditDate] = useState(version.releaseDate ?? '')
  const [editDesc, setEditDesc] = useState(version.description ?? '')
  const [editStatus, setEditStatus] = useState<ProjectVersion['status']>(version.status)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<VersionItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingItems, setLoadingItems] = useState(true)

  const fetchItems = useCallback(async (p: number, append = false) => {
    setLoadingItems(true)
    try {
      const res = await api.get<{ data: VersionItem[]; total: number }>(
        `/projects/${projectId}/versions/${version.id}/items?page=${p}&limit=20`
      )
      setItems(prev => append ? [...prev, ...res.data] : res.data)
      setTotal(res.total)
    } catch {
      // silenciar
    } finally {
      setLoadingItems(false)
    }
  }, [projectId, version.id])

  useEffect(() => { fetchItems(1) }, [fetchItems])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      await onSave({
        name: editName.trim(),
        releaseDate: editDate || null,
        description: editDesc || null,
        status: editStatus,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">
              {mode === 'edit' ? 'Editar versão' : 'Detalhes da versão'}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{version.name}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[version.status]}`}>
                {STATUS_LABELS[version.status]}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition ml-2 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Campos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground block mb-1">Nome</label>
              {mode === 'edit' ? (
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              ) : (
                <p className="text-sm text-foreground">{version.name}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Data de lançamento</label>
              {mode === 'edit' ? (
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              ) : (
                <p className="text-sm text-foreground">
                  {version.releaseDate ? new Date(version.releaseDate).toLocaleDateString('pt-BR') : '—'}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Situação</label>
              {mode === 'edit' ? (
                <select value={editStatus} onChange={e => setEditStatus(e.target.value as ProjectVersion['status'])}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {(Object.keys(STATUS_LABELS) as ProjectVersion['status'][]).map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              ) : (
                <span className={`text-xs px-2 py-1 rounded-full font-medium inline-block ${STATUS_COLORS[version.status]}`}>
                  {STATUS_LABELS[version.status]}
                </span>
              )}
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground block mb-1">Descrição</label>
              {mode === 'edit' ? (
                <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                  placeholder="Descrição opcional"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              ) : (
                <p className="text-sm text-foreground">{version.description || <span className="text-muted-foreground">—</span>}</p>
              )}
            </div>
          </div>

          {/* Itens vinculados */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Itens desta versão {total > 0 && <span className="text-foreground">({total})</span>}
            </p>
            {loadingItems && items.length === 0 && (
              <p className="text-xs text-muted-foreground">Carregando...</p>
            )}
            {!loadingItems && items.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Nenhum item vinculado a esta versão.</p>
            )}
            <div className="space-y-1.5">
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg">
                  <TypeIcon type={item.type} />
                  <span className="text-xs text-foreground flex-1 truncate">{item.title}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{item.status}</span>
                  {item.assignee && (
                    item.assignee.avatarUrl ? (
                      <img src={item.assignee.avatarUrl} alt={item.assignee.name} className="w-5 h-5 rounded-full flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-primary">{item.assignee.name.charAt(0)}</span>
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
            {items.length < total && (
              <button onClick={() => { const next = page + 1; setPage(next); fetchItems(next, true) }}
                disabled={loadingItems}
                className="mt-2 w-full text-xs text-primary hover:underline disabled:opacity-50">
                Carregar mais ({total - items.length} restantes)
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        {mode === 'edit' && (
          <div className="flex gap-2 p-4 border-t border-border">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={onClose}
              className="flex-1 py-2 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition">
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
