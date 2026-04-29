import { useState, useEffect } from 'react'
import { Bug, CheckSquare, AlertCircle, AlertTriangle, ChevronRight } from 'lucide-react'
import { api } from '../lib/api'
import type { Priority, ItemType } from '@azy-board/types'

interface ChildItem {
  id: string
  title: string
  type: ItemType
  priority: Priority
  status: string
  points: number | null
  assigneeId: string | null
  assignee?: { id: string; name: string; avatarUrl: string | null } | null
  column?: { id: string; name: string } | null
}

interface Props {
  itemId: string
  projectId: string
  onOpenChild: (childId: string) => void
}

const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
}

const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', CRITICAL: 'Crítica',
}

function TypeIcon({ type }: { type: ItemType }) {
  if (type === 'BUG') return <Bug className="w-3.5 h-3.5 text-red-500" />
  return <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
}

function PriorityIcon({ priority }: { priority: Priority }) {
  if (priority === 'CRITICAL') return <AlertCircle className="w-3 h-3 text-red-500" />
  if (priority === 'HIGH') return <AlertTriangle className="w-3 h-3 text-orange-500" />
  return null
}

export function CardChildrenSection({ itemId, projectId, onOpenChild }: Props) {
  const [children, setChildren] = useState<ChildItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!itemId || itemId === '__new__') { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    api.get<{ data: ChildItem[]; total: number }>(`/projects/${projectId}/items/${itemId}/children`)
      .then(res => { if (!cancelled) setChildren(res.data) })
      .catch(() => { if (!cancelled) setChildren([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [itemId, projectId])

  if (loading) {
    return (
      <div className="pt-4 border-t border-border">
        <p className="text-xs font-medium text-muted-foreground mb-2">Subtasks</p>
        <p className="text-xs text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="pt-4 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Subtasks {children.length > 0 && <span className="ml-1 text-foreground">({children.length})</span>}
      </p>

      {children.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhuma subtask criada</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {children.map(child => (
            <button
              key={child.id}
              onClick={() => onOpenChild(child.id)}
              className="flex items-start gap-2 p-2.5 rounded-lg border border-border bg-background hover:bg-muted/50 text-left transition-colors group"
            >
              <TypeIcon type={child.type} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate leading-tight">{child.title}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[child.priority]}`}>
                    {PRIORITY_LABELS[child.priority]}
                  </span>
                  {child.column && (
                    <span className="text-[10px] text-muted-foreground">{child.column.name}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {child.assignee?.avatarUrl ? (
                  <img src={child.assignee.avatarUrl} alt={child.assignee.name}
                    className="w-5 h-5 rounded-full object-cover" />
                ) : child.assignee ? (
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-primary">
                      {child.assignee.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                ) : null}
                <PriorityIcon priority={child.priority} />
                <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
