import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Trash2, GitBranch, Archive, Copy, Check } from 'lucide-react'
import { UserAvatar } from './UserAvatar'
import { InlineEdit } from './InlineEdit'
import { useToast } from './Toast'
import { formatCardReference } from '../lib/cardReference'
import { copyTextToClipboard } from '../lib/clipboard'
import type { ItemType, Priority, TaskStatus } from '@azy-board/domain'
import type { AncestorNode, ChecklistProgress } from '@azy-board/ui-contracts'
import { useTranslation } from 'react-i18next'
import { itemIconComponent } from '../lib/iconCatalog'

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
  NOT_STARTED: 'border-l-slate-300 dark:border-l-slate-600',
  IN_PROGRESS: 'border-l-status-progress',
  BLOCKED: 'border-l-status-blocked',
  DONE: 'border-l-status-done',
  CANCELLED: 'border-l-slate-400 opacity-60',
  ARCHIVED: 'border-l-slate-300 opacity-40',
}

export interface CardData {
  id: string
  title: string
  status: TaskStatus
  priority: Priority
  type?: ItemType | null
  sequenceCode?: string | null
  points?: number | null
  ancestryPath: string // JSON
  assignee?: { id: string; name: string; avatarUrl: string | null } | null
  authorId?: string | null
  author?: { id: string; name: string; avatarUrl: string | null } | null
  versionId?: string | null
  costCenterId?: string | null
  version?: { id: string; name: string; status?: string } | null
  assigneeApiKey?: { aiModelName: string | null } | null
  taskTags?: Array<{ tag: { id: string; name: string; color: string } }>
  itemTags?: Array<{ tag: { id: string; name: string; color: string } }>
  isLeaf: boolean
  childrenCount?: number
  checklistProgress?: ChecklistProgress | null
  icon?: string | null
  color?: string | null
}

interface Props {
  card: CardData
  onOpenDetail?: (id: string) => void
  onTitleSave?: (id: string, title: string) => void
  onDelete?: (id: string) => void
  onArchive?: (id: string) => void
}

export function KanbanCard({ card, onOpenDetail, onTitleSave, onDelete, onArchive }: Props) {
  const { t } = useTranslation('board')
  const { toast } = useToast()
  const [breadcrumbOpen, setBreadcrumbOpen] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  const [copied, setCopied] = useState(false)
  const breadcrumbRef = useRef<HTMLDivElement>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const CardIcon = card.icon ? itemIconComponent(card.icon) : null

  useEffect(() => () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
  }, [])

  async function handleCopyReference(event: React.MouseEvent) {
    event.stopPropagation()
    const ok = await copyTextToClipboard(formatCardReference(card))
    if (!ok) {
      toast(t('copyReferenceFailed'), 'error')
      return
    }
    setCopied(true)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), 1500)
  }

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
    // EPIC nunca é arrastável; STORY folha (sem filhos) pode ser arrastada como task
    disabled: !card.isLeaf || card.type === 'EPIC',
  })

  const ancestry: AncestorNode[] = JSON.parse(card.ancestryPath || '[]')
  const breadcrumbText = ancestry.map(a => a.title).join(' › ')
  const truncated = breadcrumbText.length > 45
  const tags = (card.itemTags ?? card.taskTags) ?? []
  const hasActionArea = Boolean(onArchive || onDelete)

  return (
    // Div raiz: apenas setNodeRef + style (SEM attributes/listeners → sem role="button")
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={`kanban-card relative group flex border-l-[3px] ${STATUS_INDICATOR[card.status]} ${!card.isLeaf ? 'opacity-70' : ''}`}
    >
      {/* ── Grip: único lugar com listeners + setActivatorNodeRef ── */}
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...(card.isLeaf ? listeners : {})}
        className={[
          'kanban-card-grip flex items-center px-1.5 flex-shrink-0 select-none transition-colors',
          card.isLeaf
            ? 'cursor-grab active:cursor-grabbing text-muted-foreground/25 hover:text-muted-foreground/60'
            : 'cursor-not-allowed text-muted-foreground/20',
        ].join(' ')}
        title={card.isLeaf ? t('dragCard') : undefined}
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
        className={`kanban-card-content flex-1 flex flex-col py-2.5 gap-2 min-w-0 pr-3 ${onOpenDetail ? 'cursor-pointer' : ''}`}
        onClick={openDetail}
      >
        {/* Topo: ícone do item + código curto à esquerda, área reservada às ações à direita */}
        <div className="kanban-card-topo flex items-center gap-2 min-w-0">
          {CardIcon ? <CardIcon className="h-[23px] w-[23px] flex-shrink-0" style={{ color: card.color ?? undefined }} /> : null}
          {card.sequenceCode && (
            <span className="min-w-0 truncate font-mono text-[11px] font-semibold tracking-wide text-muted-foreground">
              {card.sequenceCode}
            </span>
          )}
          {/* Ações: copiar, arquivar, excluir. Visíveis em hover e no foco por teclado. */}
          <div
            className={`ml-auto flex flex-shrink-0 items-center justify-end gap-0.5 opacity-0 pointer-events-none transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 ${hasActionArea ? 'w-[84px]' : ''}`}
          >
            {/* Copiar é somente-leitura: disponível para todos os papéis do board */}
            <button
              type="button"
              className="flex h-[26px] w-[26px] items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title={copied ? t('copiedReference') : t('copyItemReference')}
              aria-label={copied ? t('copiedReference') : t('copyItemReference')}
              onClick={e => { void handleCopyReference(e) }}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {onArchive && (
              <button
                type="button"
                className="flex h-[26px] w-[26px] items-center justify-center rounded text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title={t('archiveItem')}
                aria-label={t('archiveItem')}
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
                type="button"
                className="flex h-[26px] w-[26px] items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title={t('deleteItem')}
                aria-label={t('deleteItem')}
                onClick={e => {
                  e.stopPropagation()
                  if (window.confirm(t('deleteItemConfirmation'))) {
                    onDelete(card.id)
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Breadcrumb em linha própria, acima do título (tooltip via portal para evitar clipping do DnD) */}
        {ancestry.length > 0 && (
          <div
            ref={breadcrumbRef}
            className="kanban-card-breadcrumb text-xs text-muted-foreground select-none min-w-0 truncate"
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

        {/* Título em destaque — stopPropagation para NÃO abrir modal ao clicar; duplo clique = editar */}
        <div
          className="kanban-card-title"
          title={card.title}
          onClick={e => { e.stopPropagation(); scheduleOpenDetail() }}
          onDoubleClick={e => { e.stopPropagation(); cancelScheduledOpen() }}
        >
          {onTitleSave ? (
            <InlineEdit
              value={card.title}
              onSave={title => onTitleSave(card.id, title)}
              onEditStart={cancelScheduledOpen}
              className="text-sm font-semibold"
            />
          ) : (
            <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
              {card.title}
            </p>
          )}
        </div>

        {/* Etiquetas: tags à esquerda (podem quebrar linha), tipo textual único à direita */}
        {(tags.length > 0 || card.type) && (
          <div className="card-label-row flex items-start justify-between gap-2">
            <div className="card-tags flex flex-wrap gap-1 min-w-0">
              {tags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
            {card.type && TYPE_STYLES[card.type] && (
              <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_STYLES[card.type].cls}`}>
                {t(card.type === 'EPIC' ? 'typeEpic' : card.type === 'STORY' ? 'typeStory' : card.type === 'TASK' ? 'typeTask' : 'typeBug')}
              </span>
            )}
          </div>
        )}

        {/* Progresso de checklist — região própria entre etiquetas e rodapé */}
        {card.checklistProgress && card.checklistProgress.total > 0 && (() => {
          const { checked, total } = card.checklistProgress
          const pct = Math.round((checked / total) * 100)
          const done = checked === total
          return (
            <div className="checklist-progress space-y-0.5">
              <div className="progress-copy flex items-center gap-1.5">
                <svg className={`w-3 h-3 flex-shrink-0 ${done ? 'text-emerald-500' : 'text-muted-foreground'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span className={`text-xs tabular-nums ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                  {checked}/{total}
                </span>
              </div>
              {checked > 0 && (
                <div className="progress-track h-0.5 w-full rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-primary/60'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          )
        })()}

        {/* Rodapé com divisor: prioridade, pontos, subtarefas e responsável (quando presentes) */}
        <div className="kanban-card-footer flex items-center gap-1.5 border-t border-border pt-2">
          <span className={`priority text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[card.priority]}`}>
            {card.priority}
          </span>
          {card.points != null && (
            <span className="points text-xs text-muted-foreground font-medium">{card.points}pt</span>
          )}
          {/* Indicador de filhos diretos */}
          {(card.childrenCount ?? 0) > 0 && (
            <span
              className="children-count flex items-center gap-0.5 text-xs text-muted-foreground"
              title={`${card.childrenCount} ${t('showSubtasks').toLowerCase()}`}
            >
              <GitBranch className="w-3 h-3" />
              {card.childrenCount}
            </span>
          )}
          {card.assignee && (
            <div className="ml-auto">
              <UserAvatar
                user={{ name: card.assignee.name, avatarUrl: card.assignee.avatarUrl, aiModelName: card.assigneeApiKey?.aiModelName }}
                size="xs"
                showAiBadge={!!card.assigneeApiKey}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
