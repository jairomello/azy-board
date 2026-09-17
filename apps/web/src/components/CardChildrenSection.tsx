import { useState, useEffect } from 'react'
import { BookOpen, Bug, CheckSquare, Layers, AlertCircle, AlertTriangle, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import type { Priority, ItemType } from '@azy-board/types'
import { itemTypeMeta } from '../lib/itemTypeMeta'

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
  onOpenChild: (childId: string, childType: ItemType) => void
  onCountChange?: (count: number) => void
  refreshKey?: number
  titleLabel?: string
  emptyLabel?: string
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

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Não iniciada',
  IN_PROGRESS: 'Em andamento',
  BLOCKED: 'Bloqueada',
  DONE: 'Concluída',
  CANCELLED: 'Cancelada',
}

function TypeIcon({ type }: { type: ItemType }) {
  if (type === 'BUG') return <Bug className="w-3.5 h-3.5 text-red-500" />
  if (type === 'STORY') return <BookOpen className="w-3.5 h-3.5 text-violet-500" />
  if (type === 'EPIC') return <Layers className="w-3.5 h-3.5 text-amber-500" />
  return <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
}

const CHILD_TYPE_BG: Record<ItemType, string> = {
  BUG: 'bg-red-100 dark:bg-red-950/40',
  STORY: 'bg-violet-100 dark:bg-violet-950/40',
  EPIC: 'bg-amber-100 dark:bg-amber-950/40',
  TASK: 'bg-blue-100 dark:bg-blue-950/40',
}

function PriorityIcon({ priority }: { priority: Priority }) {
  if (priority === 'CRITICAL') return <AlertCircle className="w-3 h-3 text-red-500" />
  if (priority === 'HIGH') return <AlertTriangle className="w-3 h-3 text-orange-500" />
  return null
}

export function CardChildrenSection({ itemId, projectId, onOpenChild, onCountChange, refreshKey = 0, titleLabel, emptyLabel }: Props) {
  const { t } = useTranslation('board')
  const sectionTitle = titleLabel ?? t('areaSubtasks')
  const sectionEmpty = emptyLabel ?? t('childrenEmptySubtasks')
  const [children, setChildren] = useState<ChildItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!itemId || itemId === '__new__') { setChildren([]); onCountChange?.(0); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    api.get<{ data: ChildItem[]; total: number }>(`/projects/${projectId}/items/${itemId}/children`)
      .then(res => {
        if (cancelled) return
        setChildren(res.data)
        onCountChange?.(res.data.length)
      })
      .catch(() => {
        if (cancelled) return
        setChildren([])
        onCountChange?.(0)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [itemId, projectId, refreshKey, onCountChange])

  if (loading) {
    return (
      <div className="pt-4 border-t border-border">
        <p className="text-xs font-medium text-muted-foreground mb-2">{sectionTitle}</p>
        <p className="text-xs text-muted-foreground">{t('loading')}</p>
      </div>
    )
  }

  return (
    <div className="pt-4 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        {sectionTitle} {children.length > 0 && <span className="ml-1 text-foreground">({children.length})</span>}
      </p>

      {children.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{sectionEmpty}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {children.map(child => (
            <button
              key={child.id}
              onClick={() => onOpenChild(child.id, child.type)}
              type="button"
              className="group relative flex min-h-[92px] items-start gap-3 overflow-hidden rounded-lg border border-border bg-muted/20 p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-background hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${CHILD_TYPE_BG[child.type]}`}>
                <TypeIcon type={child.type} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(itemTypeMeta(child.type).labelKey)}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground/70">#{child.id.slice(0, 8)}</span>
                </div>
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{child.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[child.priority]}`}>
                    {PRIORITY_LABELS[child.priority]}
                  </span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {STATUS_LABELS[child.status] ?? child.status}
                  </span>
                  {child.points != null && <span className="text-[10px] font-medium text-muted-foreground">{child.points} pt</span>}
                  {child.column && <span className="truncate text-[10px] text-muted-foreground">{child.column.name}</span>}
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end justify-between self-stretch gap-2">
                {child.assignee?.avatarUrl ? (
                  <img src={child.assignee.avatarUrl} alt={child.assignee.name}
                    className="h-6 w-6 rounded-full object-cover ring-2 ring-background" />
                ) : child.assignee ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 ring-2 ring-background">
                    <span className="text-[10px] font-bold text-primary">
                      {child.assignee.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                ) : null}
                <span className="flex items-center gap-1 text-muted-foreground transition-transform group-hover:translate-x-0.5">
                  <PriorityIcon priority={child.priority} />
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
