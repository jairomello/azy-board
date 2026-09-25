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
import type { ItemType } from '@azy-board/domain'
import type { Column, ItemData, Sprint } from '../model/types'
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
}: BoardColumnsProps) {
  const columnSortableIds = columns.map(column => `${laneId}:col:${column.id}`)

  return (
    <SortableContext id={`cols-${laneId}`} items={columnSortableIds} strategy={horizontalListSortingStrategy}>
      <div className="flex gap-3 overflow-x-auto pb-1" style={{ minHeight: 120 }}>
        {columns.map(column => {
          const columnTasks = sortBoardItemsByPosition(tasks.filter(task => task.columnId === column.id))
          const sortableId = `${laneId}:col:${column.id}`
          const formKey = `${laneId}:${column.id}`
          return (
            <SortableColumn key={column.id} id={sortableId} colName={column.name} colCount={columnTasks.length} baseStatus={column.baseStatus}>
              <DroppableColumn droppableId={`${laneId}:drop:${column.id}`}>
                <div className="flex-1 px-3 pt-2.5 space-y-2">
                  <SortableContext id={`${laneId}-cards-${column.id}`} items={columnTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
                    {columnTasks.map(task => (
                      <KanbanCard key={task.id} card={task} onOpenDetail={onOpenDetail} onTitleSave={onTitleSave} onDelete={onDelete} onArchive={onArchive} />
                    ))}
                  </SortableContext>
                </div>
                <div className="p-2 mt-1">
                  {allowAdd && (columnAddForms[formKey] ? (
                    <AddCardForm
                      versions={versions}
                      sprints={sprints}
                      onAdd={(title, type, versionId, sprintId) => onCardCreate(column.id, title, type, parentId, formKey, versionId, sprintId)}
                      onCancel={() => onHideAddForm(formKey)}
                    />
                  ) : (
                    <button onClick={() => onShowAddForm(formKey)} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition">
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar card
                    </button>
                  ))}
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
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 10 : undefined }} className="flex-shrink-0 w-[292px] bg-surface-raised border border-border/80 rounded-lg flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 cursor-grab active:cursor-grabbing select-none border-b border-border/70 bg-surface" {...attributes} {...listeners}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg className="w-2.5 h-2.5 text-muted-foreground/40 flex-shrink-0" fill="currentColor" viewBox="0 0 8 16"><circle cx="2" cy="2" r="1.5" /><circle cx="6" cy="2" r="1.5" /><circle cx="2" cy="8" r="1.5" /><circle cx="6" cy="8" r="1.5" /><circle cx="2" cy="14" r="1.5" /><circle cx="6" cy="14" r="1.5" /></svg>
            <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
            <span className="text-[11px] font-semibold text-foreground uppercase tracking-[0.08em]">{colName}</span>
          </div>
          <span className="min-w-5 h-5 px-1 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground inline-flex items-center justify-center">{colCount}</span>
        </div>
      </div>
      {children}
    </div>
  )
}

function DroppableColumn({ droppableId, children }: { droppableId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId })
  return <div ref={setNodeRef} className={`flex-1 flex flex-col min-h-24 transition-colors ${isOver ? 'bg-primary/10' : ''}`}>{children}</div>
}
