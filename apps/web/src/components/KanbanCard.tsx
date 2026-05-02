import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Trash2, GitBranch, Archive } from 'lucide-react'
import { UserAvatar } from './UserAvatar'
import { InlineEdit } from './InlineEdit'
import type { AncestorNode, Priority, TaskStatus, ItemType, ChecklistProgress } from '@azy-board/types'

const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

const TYPE_STYLES: Record<ItemType, { label: string; cls: string }> = {
  EPIC:  { label: 'Epic',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  STORY: { label: 'Story', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300' },
  TASK:  { label: 'Task',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  BUG:   { label: 'Bug',   cls: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
}

const STATUS_INDICATOR: Record<TaskStatus, string> = {
  NOT_STARTED: '',
  IN_PROGRESS: 'border-l-blue-500',
  BLOCKED: 'border-l-red-500',
  DONE: 'border-l-emerald-500',
  CANCELLED: 'border-l-slate-400 opacity-60',
  ARCHIVED: 'border-l-slate-300 opacity-40',
}

export interface CardData {
  id: string
  title: string
  status: TaskStatus
  priority: Priority
  type?: ItemType | null
  points?: number | null
  ancestryPath: string // JSON
  assignee?: { id: string; name: string; avatarUrl: string | null } | null
  assigneeApiKey?: { aiModelName: string | null } | null
  taskTags?: Array<{ tag: { id: string; name: string; color: string } }>
  itemTags?: Array<{ tag: { id: string; name: string; color: string } }>
  isLeaf: boolean
  childrenCount?: number
  checklistProgress?: ChecklistProgress | null
}

interface Props {
  card: CardData
  onOpenDetail?: (id: string) => void
  onTitleSave?: (id: string, title: string) => void
  onDelete?: (id: string) => void
  onArchive?: (id: string) => void
}

export function KanbanCard({ card, onOpenDetail, onTitleSave, onDelete, onArchive }: Props) {
  const [breadcrumbOpen, setBreadcrumbOpen] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  const breadcrumbRef = useRef<HTMLDivElement>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current)
  }, [])

  function handleBreadcrumbEnter() {
    if (breadcrumbRef.current) {
      const rect = breadcrumbRef.current.getBoundingClientRect()
      setTooltipPos({ top: rect.bottom + 6, left: rect.left })
    }
    setBreadcrumbOpen(true)
  }

  function cancelScheduledOpen() {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
  }

  function openDetail() {
    cancelScheduledOpen()
    onOpenDetail?.(card.id)
  }

  function scheduleOpenDetail() {
    cancelScheduledOpen()
    openTimerRef.current = setTimeout(openDetail, 160)
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    // EPIC e STORY não são cards móveis; TASK/BUG pai (não folha) também não
    disabled: !card.isLeaf || (card.type != null && ['EPIC', 'STORY'].includes(card.type)),
  })

  const ancestry: AncestorNode[] = JSON.parse(card.ancestryPath || '[]')
  const breadcrumbText = ancestry.map(a => a.title).join(' › ')
  const truncated = breadcrumbText.length > 45

  return (
    // Div raiz: apenas setNodeRef + style (SEM attributes/listeners → sem role="button")
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={`relative group flex bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow border-l-4 ${STATUS_INDICATOR[card.status]} ${!card.isLeaf ? 'opacity-70' : ''}`}
    >
      {/* Botões de ação — visíveis só no hover */}
      <div className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
        {onArchive && (
          <button
            className="p-1 rounded text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50"
            title="Arquivar item"
            onClick={e => {
              e.stopPropagation()
              onArchive(card.id)
            }}
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
            title="Excluir item"
            onClick={e => {
              e.stopPropagation()
              if (window.confirm('Excluir este item e todos os seus filhos (subtasks, checklists)? Esta ação é permanente.')) {
                onDelete(card.id)
              }
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {/* ── Grip: único lugar com listeners + setActivatorNodeRef ── */}
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...(card.isLeaf ? listeners : {})}
        className={[
          'flex items-center px-1.5 flex-shrink-0 select-none transition-colors',
          card.isLeaf
            ? 'cursor-grab active:cursor-grabbing text-muted-foreground/25 hover:text-muted-foreground/60'
            : 'cursor-not-allowed text-muted-foreground/20',
        ].join(' ')}
        title={card.isLeaf ? 'Arrastar card' : undefined}
      >
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
          <circle cx="2.5" cy="2.5"  r="1.5" />
          <circle cx="7.5" cy="2.5"  r="1.5" />
          <circle cx="2.5" cy="8"    r="1.5" />
          <circle cx="7.5" cy="8"    r="1.5" />
          <circle cx="2.5" cy="13.5" r="1.5" />
          <circle cx="7.5" cy="13.5" r="1.5" />
        </svg>
      </div>

      {/* ── Conteúdo: clique abre modal (exceto na área do título) ── */}
      <div
        className={`flex-1 py-3 space-y-2 min-w-0 ${onDelete ? 'pr-7' : 'pr-3'} ${onOpenDetail ? 'cursor-pointer' : ''}`}
        onClick={openDetail}
      >
        {/* Breadcrumb — tooltip via portal para evitar clipping por stacking context do DnD */}
        {ancestry.length > 0 && (
          <div
            ref={breadcrumbRef}
            className="text-xs text-muted-foreground select-none"
            onMouseEnter={handleBreadcrumbEnter}
            onMouseLeave={() => setBreadcrumbOpen(false)}
          >
            {truncated ? `${breadcrumbText.slice(0, 42)}…` : breadcrumbText}
          </div>
        )}
        {breadcrumbOpen && truncated && createPortal(
          <div
            className="fixed z-[9999] bg-popover border border-border rounded-lg px-3 py-2 shadow-xl max-w-72 pointer-events-none"
            style={{ top: tooltipPos.top, left: tooltipPos.left }}
          >
            <div className="flex flex-wrap gap-1">
              {ancestry.map((node, i) => (
                <span key={node.id} className="text-xs text-muted-foreground">
                  {node.title}{i < ancestry.length - 1 && ' ›'}
                </span>
              ))}
            </div>
          </div>,
          document.body
        )}

        {/* Título — stopPropagation para NÃO abrir modal ao clicar; duplo clique = editar */}
        <div
          onClick={e => { e.stopPropagation(); scheduleOpenDetail() }}
          onDoubleClick={e => { e.stopPropagation(); cancelScheduledOpen() }}
        >
          {onTitleSave ? (
            <InlineEdit
              value={card.title}
              onSave={title => onTitleSave(card.id, title)}
              onEditStart={cancelScheduledOpen}
            />
          ) : (
            <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
              {card.title}
            </p>
          )}
        </div>

        {/* Tags */}
        {((card.itemTags ?? card.taskTags) ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(card.itemTags ?? card.taskTags ?? []).map(({ tag }) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Progresso de checklist */}
        {card.checklistProgress && card.checklistProgress.total > 0 && (() => {
          const { checked, total } = card.checklistProgress
          const pct = Math.round((checked / total) * 100)
          const done = checked === total
          return (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <svg className={`w-3 h-3 flex-shrink-0 ${done ? 'text-emerald-500' : 'text-muted-foreground'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className={`text-xs tabular-nums ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                  {checked}/{total}
                </span>
              </div>
              <div className="h-0.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-primary/60'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })()}

        {/* Rodapé */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-1.5">
            {card.type && TYPE_STYLES[card.type] && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_STYLES[card.type]!.cls}`}>
                {TYPE_STYLES[card.type]!.label}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[card.priority]}`}>
              {card.priority}
            </span>
            {card.points != null && (
              <span className="text-xs text-muted-foreground font-medium">{card.points}pt</span>
            )}
            {/* Indicador de filhos diretos */}
            {(card.childrenCount ?? 0) > 0 && (
              <span
                className="flex items-center gap-0.5 text-xs text-muted-foreground"
                title={`${card.childrenCount} subtasks`}
              >
                <GitBranch className="w-3 h-3" />
                {card.childrenCount}
              </span>
            )}
          </div>
          {card.assignee && (
            <UserAvatar
              user={{ name: card.assignee.name, avatarUrl: card.assignee.avatarUrl, aiModelName: card.assigneeApiKey?.aiModelName }}
              size="xs"
              showAiBadge={!!card.assigneeApiKey}
            />
          )}
        </div>
      </div>
    </div>
  )
}
