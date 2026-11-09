import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import type { DragEvent as ReactDragEvent } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Bug as BugIcon, GripHorizontal, Loader2, Pencil, Plus } from 'lucide-react'
import { ApiError, api } from '../lib/api'
import { formatDateValue } from '../lib/formatters'
import { displayPersonName } from '../lib/personName'
import { invalidateTree, queryKeys } from '../lib/queryKeys'
import { buildScreenSnapshot } from '../lib/assistantSnapshot'
import { useAuth } from '../contexts/AuthContext'
import type { BoardFilterState } from '../components/BoardFilters'
import type { AssistantScreenSnapshot } from '@azy-board/assistant-contracts'
import type { Priority, TaskStatus } from '@azy-board/domain'

// Nó genérico da árvore retornado por /items/tree
export interface TreeNode {
  id: string
  title?: string
  name?: string       // módulos usam `name`
  type: string        // 'module' | 'EPIC' | 'STORY' | 'TASK' | 'BUG'
  status?: TaskStatus
  priority?: Priority
  points?: number
  progress?: number
  startDate?: string | null
  dueDate?: string | null
  versionId?: string | null
  costCenterId?: string | null
  sprintId?: string | null
  itemSprints?: Array<{ sprintId: string }>
  updatedAt?: string
  assignee?: { name: string; avatarUrl: string | null } | null
  assigneeId?: string | null
  moduleId?: string | null
  parentId?: string | null
  isLeaf?: boolean
  // Card T46 — itens dos quais a linha depende, com código/título para exibição.
  dependencies?: Array<{ id?: string; dependsOn?: { id?: string; title?: string; sequenceCode?: string | null } }>
  dependencyCount?: number
  children: TreeNode[]
}

const STATUS_COLOR: Record<string, string> = {
  NOT_STARTED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  BLOCKED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  DONE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  CANCELLED: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
}

const TYPE_ICON: Record<string, { label: string; cls: string }> = {
  EPIC:  { label: 'E', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  STORY: { label: 'S', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300' },
  TASK:  { label: 'T', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  BUG:   { label: 'B', cls: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
}

type TreeGridColumnId =
  | 'name'
  | 'status'
  | 'assignee'
  | 'points'
  | 'progress'
  | 'dependencies'
  | 'startDate'
  | 'dueDate'
  | 'priority'
  | 'sprint'
  | 'version'
  | 'costCenter'
  | 'actions'

interface TreeGridColumnDefinition {
  id: TreeGridColumnId
  labelKey: string
  defaultVisible: boolean
  locked?: boolean
}

type TreeGridColumnWidthMap = Partial<Record<TreeGridColumnId, number>>

// Largura do painel de colunas (w-72), usada para ancorá-lo sem estourar o card.
const COLUMN_MENU_WIDTH = 288

const TREE_GRID_COLUMNS: readonly TreeGridColumnDefinition[] = [
  { id: 'name', labelKey: 'tree.name', defaultVisible: true, locked: true },
  { id: 'status', labelKey: 'tree.status', defaultVisible: true },
  { id: 'assignee', labelKey: 'tree.assignee', defaultVisible: true },
  { id: 'points', labelKey: 'points', defaultVisible: true },
  { id: 'progress', labelKey: 'tree.advanceColumn', defaultVisible: true },
  { id: 'dependencies', labelKey: 'tree.dependencies', defaultVisible: true },
  { id: 'startDate', labelKey: 'tree.start', defaultVisible: true },
  { id: 'dueDate', labelKey: 'tree.endDate', defaultVisible: true },
  { id: 'priority', labelKey: 'tree.priority', defaultVisible: false },
  { id: 'sprint', labelKey: 'tree.sprint', defaultVisible: false },
  { id: 'version', labelKey: 'tree.version', defaultVisible: false },
  { id: 'costCenter', labelKey: 'tree.costCenter', defaultVisible: false },
  { id: 'actions', labelKey: 'tree.actions', defaultVisible: true, locked: true },
]

const TREE_GRID_COLUMN_MAP = new Map(TREE_GRID_COLUMNS.map(column => [column.id, column]))
const TREE_GRID_DEFAULT_ORDER = TREE_GRID_COLUMNS.map(column => column.id)
const TREE_GRID_COLUMN_DEFAULT_WIDTH: Record<TreeGridColumnId, number> = {
  name: 320,
  status: 170,
  assignee: 190,
  points: 90,
  progress: 120,
  dependencies: 160,
  startDate: 130,
  dueDate: 130,
  priority: 140,
  sprint: 160,
  version: 160,
  costCenter: 210,
  actions: 160,
}
const TREE_GRID_COLUMN_MIN_WIDTH: Record<TreeGridColumnId, number> = {
  name: 240,
  status: 130,
  assignee: 150,
  points: 78,
  progress: 100,
  dependencies: 120,
  startDate: 120,
  dueDate: 120,
  priority: 120,
  sprint: 140,
  version: 140,
  costCenter: 170,
  actions: 120,
}

function treeGridStorageKey(userId: string | undefined, projectId: string): string {
  return `tree-grid-columns:${userId ?? 'anonymous'}:${projectId}`
}

function treeGridWidthStorageKey(userId: string | undefined, projectId: string): string {
  return `tree-grid-widths:${userId ?? 'anonymous'}:${projectId}`
}

function normalizeTreeGridLayout(candidate: unknown, options?: { fillMissing?: boolean }): TreeGridColumnId[] {
  const fillMissing = options?.fillMissing ?? false
  const current = Array.isArray(candidate) ? candidate : TREE_GRID_DEFAULT_ORDER
  const ids: TreeGridColumnId[] = []
  for (const value of current) {
    if (typeof value !== 'string') continue
    if (!TREE_GRID_COLUMN_MAP.has(value as TreeGridColumnId)) continue
    const id = value as TreeGridColumnId
    if (!ids.includes(id)) ids.push(id)
  }
  if (fillMissing) {
    for (const id of TREE_GRID_DEFAULT_ORDER) {
      if (!ids.includes(id)) ids.push(id)
    }
  }
  if (ids.length === 0) ids.push(...TREE_GRID_COLUMNS.filter(column => column.defaultVisible).map(column => column.id))
  // Colunas estruturais sempre existem e ficam nas extremidades.
  const withoutLocked = ids.filter(id => id !== 'name' && id !== 'actions')
  return ['name', ...withoutLocked, 'actions']
}

function readTreeGridLayout(userId: string | undefined, projectId: string): TreeGridColumnId[] {
  try {
    const raw = localStorage.getItem(treeGridStorageKey(userId, projectId))
    if (!raw) return normalizeTreeGridLayout(TREE_GRID_COLUMNS.filter(column => column.defaultVisible).map(column => column.id))
    return normalizeTreeGridLayout(JSON.parse(raw))
  } catch {
    return normalizeTreeGridLayout(TREE_GRID_COLUMNS.filter(column => column.defaultVisible).map(column => column.id))
  }
}

function normalizeTreeGridWidths(candidate: unknown): TreeGridColumnWidthMap {
  if (!candidate || typeof candidate !== 'object') return {}
  const current = candidate as Record<string, unknown>
  const next: TreeGridColumnWidthMap = {}
  for (const column of TREE_GRID_COLUMNS) {
    const width = current[column.id]
    if (typeof width !== 'number' || !Number.isFinite(width)) continue
    const minWidth = TREE_GRID_COLUMN_MIN_WIDTH[column.id]
    next[column.id] = Math.max(minWidth, Math.min(960, Math.round(width)))
  }
  return next
}

function readTreeGridWidths(userId: string | undefined, projectId: string): TreeGridColumnWidthMap {
  try {
    const raw = localStorage.getItem(treeGridWidthStorageKey(userId, projectId))
    if (!raw) return {}
    return normalizeTreeGridWidths(JSON.parse(raw))
  } catch {
    return {}
  }
}

interface TreeMemberOption {
  userId: string
  name: string
}

interface TreeSprintOption {
  id: string
  name: string
  status: 'PROPOSED' | 'OPEN' | 'CLOSED'
}

interface TreeVersionOption {
  id: string
  name: string
}

interface TreeCostCenterOption {
  id: string
  code: string
  description?: string | null
}

type EditableCellStatus = 'idle' | 'saving' | 'error'
type TreeEditableField =
  | 'title'
  | 'status'
  | 'assigneeId'
  | 'points'
  | 'startDate'
  | 'dueDate'
  | 'priority'
  | 'sprintId'
  | 'versionId'
  | 'costCenterId'

function collectAllIds(nodes: TreeNode[]): Set<string> {
  const ids = new Set<string>()
  function traverse(n: TreeNode) {
    ids.add(n.id)
    n.children.forEach(traverse)
  }
  nodes.forEach(traverse)
  return ids
}

// Tarefa 11.5 — filtra recursivamente a árvore, removendo épicos sem filhos visíveis.
// Só aplica o filtro em nós do tipo EPIC dentro de módulos.
// Retorna null quando o nó deve ser removido.
function filterHideEmptyEpics(node: TreeNode): TreeNode | null {
  if (node.type === 'module') {
    const filteredChildren = node.children
      .map(filterHideEmptyEpics)
      .filter((c): c is TreeNode => c !== null)
    return { ...node, children: filteredChildren }
  }
  if (node.type === 'EPIC') {
    // Filtra os filhos do épico (stories/tasks) recursivamente
    const filteredChildren = node.children
      .map(filterHideEmptyEpics)
      .filter((c): c is TreeNode => c !== null)
    // Oculta épico se não tem filhos visíveis
    if (filteredChildren.length === 0) return null
    return { ...node, children: filteredChildren }
  }
  // Para STORY, TASK, BUG: mantém o nó, mas filtra filhos recursivamente
  const filteredChildren = node.children
    .map(filterHideEmptyEpics)
    .filter((c): c is TreeNode => c !== null)
  return { ...node, children: filteredChildren }
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(100, Math.round(progress)))
}

function parseNumericInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const numeric = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(numeric)) return null
  return Math.max(0, numeric)
}

function firstSprintId(node: TreeNode): string {
  return node.itemSprints?.[0]?.sprintId ?? node.sprintId ?? ''
}

function editableCellClass(state: EditableCellStatus): string {
  if (state === 'saving') return 'border-primary/60 bg-primary/5'
  if (state === 'error') return 'border-destructive/70 bg-destructive/5'
  return 'border-border bg-background'
}

// A grade é lida como tabela: o editor só materializa depois do clique na célula.
const CELL_TRIGGER_CLASS =
  'w-full rounded-md border border-transparent px-2 py-1 text-left transition hover:border-border/60 hover:bg-muted/40 focus-visible:outline-none focus-visible:border-border focus-visible:bg-muted/40'

function formatDateCell(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return formatDateValue(value)
  } catch {
    return value
  }
}

function StatusIndicator({ state }: { state: EditableCellStatus }) {
  if (state === 'saving') return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
  if (state === 'error') return <span className="text-[10px] text-destructive">!</span>
  return null
}

interface RowProps {
  itemId: string
  updatedAt?: string
  depth: number
  label: string
  type: string
  status?: TaskStatus
  priority?: Priority
  points?: number
  progress?: number
  startDate?: string | null
  dueDate?: string | null
  sprintId?: string
  versionId?: string | null
  costCenterId?: string | null
  assigneeId?: string | null
  assigneeName?: string | null
  dependencies?: Array<{ id?: string; dependsOn?: { id?: string; title?: string; sequenceCode?: string | null } }>
  expanded: boolean
  hasChildren: boolean
  canEdit: boolean
  visibleColumns: TreeGridColumnId[]
  members: TreeMemberOption[]
  sprints: TreeSprintOption[]
  versions: TreeVersionOption[]
  costCenters: TreeCostCenterOption[]
  cellStateFor: (itemId: string, field: TreeEditableField) => EditableCellStatus
  onPatchItem: (itemId: string, field: TreeEditableField, value: unknown, expectedUpdatedAt?: string) => Promise<void>
  onToggle: () => void
  // Tarefa 10.2 — callback de arquivamento na tree view (não disponível para módulos)
  onArchive?: () => void
  onEdit?: () => void
  onCreate?: (type: TreeCreationType, context: TreeActionContext) => void
}

export type TreeCreationType = 'MODULE' | 'EPIC' | 'STORY' | 'TASK' | 'BUG'

export interface TreeActionContext {
  parentId?: string
  moduleId?: string
}

function Row({
  itemId,
  updatedAt,
  depth,
  label,
  type,
  status,
  priority,
  points,
  progress,
  startDate,
  dueDate,
  sprintId,
  versionId,
  costCenterId,
  assigneeId,
  assigneeName,
  dependencies,
  expanded,
  hasChildren,
  canEdit,
  visibleColumns,
  members,
  sprints,
  versions,
  costCenters,
  cellStateFor,
  onPatchItem,
  onToggle,
  onArchive,
  onEdit,
  onCreate,
}: RowProps) {
  const { t } = useTranslation()
  const [editingField, setEditingField] = useState<TreeEditableField | null>(null)
  const indentPx = depth * 20
  const typeInfo = TYPE_ICON[type.toUpperCase()]
  const isModule = type === 'module'
  const editable = !isModule

  function isEditing(field: TreeEditableField) {
    return editingField === field
  }

  function stopEditing() {
    setEditingField(null)
  }

  function CellTrigger({ field, labelKey, align, children }: { field: TreeEditableField; labelKey: string; align?: 'right'; children: ReactNode }) {
    return (
      <button
        type="button"
        onClick={() => setEditingField(field)}
        aria-label={t('tree.editCell', { column: t(labelKey, { defaultValue: labelKey }), label })}
        className={`${CELL_TRIGGER_CLASS} ${align === 'right' ? 'text-right' : ''}`}
      >
        {children}
      </button>
    )
  }

  function renderNameColumn() {
    const titleState = cellStateFor(itemId, 'title')
    return (
      <td className="py-2 pr-2 text-sm" style={{ paddingLeft: `${16 + indentPx}px` }}>
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label={t(expanded ? 'tree.collapseNode' : 'tree.expandNode', { label })}
              aria-expanded={expanded}
              className="text-muted-foreground hover:text-foreground transition flex-shrink-0"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <span className="w-3.5 flex-shrink-0" />
          )}
          {typeInfo && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${typeInfo.cls}`}>
              {typeInfo.label}
            </span>
          )}
          {!editable || !canEdit ? (
            <span className={`font-medium ${
              type === 'module' ? 'text-foreground font-semibold' :
              type === 'EPIC' ? 'text-foreground' :
              type === 'STORY' ? 'text-muted-foreground' :
              'text-foreground text-sm'
            }`}>
              {label}
            </span>
          ) : (
            <div className="min-w-0 flex-1 flex items-center gap-1.5">
              {isEditing('title') ? (
                <input
                  autoFocus
                  key={`title-${itemId}-${label}`}
                  defaultValue={label}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                    if (event.key === 'Escape') {
                      event.currentTarget.value = label
                      event.currentTarget.blur()
                    }
                  }}
                  onBlur={(event) => {
                    const next = event.currentTarget.value.trim()
                    stopEditing()
                    if (!next || next === label) return
                    void onPatchItem(itemId, 'title', next, updatedAt)
                  }}
                  className={`h-7 w-full min-w-0 rounded-md border px-2 text-sm ${editableCellClass(titleState)}`}
                />
              ) : (
                <CellTrigger field="title" labelKey="tree.name">
                  <span className="block truncate font-medium text-foreground">{label}</span>
                </CellTrigger>
              )}
              <StatusIndicator state={titleState} />
            </div>
          )}
        </div>
      </td>
    )
  }

  function renderStatusColumn() {
    const state = cellStateFor(itemId, 'status')
    if (!editable || !canEdit) {
      return (
        <td className="py-2 px-2 text-sm">
          {status && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[status] ?? ''}`}>
              {t(`status.${status}`, { defaultValue: status })}
            </span>
          )}
        </td>
      )
    }
    return (
      <td className="py-2 px-2 text-sm">
        <div className="flex items-center gap-1.5">
          {isEditing('status') ? (
            <select
              autoFocus
              value={status ?? 'NOT_STARTED'}
              disabled={state === 'saving'}
              onBlur={stopEditing}
              onChange={(event) => {
                stopEditing()
                void onPatchItem(itemId, 'status', event.target.value as TaskStatus, updatedAt)
              }}
              className={`h-7 rounded-md border px-2 text-xs ${editableCellClass(state)}`}
            >
              {(['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'] as TaskStatus[]).map(option => (
                <option key={option} value={option}>{t(`status.${option}`, { defaultValue: option })}</option>
              ))}
            </select>
          ) : (
            <CellTrigger field="status" labelKey="tree.status">
              {status ? (
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status] ?? ''}`}>
                  {t(`status.${status}`, { defaultValue: status })}
                </span>
              ) : <span className="text-muted-foreground">—</span>}
            </CellTrigger>
          )}
          <StatusIndicator state={state} />
        </div>
      </td>
    )
  }

  function renderAssigneeColumn() {
    const state = cellStateFor(itemId, 'assigneeId')
    if (!editable || !canEdit) return <td className="py-2 px-2 text-sm text-muted-foreground">{assigneeName ? <span title={assigneeName}>{displayPersonName(assigneeName)}</span> : '—'}</td>
    return (
      <td className="py-2 px-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {isEditing('assigneeId') ? (
            <select
              autoFocus
              value={assigneeId ?? ''}
              disabled={state === 'saving'}
              onBlur={stopEditing}
              onChange={(event) => {
                stopEditing()
                void onPatchItem(itemId, 'assigneeId', event.target.value || null, updatedAt)
              }}
              className={`h-7 min-w-32 rounded-md border px-2 text-xs ${editableCellClass(state)}`}
            >
              <option value="">{t('unassigned', { defaultValue: 'Não atribuído' })}</option>
              {members.map(member => <option key={member.userId} value={member.userId}>{member.name}</option>)}
            </select>
          ) : (
            <CellTrigger field="assigneeId" labelKey="tree.assignee">
              {assigneeName
                ? <span title={assigneeName}>{displayPersonName(assigneeName)}</span>
                : <span className="text-muted-foreground">—</span>}
            </CellTrigger>
          )}
          <StatusIndicator state={state} />
        </div>
      </td>
    )
  }

  function renderPointsColumn() {
    const state = cellStateFor(itemId, 'points')
    if (!editable || !canEdit) return <td className="py-2 px-2 text-sm text-right text-muted-foreground">{points != null && points > 0 ? points : '—'}</td>
    return (
      <td className="py-2 px-2 text-sm text-muted-foreground">
        <div className="flex items-center justify-end gap-1.5">
          {isEditing('points') ? (
            <input
              autoFocus
              type="number"
              min={0}
              key={`points-${itemId}-${points ?? ''}`}
              defaultValue={points ?? ''}
              disabled={state === 'saving'}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
                if (event.key === 'Escape') {
                  event.currentTarget.value = points == null ? '' : String(points)
                  event.currentTarget.blur()
                }
              }}
              onBlur={(event) => {
                const next = parseNumericInput(event.currentTarget.value)
                stopEditing()
                if (next === points || (next === null && points == null)) return
                void onPatchItem(itemId, 'points', next, updatedAt)
              }}
              className={`h-7 w-16 rounded-md border px-2 text-right text-xs ${editableCellClass(state)}`}
            />
          ) : (
            <CellTrigger field="points" labelKey="points" align="right">
              {points != null && points > 0 ? points : <span className="text-muted-foreground">—</span>}
            </CellTrigger>
          )}
          <StatusIndicator state={state} />
        </div>
      </td>
    )
  }

  function renderProgressColumn() {
    return (
      <td className="py-2 px-2 text-sm w-24">
        {progress != null ? (
          <div className="flex items-center gap-1.5" aria-label={t('tree.progressLabel', { progress: clampProgress(progress) })}>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={clampProgress(progress)}
                style={{ width: `${clampProgress(progress)}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">{clampProgress(progress)}%</span>
          </div>
        ) : '—'}
      </td>
    )
  }

  function renderDependenciesColumn() {
    return (
      <td className="py-2 px-2 text-xs text-muted-foreground">
        {dependencies && dependencies.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {dependencies.map((dep, index) => <span key={dep.id ?? dep.dependsOn?.id ?? index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">{dep.dependsOn?.sequenceCode ?? dep.dependsOn?.title ?? '—'}</span>)}
          </div>
        ) : '—'}
      </td>
    )
  }

  function renderDateColumn(field: 'startDate' | 'dueDate', value: string | null | undefined) {
    const state = cellStateFor(itemId, field)
    if (!editable || !canEdit) return <td className="py-2 px-2 text-xs text-muted-foreground">{value ?? '—'}</td>
    return (
      <td className="py-2 px-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {isEditing(field) ? (
            <input
              autoFocus
              type="date"
              key={`${field}-${itemId}-${value ?? ''}`}
              defaultValue={value ?? ''}
              disabled={state === 'saving'}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
                if (event.key === 'Escape') {
                  event.currentTarget.value = value ?? ''
                  event.currentTarget.blur()
                }
              }}
              onBlur={(event) => {
                const next = event.currentTarget.value || null
                stopEditing()
                if (next === (value ?? null)) return
                void onPatchItem(itemId, field, next, updatedAt)
              }}
              className={`h-7 rounded-md border px-2 text-xs ${editableCellClass(state)}`}
            />
          ) : (
            <CellTrigger field={field} labelKey={field === "startDate" ? "tree.start" : "tree.endDate"}>
              {formatDateCell(value) ?? <span className="text-muted-foreground">—</span>}
            </CellTrigger>
          )}
          <StatusIndicator state={state} />
        </div>
      </td>
    )
  }

  function renderPriorityColumn() {
    const state = cellStateFor(itemId, 'priority')
    if (!editable || !canEdit) return <td className="py-2 px-2 text-xs text-muted-foreground">{priority ? t(`priority.${priority}`, { defaultValue: priority }) : '—'}</td>
    return (
      <td className="py-2 px-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {isEditing('priority') ? (
            <select
              autoFocus
              value={priority ?? 'MEDIUM'}
              disabled={state === 'saving'}
              onBlur={stopEditing}
              onChange={(event) => {
                stopEditing()
                void onPatchItem(itemId, 'priority', event.target.value as Priority, updatedAt)
              }}
              className={`h-7 rounded-md border px-2 text-xs ${editableCellClass(state)}`}
            >
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as Priority[]).map(option => (
                <option key={option} value={option}>{t(`priority.${option}`, { defaultValue: option })}</option>
              ))}
            </select>
          ) : (
            <CellTrigger field="priority" labelKey="tree.priority">
              {priority
                ? t(`priority.${priority}`, { defaultValue: priority })
                : <span className="text-muted-foreground">—</span>}
            </CellTrigger>
          )}
          <StatusIndicator state={state} />
        </div>
      </td>
    )
  }

  function renderSprintColumn() {
    const sprintValue = sprintId ?? ''
    const state = cellStateFor(itemId, 'sprintId')
    if (!editable) return <td className="py-2 px-2 text-xs text-muted-foreground">—</td>
    if (!canEdit) {
      const sprintName = sprints.find(sprint => sprint.id === sprintValue)?.name
      return <td className="py-2 px-2 text-xs text-muted-foreground">{sprintName ?? '—'}</td>
    }
    return (
      <td className="py-2 px-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {isEditing('sprintId') ? (
            <select
              autoFocus
              value={sprintValue}
              disabled={state === 'saving'}
              onBlur={stopEditing}
              onChange={(event) => {
                stopEditing()
                void onPatchItem(itemId, 'sprintId', event.target.value || null, updatedAt)
              }}
              className={`h-7 min-w-28 rounded-md border px-2 text-xs ${editableCellClass(state)}`}
            >
              <option value="">{t('noSprint', { defaultValue: 'Sem sprint' })}</option>
              {sprints.map(sprint => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}
            </select>
          ) : (
            <CellTrigger field="sprintId" labelKey="tree.sprint">
              {sprints.find(sprint => sprint.id === sprintValue)?.name ?? <span className="text-muted-foreground">—</span>}
            </CellTrigger>
          )}
          <StatusIndicator state={state} />
        </div>
      </td>
    )
  }

  function renderVersionColumn() {
    const state = cellStateFor(itemId, 'versionId')
    if (!editable) return <td className="py-2 px-2 text-xs text-muted-foreground">—</td>
    if (!canEdit) {
      const versionName = versions.find(version => version.id === versionId)?.name
      return <td className="py-2 px-2 text-xs text-muted-foreground">{versionName ?? '—'}</td>
    }
    return (
      <td className="py-2 px-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {isEditing('versionId') ? (
            <select
              autoFocus
              value={versionId ?? ''}
              disabled={state === 'saving'}
              onBlur={stopEditing}
              onChange={(event) => {
                stopEditing()
                void onPatchItem(itemId, 'versionId', event.target.value || null, updatedAt)
              }}
              className={`h-7 min-w-28 rounded-md border px-2 text-xs ${editableCellClass(state)}`}
            >
              <option value="">{t('noVersion', { defaultValue: 'Sem versão' })}</option>
              {versions.map(version => <option key={version.id} value={version.id}>{version.name}</option>)}
            </select>
          ) : (
            <CellTrigger field="versionId" labelKey="tree.version">
              {versions.find(version => version.id === versionId)?.name ?? <span className="text-muted-foreground">—</span>}
            </CellTrigger>
          )}
          <StatusIndicator state={state} />
        </div>
      </td>
    )
  }

  function renderCostCenterColumn() {
    const state = cellStateFor(itemId, 'costCenterId')
    if (!editable) return <td className="py-2 px-2 text-xs text-muted-foreground">—</td>
    if (!canEdit) {
      const costCenter = costCenters.find(item => item.id === costCenterId)
      return <td className="py-2 px-2 text-xs text-muted-foreground">{costCenter ? `${costCenter.code}${costCenter.description ? ` - ${costCenter.description}` : ''}` : '—'}</td>
    }
    return (
      <td className="py-2 px-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {isEditing('costCenterId') ? (
            <select
              autoFocus
              value={costCenterId ?? ''}
              disabled={state === 'saving'}
              onBlur={stopEditing}
              onChange={(event) => {
                stopEditing()
                void onPatchItem(itemId, 'costCenterId', event.target.value || null, updatedAt)
              }}
              className={`h-7 min-w-32 rounded-md border px-2 text-xs ${editableCellClass(state)}`}
            >
              <option value="">{t('noCostCenter', { defaultValue: 'Sem centro de custo' })}</option>
              {costCenters.map(costCenter => (
                <option key={costCenter.id} value={costCenter.id}>
                  {costCenter.code}{costCenter.description ? ` - ${costCenter.description}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <CellTrigger field="costCenterId" labelKey="tree.costCenter">
              {(() => {
                const costCenter = costCenters.find(item => item.id === costCenterId)
                if (!costCenter) return <span className="text-muted-foreground">—</span>
                return `${costCenter.code}${costCenter.description ? ` - ${costCenter.description}` : ''}`
              })()}
            </CellTrigger>
          )}
          <StatusIndicator state={state} />
        </div>
      </td>
    )
  }

  function renderActionsColumn() {
    return (
      <td className="py-2 px-2 text-xs text-muted-foreground pr-4">
        <div className="flex items-center gap-1">
          {onCreate && (
            <div className="flex items-center gap-0.5">
              {(['EPIC', 'STORY', 'TASK', 'BUG'] as TreeCreationType[])
                .filter(childType => (
                  type === 'module' ? childType === 'EPIC' :
                  type === 'EPIC' ? childType === 'STORY' :
                  ['STORY', 'TASK', 'BUG'].includes(type) ? ['TASK', 'BUG'].includes(childType) : false
                ))
                .map(childType => (
                  <button
                    key={childType}
                    type="button"
                    onClick={event => { event.stopPropagation(); onCreate(childType, {}) }}
                    aria-label={t('tree.addChild', { type: t(`tree.types.${childType.toLowerCase()}`), label })}
                    title={t('tree.add', { type: t(`tree.types.${childType.toLowerCase()}`) })}
                    className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10"
                  >
                    {childType === 'BUG' ? <BugIcon className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                ))}
            </div>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={event => { event.stopPropagation(); onEdit() }}
              aria-label={t('tree.edit', { label })}
              title={t('tree.editItem')}
              className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onArchive && (
            <button
              type="button"
              onClick={event => { event.stopPropagation(); onArchive() }}
              aria-label={t('tree.archive', { label })}
              title={t('tree.archiveItem')}
              className="p-1 rounded text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    )
  }

  return (
    <tr className="group relative border-b border-border/60 transition-colors hover:bg-muted/20">
      {visibleColumns.map(columnId => {
        switch (columnId) {
          case 'name': return <Fragment key="name">{renderNameColumn()}</Fragment>
          case 'status': return <Fragment key="status">{renderStatusColumn()}</Fragment>
          case 'assignee': return <Fragment key="assignee">{renderAssigneeColumn()}</Fragment>
          case 'points': return <Fragment key="points">{renderPointsColumn()}</Fragment>
          case 'progress': return <Fragment key="progress">{renderProgressColumn()}</Fragment>
          case 'dependencies': return <Fragment key="dependencies">{renderDependenciesColumn()}</Fragment>
          case 'startDate': return <Fragment key="startDate">{renderDateColumn('startDate', startDate)}</Fragment>
          case 'dueDate': return <Fragment key="dueDate">{renderDateColumn('dueDate', dueDate)}</Fragment>
          case 'priority': return <Fragment key="priority">{renderPriorityColumn()}</Fragment>
          case 'sprint': return <Fragment key="sprint">{renderSprintColumn()}</Fragment>
          case 'version': return <Fragment key="version">{renderVersionColumn()}</Fragment>
          case 'costCenter': return <Fragment key="costCenter">{renderCostCenterColumn()}</Fragment>
          case 'actions': return <Fragment key="actions">{renderActionsColumn()}</Fragment>
          default: return null
        }
      })}
      <td aria-hidden />
    </tr>
  )
}

function NodeRows({
  nodes,
  depth,
  expanded,
  onToggle,
  onArchive,
  canEdit,
  visibleColumns,
  members,
  sprints,
  versions,
  costCenters,
  cellStateFor,
  onPatchItem,
  onEdit,
  onCreate,
  moduleId,
}: {
  nodes: TreeNode[]
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onArchive: (id: string, childrenCount: number) => void
  canEdit: boolean
  visibleColumns: TreeGridColumnId[]
  members: TreeMemberOption[]
  sprints: TreeSprintOption[]
  versions: TreeVersionOption[]
  costCenters: TreeCostCenterOption[]
  cellStateFor: (itemId: string, field: TreeEditableField) => EditableCellStatus
  onPatchItem: (itemId: string, field: TreeEditableField, value: unknown, expectedUpdatedAt?: string) => Promise<void>
  onEdit?: (id: string) => void
  onCreate?: (type: TreeCreationType, context: TreeActionContext) => void
  moduleId?: string
}) {
  return (
    <>
      {nodes.map(node => (
        <Fragment key={node.id}>
          <Row
            itemId={node.id}
            updatedAt={node.updatedAt}
            depth={depth}
            label={node.title ?? node.name ?? ''}
            type={node.type}
            status={node.status}
            priority={node.priority}
            points={node.points}
            progress={node.progress}
            startDate={node.startDate}
            dueDate={node.dueDate}
            sprintId={firstSprintId(node)}
            versionId={node.versionId}
            costCenterId={node.costCenterId}
            assigneeId={node.assigneeId}
            assigneeName={node.assignee?.name}
            dependencies={node.dependencies}
            expanded={expanded.has(node.id)}
            hasChildren={(node.children ?? []).length > 0}
            canEdit={canEdit}
            visibleColumns={visibleColumns}
            members={members}
            sprints={sprints}
            versions={versions}
            costCenters={costCenters}
            cellStateFor={cellStateFor}
            onPatchItem={onPatchItem}
            onToggle={() => onToggle(node.id)}
            // Módulos não são arquiváveis — só EPICs, STORYs, TASKs e BUGs
            onArchive={node.type !== 'module' ? () => onArchive(node.id, node.children.length) : undefined}
            onEdit={node.type !== 'module' ? () => onEdit?.(node.id) : undefined}
            onCreate={onCreate ? (type, context) => onCreate(type, {
              ...context,
              parentId: node.id,
              moduleId: node.type === 'module' ? node.id : (node.moduleId ?? moduleId),
            }) : undefined}
          />
          {expanded.has(node.id) && (node.children ?? []).length > 0 && (
            <NodeRows
              nodes={node.children}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onArchive={onArchive}
              canEdit={canEdit}
              visibleColumns={visibleColumns}
              members={members}
              sprints={sprints}
              versions={versions}
              costCenters={costCenters}
              cellStateFor={cellStateFor}
              onPatchItem={onPatchItem}
              onEdit={onEdit}
              onCreate={onCreate}
              moduleId={node.type === 'module' ? node.id : (node.moduleId ?? moduleId)}
            />
          )}
        </Fragment>
      ))}
    </>
  )
}

interface Props {
  projectId: string
  filters?: BoardFilterState
  members?: TreeMemberOption[]
  sprints?: TreeSprintOption[]
  versions?: TreeVersionOption[]
  costCenters?: TreeCostCenterOption[]
  // Tarefa 10.2 — callback para arquivamento a partir da tree view (opcional, gerenciado no BoardPage)
  onArchive?: (itemId: string, childrenCount: number) => void
  canCreate?: boolean
  canEdit?: boolean
  onCreate?: (type: TreeCreationType, context: TreeActionContext) => void
  onEdit?: (itemId: string) => void
  // Card T16 — publica a fotografia do contexto da árvore (população apresentada).
  onSnapshotChange?: (snapshot: AssistantScreenSnapshot | null) => void
  // Card T26 — população fixada do resultado; ancestrais são mantidos apenas
  // como contêineres de navegação, fora da população do resultado.
  pinnedItemIds?: string[] | null
}

// Card T26 — poda a árvore ao conjunto exato: mantém a folha que pertence ao
// resultado e os ancestrais necessários para navegar até ela.
function pruneTreeToIds(nodes: TreeNode[], allowed: Set<string>): TreeNode[] {
  const result: TreeNode[] = []
  for (const node of nodes) {
    const children = pruneTreeToIds(node.children ?? [], allowed)
    if (allowed.has(node.id) || children.length > 0) result.push({ ...node, children })
  }
  return result
}

export function TreeViewPage({
  projectId,
  filters,
  members = [],
  sprints = [],
  versions = [],
  costCenters = [],
  onArchive,
  canCreate = true,
  canEdit = true,
  onCreate,
  onEdit,
  onSnapshotChange,
  pinnedItemIds,
}: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Tarefa 10.2 — confirmação de arquivamento inline na tree view (quando sem callback externo)
  const [localArchiveConfirm, setLocalArchiveConfirm] = useState<{ itemId: string; childrenCount: number } | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<TreeGridColumnId[]>(() => readTreeGridLayout(user?.id, projectId))
  // O menu guarda onde foi aberto: posição horizontal da faixa e índice de inserção da coluna.
  const [columnMenu, setColumnMenu] = useState<{ left: number; insertIndex: number } | null>(null)
  const columnMenuRef = useRef<HTMLDivElement | null>(null)
  const gridContainerRef = useRef<HTMLDivElement | null>(null)
  const [columnWidths, setColumnWidths] = useState<TreeGridColumnWidthMap>(() => readTreeGridWidths(user?.id, projectId))
  const [cellStates, setCellStates] = useState<Record<string, EditableCellStatus>>({})
  const [draggingColumnId, setDraggingColumnId] = useState<TreeGridColumnId | null>(null)
  const [dragOverColumnId, setDragOverColumnId] = useState<TreeGridColumnId | null>(null)
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null)
  const [panelDraggingColumnId, setPanelDraggingColumnId] = useState<TreeGridColumnId | null>(null)
  const [panelDropColumnId, setPanelDropColumnId] = useState<TreeGridColumnId | null>(null)
  const [panelDropPosition, setPanelDropPosition] = useState<'before' | 'after' | null>(null)
  const resizeSessionRef = useRef<{ columnId: TreeGridColumnId; startX: number; startWidth: number } | null>(null)
  const resizeMoveListenerRef = useRef<((event: MouseEvent) => void) | null>(null)
  const resizeUpListenerRef = useRef<(() => void) | null>(null)

  // O painel de colunas vive fora da área rolável, então fecha por clique externo/Escape.
  useEffect(() => {
    if (!columnMenu) return
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (columnMenuRef.current?.contains(target)) return
      if (target.closest?.('[data-column-insert]')) return
      setColumnMenu(null)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setColumnMenu(null)
    }
    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [columnMenu])

  // Árvore via camada de cache única (chave por identidade/projeto + filtros).
  // Mutações de hierarquia invalidam a chave com invalidateTree (sem gatilho de refetch próprio).
  const qs = useMemo(() => {
    const params = new URLSearchParams()
    if (filters?.moduleId)   params.set('moduleId', filters.moduleId)
    if (filters?.assigneeId) params.set('assigneeId', filters.assigneeId)
    if (filters?.sprintId)   params.set('sprintId', filters.sprintId)
    if (filters?.tagIds.length) params.set('tagIds', filters.tagIds.join(','))
    return params.toString()
  }, [filters?.moduleId, filters?.assigneeId, filters?.sprintId, filters?.tagIds.join(',')])

  const query = useQuery({
    queryKey: [...queryKeys.tree(user?.id, projectId), qs],
    queryFn: ({ signal }) => api.get<TreeNode[]>(`/projects/${projectId}/items/tree${qs ? `?${qs}` : ''}`, { signal }),
  })
  const tree = query.data ?? []
  const loading = query.isPending

  useEffect(() => {
    setVisibleColumns(readTreeGridLayout(user?.id, projectId))
    setColumnMenu(null)
    setColumnWidths(readTreeGridWidths(user?.id, projectId))
  }, [projectId, user?.id])

  useEffect(() => {
    try {
      localStorage.setItem(treeGridStorageKey(user?.id, projectId), JSON.stringify(visibleColumns))
    } catch {
      // localStorage indisponível: mantém apenas estado em memória
    }
  }, [projectId, user?.id, visibleColumns])

  useEffect(() => {
    try {
      localStorage.setItem(treeGridWidthStorageKey(user?.id, projectId), JSON.stringify(columnWidths))
    } catch {
      // localStorage indisponível: mantém apenas estado em memória
    }
  }, [columnWidths, projectId, user?.id])

  useEffect(() => {
    if (!query.data) return
    setExpanded(previous => {
      const ids = collectAllIds(query.data)
      const retained = new Set([...previous].filter(id => ids.has(id)))
      return previous.size === 0 ? new Set(query.data.map(m => m.id)) : retained
    })
  }, [query.data])

  // Card T26 — recorte fixado antes do filtro de epics vazios.
  const scopedTree = pinnedItemIds ? pruneTreeToIds(tree, new Set(pinnedItemIds)) : tree
  // Tarefa 11.5 — aplicar filtro hideEmptyEpics na árvore
  const displayTree = filters?.hideEmptyEpics
    ? scopedTree.map(filterHideEmptyEpics).filter((n): n is TreeNode => n !== null)
    : scopedTree

  // Card T16 — fotografia do contexto da árvore: população apresentada pela
  // mesma árvore renderizada (nós de agrupamento excluídos do conjunto).
  const treeSnapshot = useMemo(() => {
    if (!projectId || loading) return null
    const actionCardIds: string[] = []
    const collect = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if ((node.type === 'TASK' || node.type === 'BUG') && (node.children ?? []).length === 0) actionCardIds.push(node.id)
        collect(node.children ?? [])
      }
    }
    collect(displayTree)
    const expandedIds = new Set(expanded)
    const collapsedGroupIds = [...new Set(collectAllIds(tree))].filter(id => !expandedIds.has(id))
    return buildScreenSnapshot({
      screen: 'project-board-tree',
      route: window.location.pathname,
      projectId,
      projectName: null,
      viewMode: 'tree',
      activeModuleId: filters?.moduleId || null,
      collapsedGroupIds,
      filters: {
        moduleId: filters?.moduleId || null,
        sprintId: filters?.sprintId || null,
        assigneeId: filters?.assigneeId || null,
        tagIds: filters?.tagIds.length ? filters.tagIds : null,
      },
      actionCardIds,
      revisions: {},
    })
  }, [projectId, displayTree, expanded, filters, loading])

  useEffect(() => { onSnapshotChange?.(treeSnapshot) }, [treeSnapshot, onSnapshotChange])

  function toggleNode(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function cellStateFor(itemId: string, field: TreeEditableField): EditableCellStatus {
    return cellStates[`${itemId}:${field}`] ?? 'idle'
  }

  const patchTreeField = useCallback(async (itemId: string, field: TreeEditableField, value: unknown, expectedUpdatedAt?: string) => {
    const key = `${itemId}:${field}`
    setCellStates(previous => ({ ...previous, [key]: 'saving' }))
    try {
      const payload: Record<string, unknown> = { [field]: value }
      if (expectedUpdatedAt) payload.expectedUpdatedAt = expectedUpdatedAt
      await api.patch(`/projects/${projectId}/items/${itemId}`, payload)
      await Promise.all([
        invalidateTree(queryClient, user?.id, projectId),
        queryClient.invalidateQueries({ queryKey: queryKeys.board(user?.id, projectId) }),
      ])
      setCellStates(previous => ({ ...previous, [key]: 'idle' }))
    } catch (error) {
      // Em conflito de edição concorrente, força reconciliação imediata para
      // manter a grade fiel ao estado persistido no servidor.
      if (error instanceof ApiError && error.status === 409) {
        await Promise.all([
          invalidateTree(queryClient, user?.id, projectId),
          queryClient.invalidateQueries({ queryKey: queryKeys.board(user?.id, projectId) }),
        ])
      }
      setCellStates(previous => ({ ...previous, [key]: 'error' }))
    }
  }, [projectId, queryClient, user?.id])

  const orderedVisibleColumns = useMemo(
    () => normalizeTreeGridLayout(visibleColumns),
    [visibleColumns],
  )
  const reorderVisibleColumns = useCallback(
    (draggedId: TreeGridColumnId, targetId: TreeGridColumnId, position: 'before' | 'after') => {
      if (draggedId === targetId) return
      if (draggedId === 'name' || draggedId === 'actions') return
      setVisibleColumns(previous => {
        const current = normalizeTreeGridLayout(previous)
        const draggedIndex = current.indexOf(draggedId)
        const targetIndex = current.indexOf(targetId)
        if (draggedIndex < 0 || targetIndex < 0) return current

        const next = [...current]
        next.splice(draggedIndex, 1)
        const adjustedTargetIndex = next.indexOf(targetId)
        if (adjustedTargetIndex < 0) return current

        let insertionIndex = adjustedTargetIndex + (position === 'after' ? 1 : 0)
        if (targetId === 'name') insertionIndex = 1
        if (targetId === 'actions') insertionIndex = next.indexOf('actions')

        const actionsIndex = next.indexOf('actions')
        insertionIndex = Math.max(1, Math.min(insertionIndex, actionsIndex))
        next.splice(insertionIndex, 0, draggedId)
        return normalizeTreeGridLayout(next)
      })
    },
    [],
  )

  const toggleColumnVisibility = useCallback((columnId: TreeGridColumnId, insertIndex?: number) => {
    const column = TREE_GRID_COLUMN_MAP.get(columnId)
    if (!column || column.locked) return
    setVisibleColumns(previous => {
      const current = normalizeTreeGridLayout(previous)
      const has = current.includes(columnId)
      if (has) return normalizeTreeGridLayout(current.filter(id => id !== columnId))
      const actionsIndex = current.indexOf('actions')
      // Sem posição explícita a coluna entra logo antes de "Ações".
      const target = insertIndex === undefined
        ? actionsIndex
        : Math.min(Math.max(insertIndex, 1), actionsIndex)
      const next = [...current]
      next.splice(target, 0, columnId)
      return normalizeTreeGridLayout(next)
    })
  }, [])

  const openColumnMenuAt = useCallback((event: ReactMouseEvent<HTMLButtonElement>, insertIndex: number) => {
    event.preventDefault()
    event.stopPropagation()
    const container = gridContainerRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const anchorRect = event.currentTarget.getBoundingClientRect()
    // Mantém o painel inteiro dentro do card, mesmo abrindo numa faixa das pontas.
    const half = COLUMN_MENU_WIDTH / 2
    const rawLeft = anchorRect.left - containerRect.left + anchorRect.width / 2
    const maxLeft = Math.max(half + 8, containerRect.width - half - 8)
    const left = Math.min(Math.max(rawLeft, half + 8), maxLeft)
    setColumnMenu(current => (current?.insertIndex === insertIndex ? null : { left, insertIndex }))
  }, [])

  const resolveColumnWidth = useCallback((columnId: TreeGridColumnId): number => {
    return columnWidths[columnId] ?? TREE_GRID_COLUMN_DEFAULT_WIDTH[columnId]
  }, [columnWidths])

  // Sem largura explícita, table-fixed limita a tabela ao container e encolhe todas as colunas.
  const totalColumnsWidth = useMemo(
    () => orderedVisibleColumns.reduce((sum, columnId) => sum + resolveColumnWidth(columnId), 0),
    [orderedVisibleColumns, resolveColumnWidth],
  )

  const beginColumnResize = useCallback((event: ReactMouseEvent<HTMLButtonElement>, columnId: TreeGridColumnId) => {
    if (columnId === 'actions') return
    event.preventDefault()
    event.stopPropagation()
    if (resizeMoveListenerRef.current) {
      window.removeEventListener('mousemove', resizeMoveListenerRef.current)
    }
    if (resizeUpListenerRef.current) {
      window.removeEventListener('mouseup', resizeUpListenerRef.current)
    }
    const currentWidth = resolveColumnWidth(columnId)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    resizeSessionRef.current = {
      columnId,
      startX: event.clientX,
      startWidth: currentWidth,
    }
    const minWidth = TREE_GRID_COLUMN_MIN_WIDTH[columnId]

    const onMouseMove = (moveEvent: MouseEvent) => {
      const resizeSession = resizeSessionRef.current
      if (!resizeSession || resizeSession.columnId !== columnId) return
      const delta = moveEvent.clientX - resizeSession.startX
      const nextWidth = Math.max(minWidth, Math.round(resizeSession.startWidth + delta))
      setColumnWidths(previous => ({ ...previous, [columnId]: nextWidth }))
    }

    const onMouseUp = () => {
      resizeSessionRef.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      resizeMoveListenerRef.current = null
      resizeUpListenerRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    resizeMoveListenerRef.current = onMouseMove
    resizeUpListenerRef.current = onMouseUp
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [resolveColumnWidth])

  useEffect(() => {
    return () => {
      resizeSessionRef.current = null
      if (resizeMoveListenerRef.current) {
        window.removeEventListener('mousemove', resizeMoveListenerRef.current)
      }
      if (resizeUpListenerRef.current) {
        window.removeEventListener('mouseup', resizeUpListenerRef.current)
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  const handleColumnDragStart = useCallback((event: ReactDragEvent<HTMLElement>, columnId: TreeGridColumnId) => {
    const definition = TREE_GRID_COLUMN_MAP.get(columnId)
    if (definition?.locked) {
      event.preventDefault()
      return
    }
    setDraggingColumnId(columnId)
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', columnId)
  }, [])

  const handleColumnDragOver = useCallback((event: ReactDragEvent<HTMLTableHeaderCellElement>, targetId: TreeGridColumnId) => {
    if (!draggingColumnId || draggingColumnId === targetId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const targetDefinition = TREE_GRID_COLUMN_MAP.get(targetId)
    let position: 'before' | 'after'
    if (targetDefinition?.locked && targetId === 'name') {
      position = 'after'
    } else if (targetDefinition?.locked && targetId === 'actions') {
      position = 'before'
    } else {
      const bounds = event.currentTarget.getBoundingClientRect()
      position = event.clientX < bounds.left + bounds.width / 2 ? 'before' : 'after'
    }
    setDragOverColumnId(targetId)
    setDragOverPosition(position)
  }, [draggingColumnId])

  const handleColumnDragLeave = useCallback((event: ReactDragEvent<HTMLTableHeaderCellElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDragOverColumnId(null)
      setDragOverPosition(null)
    }
  }, [])

  const handleColumnDrop = useCallback((event: ReactDragEvent<HTMLTableHeaderCellElement>, targetId: TreeGridColumnId) => {
    event.preventDefault()
    const draggedFromData = event.dataTransfer.getData('text/plain')
    const draggedId = (draggingColumnId ?? draggedFromData) as TreeGridColumnId
    if (!TREE_GRID_COLUMN_MAP.has(draggedId)) return
    const fallbackPosition: 'before' | 'after' = targetId === 'name' ? 'after' : 'before'
    reorderVisibleColumns(draggedId, targetId, dragOverPosition ?? fallbackPosition)
    setDraggingColumnId(null)
    setDragOverColumnId(null)
    setDragOverPosition(null)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [dragOverPosition, draggingColumnId, reorderVisibleColumns])

  const handleColumnDragEnd = useCallback(() => {
    setDraggingColumnId(null)
    setDragOverColumnId(null)
    setDragOverPosition(null)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  const handlePanelDragStart = useCallback((event: ReactDragEvent<HTMLButtonElement>, columnId: TreeGridColumnId) => {
    setPanelDraggingColumnId(columnId)
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', columnId)
  }, [])

  const handlePanelDragOver = useCallback((event: ReactDragEvent<HTMLLabelElement>, targetId: TreeGridColumnId) => {
    if (!panelDraggingColumnId || panelDraggingColumnId === targetId) return
    const targetDefinition = TREE_GRID_COLUMN_MAP.get(targetId)
    event.preventDefault()
    let position: 'before' | 'after'
    if (targetDefinition?.locked && targetId === 'name') {
      position = 'after'
    } else if (targetDefinition?.locked && targetId === 'actions') {
      position = 'before'
    } else {
      const bounds = event.currentTarget.getBoundingClientRect()
      position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
    }
    setPanelDropColumnId(targetId)
    setPanelDropPosition(position)
  }, [panelDraggingColumnId])

  const handlePanelDrop = useCallback((event: ReactDragEvent<HTMLLabelElement>, targetId: TreeGridColumnId) => {
    event.preventDefault()
    const draggedFromData = event.dataTransfer.getData('text/plain')
    const draggedId = (panelDraggingColumnId ?? draggedFromData) as TreeGridColumnId
    if (!TREE_GRID_COLUMN_MAP.has(draggedId)) return
    if (draggedId === targetId) return
    reorderVisibleColumns(draggedId, targetId, panelDropPosition ?? 'before')
    setPanelDraggingColumnId(null)
    setPanelDropColumnId(null)
    setPanelDropPosition(null)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [panelDraggingColumnId, panelDropPosition, reorderVisibleColumns])

  const handlePanelDragEnd = useCallback(() => {
    setPanelDraggingColumnId(null)
    setPanelDropColumnId(null)
    setPanelDropPosition(null)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  // Tarefa 10.2 — handler de arquivamento: delega para prop ou gerencia localmente
  const handleArchiveRequest = useCallback((itemId: string, childrenCount: number) => {
    if (onArchive) {
      onArchive(itemId, childrenCount)
    } else {
      if (childrenCount > 0) {
        setLocalArchiveConfirm({ itemId, childrenCount })
      } else {
        executeLocalArchive(itemId)
      }
    }
  }, [onArchive]) // eslint-disable-line react-hooks/exhaustive-deps

  async function executeLocalArchive(itemId: string) {
    try {
      await api.post(`/projects/${projectId}/items/${itemId}/archive`, {})
      // Padrão reconciliado: invalida/refaz a consulta em vez de editar o cache local.
      await invalidateTree(queryClient, user?.id, projectId)
      setLocalArchiveConfirm(null)
    } catch {
      // silently fail — BoardPage mostrará toast
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded animate-pulse" style={{ width: `${60 + (i % 3) * 15}%` }} />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {canCreate && onCreate && (['MODULE', 'EPIC', 'STORY', 'TASK', 'BUG'] as TreeCreationType[]).map(type => (
          <button
            key={type}
            type="button"
            onClick={() => onCreate(type, {})}
            className="rounded-xl border border-border/70 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-border hover:bg-muted/40 hover:text-foreground"
          >
             + {t(`tree.types.${type.toLowerCase()}`)}
          </button>
        ))}
        <button
          onClick={() => setExpanded(collectAllIds(tree))}
          className="rounded-xl border border-border/70 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-border hover:bg-muted/40 hover:text-foreground"
        >
           {t('expandAll')}
        </button>
        <button
          onClick={() => setExpanded(new Set())}
          className="rounded-xl border border-border/70 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-border hover:bg-muted/40 hover:text-foreground"
        >
           {t('collapseAll')}
        </button>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
        <div ref={gridContainerRef} className="relative">
          <div className="overflow-x-auto rounded-2xl">
          <table className="min-w-full table-fixed border-separate border-spacing-0" style={{ width: totalColumnsWidth }}>
            <colgroup>
              {orderedVisibleColumns.map(columnId => {
                const width = resolveColumnWidth(columnId)
                return (
                  <col
                    key={`width-${columnId}`}
                    style={{ width: `${width}px`, minWidth: `${TREE_GRID_COLUMN_MIN_WIDTH[columnId]}px` }}
                  />
                )
              })}
              {/* Coluna elástica: com table-fixed a sobra iria para as colunas reais e anularia o resize. */}
              <col />
            </colgroup>
            <thead>
              <tr>
                {orderedVisibleColumns.map((columnId, columnIndex) => {
                  const definition = TREE_GRID_COLUMN_MAP.get(columnId)
                  if (!definition) return null
                  // border-separate anula a borda no <tr>, então a linha do cabeçalho vem de cada célula.
                  const baseClass = 'relative group border-b border-border/70 bg-muted py-2.5 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'
                  const isDragTarget = dragOverColumnId === columnId && draggingColumnId !== null && draggingColumnId !== columnId
                  const dropHintClass = isDragTarget
                    ? dragOverPosition === 'after'
                      ? 'shadow-[inset_-2px_0_0_0_rgba(129,140,248,0.9)]'
                      : 'shadow-[inset_2px_0_0_0_rgba(129,140,248,0.9)]'
                    : ''
                  const className =
                    columnId === 'name'
                      ? `text-left pl-4 pr-2 ${baseClass} ${dropHintClass}`
                      : columnId === 'points'
                        ? `text-right ${baseClass} ${dropHintClass}`
                        : columnId === 'actions'
                          ? `text-left pr-4 ${baseClass} ${dropHintClass}`
                          : `text-left ${baseClass} ${dropHintClass}`
                  const draggable = !definition.locked
                  return (
                    <th
                      key={columnId}
                      className={className}
                      onDragOver={(event) => handleColumnDragOver(event, columnId)}
                      onDragLeave={handleColumnDragLeave}
                      onDrop={(event) => handleColumnDrop(event, columnId)}
                    >
                      <div className={`relative flex items-center ${columnId === 'points' ? 'justify-end' : 'justify-start'}`}>
                        {draggable && (
                          <button
                            type="button"
                            draggable
                            onDragStart={(event) => handleColumnDragStart(event, columnId)}
                            onDragEnd={handleColumnDragEnd}
                            aria-label={t('tree.dragColumn', { column: t(definition.labelKey, { defaultValue: columnId }) })}
                            className={`mr-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-muted-foreground/70 transition hover:bg-muted hover:text-foreground ${draggingColumnId === columnId ? 'cursor-grabbing' : 'cursor-grab'}`}
                          >
                            <GripHorizontal className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                        <span className="truncate">{t(definition.labelKey, { defaultValue: columnId })}</span>
                      </div>
                      {columnId !== 'actions' && (
                        // Faixa no limite da coluna. O + fica na base para não cobrir a área de arraste.
                        <span className="group/edge absolute right-0 top-0 z-20 flex h-full w-4 translate-x-1/2 items-end justify-center rounded transition hover:bg-primary/10">
                          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/70" />
                          <button
                            type="button"
                            draggable={false}
                            onDragStart={(event) => { event.preventDefault(); event.stopPropagation() }}
                            onMouseDown={(event) => beginColumnResize(event, columnId)}
                            className="absolute inset-x-0 bottom-4 top-0 cursor-col-resize bg-transparent text-transparent"
                            aria-label={t('tree.resizeColumn', { column: t(definition.labelKey, { defaultValue: columnId }) })}
                          />
                          <button
                            type="button"
                            data-column-insert=""
                            onClick={(event) => openColumnMenuAt(event, columnIndex + 1)}
                            aria-expanded={columnMenu?.insertIndex === columnIndex + 1}
                            aria-label={t('tree.addColumnAfter', { column: t(definition.labelKey, { defaultValue: columnId }) })}
                            title={t('tree.addColumn')}
                            className={`relative z-10 mb-0.5 h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:border-primary hover:text-foreground ${columnMenu?.insertIndex === columnIndex + 1 ? 'flex border-primary text-foreground' : 'hidden group-hover/edge:flex'}`}
                          >
                            <Plus className="h-2.5 w-2.5" aria-hidden />
                          </button>
                        </span>
                      )}
                    </th>
                  )
                })}
                <th aria-hidden className="border-b border-border/70 bg-muted" />
              </tr>
            </thead>
            <tbody>
              <NodeRows
                nodes={displayTree}
                depth={0}
                expanded={expanded}
                onToggle={toggleNode}
                onArchive={handleArchiveRequest}
                canEdit={canEdit}
                visibleColumns={orderedVisibleColumns}
                members={members}
                sprints={sprints}
                versions={versions}
                costCenters={costCenters}
                cellStateFor={cellStateFor}
                onPatchItem={patchTreeField}
                onEdit={canEdit ? onEdit : undefined}
                onCreate={canCreate ? onCreate : undefined}
              />
            </tbody>
          </table>
          </div>

          {columnMenu && (
            <div
              ref={columnMenuRef}
              style={{ left: columnMenu.left, width: COLUMN_MENU_WIDTH }}
              className="absolute top-11 z-30 -translate-x-1/2 rounded-xl border border-border bg-card p-3 shadow-lg"
            >
              <p className="mb-2 px-1 text-xs font-semibold text-foreground">{t('tree.visibleColumns')}</p>
              <div className="max-h-[22rem] space-y-0.5 overflow-y-auto">
                {TREE_GRID_COLUMNS.map(column => {
                  const checked = orderedVisibleColumns.includes(column.id)
                  const isDropTarget = panelDropColumnId === column.id && panelDraggingColumnId !== null && panelDraggingColumnId !== column.id
                  const dropMarkerClass = isDropTarget
                    ? panelDropPosition === 'after'
                      ? 'shadow-[inset_0_-2px_0_0_hsl(var(--primary))]'
                      : 'shadow-[inset_0_2px_0_0_hsl(var(--primary))]'
                    : ''
                  const canDragRow = checked && !column.locked
                  return (
                    <label
                      key={column.id}
                      onDragOver={(event) => handlePanelDragOver(event, column.id)}
                      onDrop={(event) => handlePanelDrop(event, column.id)}
                      className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition hover:bg-muted/60 ${dropMarkerClass}`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={Boolean(column.locked)}
                          onChange={() => toggleColumnVisibility(column.id, columnMenu.insertIndex)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>{t(column.labelKey, { defaultValue: column.id })}</span>
                      </span>
                      {canDragRow && (
                        <button
                          type="button"
                          draggable
                          onDragStart={(event) => handlePanelDragStart(event, column.id)}
                          onDragEnd={handlePanelDragEnd}
                          aria-label={t('tree.dragColumn', { column: t(column.labelKey, { defaultValue: column.id }) })}
                          className={`rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground ${panelDraggingColumnId === column.id ? 'cursor-grabbing' : 'cursor-grab'}`}
                        >
                          <GripHorizontal className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {displayTree.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
             {t('tree.empty')}
          </div>
        )}
      </div>

      {/* Tarefa 10.2 — Dialog de confirmação de arquivamento (gerenciado localmente na tree view) */}
      {localArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setLocalArchiveConfirm(null)} />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-6">
             <h3 className="font-semibold text-foreground mb-2">{t('tree.archiveTitle')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
               {t('tree.archiveDescription', { count: localArchiveConfirm.childrenCount })}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setLocalArchiveConfirm(null)}
                className="px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition"
              >
                 {t('cancel')}
              </button>
              <button
                onClick={() => executeLocalArchive(localArchiveConfirm.itemId)}
                className="px-4 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
              >
                 {t('tree.archiveAll')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
