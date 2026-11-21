import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '@dnd-kit/sortable'
import { Trash2, GitBranch, Archive, Copy, Check, Workflow, Paperclip, Move, AlertTriangle } from 'lucide-react'
import { UserAvatar } from './UserAvatar'
import { InlineEdit } from './InlineEdit'
import { ProgressBar } from './ProgressBar'
import { useToast } from './Toast'
import { formatCardReference } from '../lib/cardReference'
import { formatTokens } from '../lib/formatters'
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
  EXTERNAL: { label: 'Dep. Externa', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
}

// B19 — ponto da etiqueta de status, na mesma família de cor da faixa lateral.
const STATUS_DOT: Record<TaskStatus, string> = {
  NOT_STARTED: 'bg-slate-400',
  PLANNED: 'bg-sky-400',
  IN_PROGRESS: 'bg-status-progress',
  IN_HOMOLOGATION: 'bg-amber-400',
  BLOCKED: 'bg-status-blocked',
  DONE: 'bg-status-done',
  CANCELLED: 'bg-slate-400',
  ARCHIVED: 'bg-slate-300',
}

const STATUS_INDICATOR: Record<TaskStatus, string> = {
  NOT_STARTED: 'border-l-slate-300 dark:border-l-slate-600',
  PLANNED: 'border-l-sky-400 dark:border-l-sky-500',
  IN_PROGRESS: 'border-l-status-progress',
  IN_HOMOLOGATION: 'border-l-amber-400 dark:border-l-amber-500',
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
  tokensTotal?: number | null
  ancestryPath: string // JSON
  assignee?: { id: string; name: string; avatarUrl: string | null } | null
  // Responsável externo sem conta: exibido quando não há usuário atribuído.
  assigneeLabel?: string | null
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
  // Card T46 — quantidade de itens dos quais este card depende diretamente.
  dependencyCount?: number
  // Card T84 — quantidade de anexos do card; ausente/zero omite o indicador.
  attachmentCount?: number | null
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
  // Card T49 — destaque visual de itens do caminho crítico.
  critical?: boolean
  // T75 — progresso do card (status + coluna), calculado pelo board. O checklist tem
  // barra própria e não altera este percentual.
  advance?: number
  // B19/novo — progresso das subtasks diretas (média de avanço), calculado pelo board.
  subtasksProgress?: { advance: number; total: number } | null
  // T89 — o quadro indica qual card saiu do fluxo durante o arraste; sem a prop vale
  // o `isDragging` do dnd-kit.
  dragging?: boolean
  // B19 — nome da coluna atual quando o status do card não combina com ela.
  statusMismatchColumn?: string | null
}

export function KanbanCard({ card, onOpenDetail, onTitleSave, onDelete, onArchive, critical = false, advance, subtasksProgress = null, dragging, statusMismatchColumn = null }: Props) {
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

  // Card T85 — EPIC nunca é arrastável; STORY folha (sem filhos) pode ser
  // arrastada como task. TASK/BUG com filhos também não: o status do pai é
  // derivado dos filhos. A mesma condição governa o arraste e a alça visível.
  const canDrag = card.isLeaf && card.type !== 'EPIC'

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    isDragging,
  } = useSortable({
    id: card.id,
    disabled: !canDrag,
  })

  /** Card fora do fluxo: quem desenha a vaga é o quadro. */
  const outOfFlow = dragging ?? isDragging

  const ancestry: AncestorNode[] = JSON.parse(card.ancestryPath || '[]')
  const breadcrumbText = ancestry.map(a => a.title).join(' › ')
  const truncated = breadcrumbText.length > 45
  const tags = (card.itemTags ?? card.taskTags) ?? []
  const hasActionArea = Boolean(onArchive || onDelete)

  // Card T89 — durante o arraste o card sai do fluxo: quem desenha a vaga de
  // destino é o próprio quadro (`CardDropPlaceholder`), na coluna e no índice que a
  // prévia resolve. A raiz continua no DOM porque o dnd-kit mede o nó ativo na
  // soltura, mas fica invisível e sem ocupar espaço, para o resto da lista fechar o
  // buraco e o deslizamento acontecer.
  return (
    // Div raiz: apenas setNodeRef + style (SEM attributes/listeners → sem role="button")
    <div
      ref={setNodeRef}
      data-card-id={card.id}
      className={outOfFlow
        ? 'kanban-card--dragging'
        : `kanban-card relative group flex border-l-[3px] ${STATUS_INDICATOR[card.status]} ${!card.isLeaf ? 'opacity-70' : ''} ${critical ? 'ring-2 ring-amber-400/80' : ''}`}
    >
      {outOfFlow ? null : (
        <>

      {/* ── Alça de arraste (Card T85): faixa de ~30 px, único lugar com
           listeners + setActivatorNodeRef. A largura, a transição e os estados
           (oculta em repouso, visível no ponteiro sobre o card, forte no
           ponteiro sobre a alça) vivem em `styles/globals.css`. ── */}
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...(canDrag ? listeners : {})}
        className={[
          'kanban-card-grip flex items-center px-1.5 flex-shrink-0 select-none',
          canDrag
            ? 'kanban-card-grip--draggable cursor-grab active:cursor-grabbing'
            : 'kanban-card-grip--static cursor-not-allowed',
        ].join(' ')}
        title={canDrag ? t('dragCard') : undefined}
        aria-label={canDrag ? t('dragCard') : undefined}
      >
        {canDrag ? (
          <Move className="h-4 w-4" aria-hidden />
        ) : (
          /* Card pai ou EPIC: a alça permanece visível com um símbolo estático,
             sem a seta de mover — não há convite ao arraste. */
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
            <circle cx="2.5" cy="2.5"  r="1.5" />
            <circle cx="7.5" cy="2.5"  r="1.5" />
            <circle cx="2.5" cy="8"    r="1.5" />
            <circle cx="7.5" cy="8"    r="1.5" />
            <circle cx="2.5" cy="13.5" r="1.5" />
            <circle cx="7.5" cy="13.5" r="1.5" />
          </svg>
        )}
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

        {/* Etiquetas: tags em faixa própria (uma linha, truncadas) e status/tipo embaixo */}
        {(tags.length > 0 || card.type) && (
          <div className="card-label-row flex flex-col gap-1.5">
            {tags.length > 0 && (
              <div className="card-tags flex min-w-0 items-center gap-1">
                {tags.slice(0, 2).map(({ tag }) => (
                  <span
                    key={tag.id}
                    title={tag.name}
                    className="kanban-card-tag inline-flex h-5 min-w-0 max-w-[8.5rem] items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium leading-none"
                    style={{ '--tag-color': tag.color } as React.CSSProperties}
                  >
                    <span className="kanban-card-tag__dot h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
                    <span className="min-w-0 truncate">{tag.name}</span>
                  </span>
                ))}
                {tags.length > 2 && (
                  <span
                    title={tags.slice(2).map(({ tag }) => tag.name).join(', ')}
                    aria-label={`+${tags.length - 2} ${t('tagsLabel')}`}
                    className="inline-flex h-5 shrink-0 items-center rounded-full border border-border bg-muted px-1.5 text-[11px] font-semibold leading-none text-muted-foreground"
                  >
                    +{tags.length - 2}
                  </span>
                )}
              </div>
            )}
            <div className="card-type-status flex items-center gap-1">
              {/* B19 — status do card em texto; em âmbar quando não combina com a coluna. */}
              {card.status && (
                <span
                  data-card-status={card.status}
                  data-status-mismatch={statusMismatchColumn ? 'true' : undefined}
                  title={statusMismatchColumn ? t('statusOutOfColumn', { column: statusMismatchColumn }) : undefined}
                  className={`card-status-chip inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 text-xs font-medium ${statusMismatchColumn
                    ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-400 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-500'
                    : 'bg-muted text-muted-foreground'}`}
                >
                  {statusMismatchColumn
                    ? <AlertTriangle className="w-3 h-3" aria-hidden />
                    : <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[card.status]}`} aria-hidden />}
                  {t(`common:status.${card.status}`, { defaultValue: card.status })}
                  {statusMismatchColumn && <span className="sr-only">{t('statusOutOfColumn', { column: statusMismatchColumn })}</span>}
                </span>
              )}
              {card.type && TYPE_STYLES[card.type] && (
                <span className={`inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded px-1.5 text-xs font-medium ${TYPE_STYLES[card.type].cls}`}>
                  {t(card.type === 'EPIC' ? 'typeEpic' : card.type === 'STORY' ? 'typeStory' : card.type === 'TASK' ? 'typeTask' : 'typeBug')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* T75 — região de progresso entre etiquetas e rodapé: progresso do card,
            checklist (quando houver itens) e subtasks (quando houver filhos válidos). */}
        {(() => {
          const checklist = card.checklistProgress && card.checklistProgress.total > 0 ? card.checklistProgress : null
          const percent = Math.max(0, Math.min(100, Math.round(advance ?? 0)))
          const checklistPercent = checklist ? Math.round((checklist.checked / checklist.total) * 100) : 0
          const subtasks = subtasksProgress && subtasksProgress.total > 0 ? subtasksProgress : null
          if (!checklist && percent === 0 && !subtasks) return null
          const checklistDone = checklist ? checklist.checked === checklist.total : false
          const subtasksCount = subtasks ? t('progressSubtasksCount', { count: subtasks.total }) : ''
          return (
            <div className="checklist-progress space-y-1">
              {percent > 0 && (
                <ProgressBar
                  value={percent}
                  label={t('progressAdvanceLabel', { percent })}
                />
              )}
              {checklist && (
                <div className="flex items-center gap-1.5">
                  <svg className={`w-3 h-3 flex-shrink-0 ${checklistDone ? 'text-emerald-500' : 'text-muted-foreground'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span className={`progress-copy text-xs tabular-nums whitespace-nowrap ${checklistDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {checklist.checked}/{checklist.total}
                  </span>
                  <ProgressBar
                    tone="checklist"
                    value={checklistPercent}
                    label={t('progressChecklistLabel', { checked: checklist.checked, total: checklist.total, percent: checklistPercent })}
                  />
                </div>
              )}
              {subtasks && (
                <div className="flex items-center gap-1.5">
                  <GitBranch className="w-3 h-3 flex-shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-xs tabular-nums whitespace-nowrap text-muted-foreground">
                    {subtasksCount} · {subtasks.advance}%
                  </span>
                  <ProgressBar
                    tone="subtasks"
                    value={subtasks.advance}
                    label={t('progressSubtasksLabel', { percent: subtasks.advance, countLabel: subtasksCount })}
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
          {card.tokensTotal != null && (
            <span className="tokens text-xs text-muted-foreground font-medium" title={`${card.tokensTotal} ${t('tokensLabel').toLowerCase()}`}>
              {formatTokens(card.tokensTotal)} {t('tokensLabel').toLowerCase()}
            </span>
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
          {/* Indicador de dependências: somente leitura, omitido quando zero */}
          {(card.dependencyCount ?? 0) > 0 && (
            <span
              className="dependencies-count flex items-center gap-0.5 text-xs text-muted-foreground"
              aria-label={t('dependenciesCardLabel', { count: card.dependencyCount })}
              title={t('dependenciesCardLabel', { count: card.dependencyCount })}
            >
              <Workflow className="w-3 h-3" />
              <span className="font-medium leading-none">{card.dependencyCount}</span>
            </span>
          )}
          {/* Indicador de anexos (Card T84): somente leitura, omitido quando zero ou ausente */}
          {(card.attachmentCount ?? 0) > 0 && (
            <span
              className="attachments-count flex items-center gap-0.5 text-xs text-muted-foreground"
              aria-label={t('attachmentsCardLabel', { count: card.attachmentCount ?? 0 })}
              title={t('attachmentsCardLabel', { count: card.attachmentCount ?? 0 })}
            >
              <Paperclip className="w-3 h-3" />
              <span className="font-medium leading-none">{card.attachmentCount ?? 0}</span>
            </span>
          )}
          {card.assignee ? (
            <div className="ml-auto">
              <UserAvatar
                user={{ name: card.assignee.name, avatarUrl: card.assignee.avatarUrl, aiModelName: card.assigneeApiKey?.aiModelName }}
                size="xs"
                showAiBadge={!!card.assigneeApiKey}
              />
            </div>
          ) : card.assigneeLabel ? (
            <span className="ml-auto max-w-[45%] truncate text-xs text-muted-foreground" title={card.assigneeLabel}>
              {card.assigneeLabel}
            </span>
          ) : null}
        </div>
      </div>
        </>
      )}
    </div>
  )
}
