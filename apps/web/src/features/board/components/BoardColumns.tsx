import { Fragment, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import { AddCardForm } from '../../../components/AddCardForm'
import { KanbanCard } from '../../../components/KanbanCard'
import { CardDropPlaceholder } from './CardDropPlaceholder'
import { useBoardDragAnimationValue } from '../hooks/useBoardDragAnimation'
import { useCardFlip } from '../hooks/useCardFlip'
import { CARD_REORDER_TRANSITION } from '../model/dragAnimation'
import type { ItemType } from '@azy-board/domain'
import type { Column, ItemData, Sprint } from '../model/types'
import { cardAdvance, columnAdvanceBands } from '../model/cardAdvance'
import { sortBoardItemsByPosition } from '../model/interaction'
import type { ProjectVersion } from '../../../components/ItemModal'

interface BoardColumnsProps {
  laneId: string
  columns: Column[]
  versions: ProjectVersion[]
  sprints: Sprint[]
  tasks: ItemData[]
  parentId?: string
  allowAdd?: boolean
  columnAddForms: Record<string, boolean>
  onShowAddForm: (formKey: string) => void
  onHideAddForm: (formKey: string) => void
  onCardCreate: (colId: string, title: string, type: ItemType, parentId?: string, formKey?: string, versionId?: string, sprintId?: string) => Promise<void>
  onOpenDetail: (id: string) => void
  onTitleSave: (id: string, title: string) => void
  onDelete?: (id: string) => void
  onArchive?: (id: string) => void
  // Card T49 — itens do caminho crítico a destacar.
  criticalIds?: ReadonlySet<string> | null
}

export function BoardColumns({
  laneId,
  columns,
  versions,
  sprints,
  tasks,
  parentId,
  allowAdd = true,
  columnAddForms,
  onShowAddForm,
  onHideAddForm,
  onCardCreate,
  onOpenDetail,
  onTitleSave,
  onDelete,
  onArchive,
  criticalIds = null,
}: BoardColumnsProps) {
  const { t } = useTranslation('board')

  const columnSortableIds = columns.map(column => `${laneId}:col:${column.id}`)
  // Faixas de avanço resolvidas uma vez por render; cada card usa a faixa da sua coluna.
  const advanceBands = columnAdvanceBands(columns)
  // Card T89 — o destaque de destino e a vaga vêm do ponteiro e da prévia. Sem o
  // arraste instrumentado (outras telas ou testes), a coluna volta a usar o `isOver`
  // do dnd-kit: `undefined` aqui significa "não há arraste instrumentado".
  const dragAnimation = useBoardDragAnimationValue()
  const preview = dragAnimation?.preview ?? null
  const activeTargetId = dragAnimation ? preview?.targetId ?? null : undefined
  const activeId = dragAnimation?.activeId ?? null
  const dragging = Boolean(dragAnimation?.dragging)

  // O deslizamento dos cards é do quadro, não do sortable: o dnd-kit não desloca
  // itens entre listas, e a prévia precisa valer em qualquer destino.
  const containerRef = useRef<HTMLDivElement | null>(null)
  useCardFlip(containerRef, {
    enabled: dragging && !dragAnimation?.reducedMotion,
    duration: CARD_REORDER_TRANSITION.duration,
    easing: CARD_REORDER_TRANSITION.easing,
  })

  return (
    <SortableContext id={`cols-${laneId}`} items={columnSortableIds} strategy={horizontalListSortingStrategy}>
      <div ref={containerRef} className="flex gap-3 overflow-x-auto pb-1" style={{ minHeight: 120 }}>
        {columns.map(column => {
          const columnTasks = sortBoardItemsByPosition(tasks.filter(task => task.columnId === column.id))
          const sortableId = `${laneId}:col:${column.id}`
          const formKey = `${laneId}:${column.id}`
          // O card arrastado sai da ordem visível: ele vira um nó sem espaço
          // (`.kanban-card--dragging`) e quem ocupa o lugar é a vaga.
          const outrasTasks = activeId ? columnTasks.filter(task => task.id !== activeId) : columnTasks
          const cardArrastado = activeId ? columnTasks.find(task => task.id === activeId) : undefined
          // Card B14 — o id da coluna se repete em todas as lanes; quem identifica a
          // instância é o alvo prefixado pela lane (`preview.targetId`). Comparar só a
          // coluna desenhava uma vaga em cada lane.
          const vagaEm = dragging && preview?.targetId === sortableId ? preview.index : -1
          const alturaDaVaga = preview?.height ?? 0
          const renderCard = (task: ItemData, arrastando = false) => (
            <KanbanCard key={task.id} card={task} advance={cardAdvance(advanceBands, task)} onOpenDetail={onOpenDetail} onTitleSave={onTitleSave} onDelete={onDelete} onArchive={onArchive} critical={criticalIds?.has(task.id)} dragging={arrastando} />
          )
          return (
            <SortableColumn key={column.id} id={sortableId} colName={column.name} colCount={columnTasks.length} baseStatus={column.baseStatus}>
              <DroppableColumn droppableId={`${laneId}:drop:${column.id}`} isTarget={activeTargetId === undefined ? undefined : activeTargetId === sortableId}>
                {allowAdd && (
                  <div className="board-column-add px-3 pt-2.5">
                    {columnAddForms[formKey] ? (
                      <AddCardForm
                        versions={versions}
                        sprints={sprints}
                        onAdd={(title, type, versionId, sprintId) => onCardCreate(column.id, title, type, parentId, formKey, versionId, sprintId)}
                        onCancel={() => onHideAddForm(formKey)}
                      />
                    ) : (
                      <button onClick={() => onShowAddForm(formKey)} className="board-add-card w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition">
                        <Plus className="w-3.5 h-3.5" />
                        {t('addCard')}
                      </button>
                    )}
                  </div>
                )}
                <div className="board-column-cards flex-1 px-3 pt-2 pb-9 space-y-2">
                  <SortableContext id={`${laneId}-cards-${column.id}`} items={columnTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
                    {outrasTasks.map((task, index) => (
                      <Fragment key={task.id}>
                        {index === vagaEm && <CardDropPlaceholder height={alturaDaVaga} index={index} />}
                        {renderCard(task)}
                      </Fragment>
                    ))}
                    {vagaEm >= 0 && vagaEm >= outrasTasks.length && <CardDropPlaceholder height={alturaDaVaga} index={outrasTasks.length} />}
                    {/* Nó sem espaço do card arrastado: o dnd-kit mede o item ativo na
                        soltura, então ele continua montado enquanto o arraste dura. */}
                    {cardArrastado && renderCard(cardArrastado, true)}
                  </SortableContext>
                </div>
              </DroppableColumn>
            </SortableColumn>
          )
        })}
      </div>
    </SortableContext>
  )
}

function SortableColumn({ id, colName, colCount, baseStatus, children }: { id: string; colName: string; colCount: number; baseStatus: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const statusColor = baseStatus === 'DONE' ? 'bg-status-done' : baseStatus === 'BLOCKED' ? 'bg-status-blocked' : baseStatus === 'IN_PROGRESS' ? 'bg-status-progress' : 'bg-slate-400'

  return (
    <div ref={setNodeRef} data-drop-id={id} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : undefined }} className="board-column flex-shrink-0 w-[292px] bg-surface-raised border border-border/80 rounded-lg flex flex-col overflow-hidden">
      <div className="board-column-header px-3 py-2.5 cursor-grab active:cursor-grabbing select-none border-b border-border/70 bg-surface" {...attributes} {...listeners}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg className="w-2.5 h-2.5 text-muted-foreground/40 flex-shrink-0" fill="currentColor" viewBox="0 0 8 16"><circle cx="2" cy="2" r="1.5" /><circle cx="6" cy="2" r="1.5" /><circle cx="2" cy="8" r="1.5" /><circle cx="6" cy="8" r="1.5" /><circle cx="2" cy="14" r="1.5" /><circle cx="6" cy="14" r="1.5" /></svg>
            <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
            <span className="text-[11px] font-semibold text-foreground uppercase tracking-[0.08em]">{colName}</span>
          </div>
          <span className="board-column-count min-w-5 h-5 px-1 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground inline-flex items-center justify-center">{colCount}</span>
        </div>
      </div>
      {children}
    </div>
  )
}

function DroppableColumn({ droppableId, isTarget, children }: { droppableId: string; isTarget?: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId })
  // Card T89 — o destaque de destino segue o ponteiro (dnd-kit entrega `isOver` do
  // `pointerWithin`), não o `over`, e por isso pode ser desligado de fora.
  const highlighted = isTarget ?? isOver
  return <div ref={setNodeRef} className={`board-column-dropzone flex-1 flex flex-col min-h-24 transition-colors ${highlighted ? 'board-column-dropzone--over' : ''}`}>{children}</div>
}
