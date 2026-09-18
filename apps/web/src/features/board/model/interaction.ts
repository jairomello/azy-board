import type { DragEndEvent } from '@dnd-kit/core'
import type { ItemData, Column } from './types'
import type { ItemType } from '@azy-board/types'
import { arrayMove } from '@dnd-kit/sortable'

export type BoardModalTarget =
  | { kind: 'story'; item: ItemData }
  | { kind: 'item'; item: ItemData }

export function resolveBoardModalTarget(id: string, items: ItemData[]): BoardModalTarget | undefined {
  const item = items.find(candidate => candidate.id === id)
  if (!item) return undefined
  return item.type === 'STORY' ? { kind: 'story', item } : { kind: 'item', item }
}

export function buildBoardItemCreatePayload(title: string, columnId: string, type: ItemType, parentId?: string, versionId?: string, sprintId?: string) {
  return {
    title,
    columnId,
    priority: 'MEDIUM',
    type,
    ...(versionId ? { versionId } : {}),
    ...(sprintId ? { sprintId } : {}),
    ...(parentId ? { parentId } : {}),
  }
}

export function getDropColumnId(
  event: DragEndEvent,
  columns: Column[],
  items: ItemData[],
  effectiveOver?: string,
): string | undefined {
  const over = effectiveOver ?? event.over?.id?.toString()
  if (!over) return undefined
  const ids = new Set(columns.map(column => column.id))
  if (ids.has(over)) return over
  const marker = over.includes(':drop:') || over.includes(':col:')
  if (marker) {
    const id = over.split(':').pop()
    return id && ids.has(id) ? id : undefined
  }
  return items.find(item => item.id === over)?.columnId ?? undefined
}

export function getPersistableColumnOrder(items: ItemData[], columnId: string, activeId: string, overId: string): string[] | undefined {
  const columnItems = items
    .filter(item => item.columnId === columnId && item.isLeaf && !item.id.startsWith('story-virtual-'))
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
  const fromIndex = columnItems.findIndex(item => item.id === activeId)
  const toIndex = columnItems.findIndex(item => item.id === overId)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return undefined
  return arrayMove(columnItems, fromIndex, toIndex).map(item => item.id)
}

export function sortBoardItemsByPosition(items: ItemData[]): ItemData[] {
  return [...items].sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
}
