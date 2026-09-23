import { useCallback } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'
import { api } from '../../../lib/api'
import { getDropColumnId, getPersistableColumnOrder } from '../model/interaction'
import { runOptimisticMutation } from '../model/mutation'
import type { Column, ItemData } from '../model/types'

export interface BoardInteractionOptions {
  projectId?: string
  columns: Column[]
  items: ItemData[]
  displayedItems: ItemData[]
  setColumns: (value: Column[] | ((previous: Column[]) => Column[])) => void
  setItems: (value: ItemData[] | ((previous: ItemData[]) => ItemData[])) => void
  onError: (message: string) => void
}

export function createBoardInteractionHandler({ projectId, columns, items, displayedItems, setColumns, setItems, onError }: BoardInteractionOptions, patch = api.patch) {
  return async (event: DragEndEvent, effectiveOver?: string) => {
    const activeId = event.active.id.toString()
    const over = effectiveOver ?? event.over?.id?.toString()
    if (!projectId || !over) return
    if (activeId.includes(':col:')) {
      const from = activeId.split(':col:')[1]
      const to = getDropColumnId(event, columns, items, effectiveOver)
      const oldIndex = columns.findIndex(column => column.id === from)
      const newIndex = columns.findIndex(column => column.id === to)
      if (!to || oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
      const next = arrayMove(columns, oldIndex, newIndex)
      await runOptimisticMutation({
        capture: () => columns,
        apply: () => setColumns(next),
        restore: snapshot => setColumns(snapshot),
        request: () => patch(`/projects/${projectId}/columns/reorder`, { order: next.map(column => column.id) }),
        onError: () => onError('Erro ao reordenar colunas'),
      })
      return
    }
    const item = items.find(candidate => candidate.id === activeId)
    if (!item || !item.isLeaf || item.type === 'EPIC') return
    const target = getDropColumnId(event, columns, items, effectiveOver)
    if (!target) return
    if (item.columnId === target) {
      const order = getPersistableColumnOrder(items, target, activeId, over)
      if (!order) return
      const positions = Object.fromEntries(order.map((id, position) => [id, position]))
      const snapshot = items.map(candidate => ({ ...candidate }))
      await runOptimisticMutation({
        capture: () => snapshot,
        apply: () => setItems(previous => previous.map(candidate => positions[candidate.id] === undefined ? candidate : { ...candidate, position: positions[candidate.id] })),
        restore: previous => setItems(previous),
        request: () => patch(`/projects/${projectId}/items/reorder`, { columnId: target, order }),
        onError: () => onError('Erro ao reordenar'),
      })
      return
    }
    const previous = { ...item }
    const column = columns.find(candidate => candidate.id === target)
    await runOptimisticMutation({
      capture: () => previous,
      apply: () => setItems(current => current.map(candidate => candidate.id === activeId && column ? { ...candidate, columnId: target, status: column.baseStatus as ItemData['status'] } : candidate)),
      restore: snapshot => setItems(current => current.map(candidate => candidate.id === activeId ? snapshot : candidate)),
      request: () => patch(`/projects/${projectId}/items/${activeId}/move`, { columnId: target }),
      onError: () => onError('Erro ao mover card'),
    })
  }
}

export function useBoardInteraction(options: BoardInteractionOptions) {
  return useCallback(() => createBoardInteractionHandler(options), [options])()
}
