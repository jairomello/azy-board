import { useCallback } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'
import { api } from '../../../lib/api'
import { destinationOrderWithInserted, getDropColumnId } from '../model/interaction'
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
  /** Mensagem de recusa do servidor, já traduzida pelo chamador (Card T89). */
  mutationRefusedMessage?: string
  /** Cancela leituras do quadro em voo antes de aplicar o estado otimista. */
  cancelPendingReads?: () => void
}

export function createBoardInteractionHandler({ projectId, columns, items, setColumns, setItems, onError, mutationRefusedMessage, cancelPendingReads }: BoardInteractionOptions, patch = api.patch) {
  // Card T89 — a recusa restaura ordem e coluna anteriores; a mensagem explica isso
  // em vez de só nomear a falha.
  const refused = (fallback: string) => mutationRefusedMessage ?? fallback
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
        beforeApply: cancelPendingReads,
        capture: () => columns,
        apply: () => setColumns(next),
        restore: snapshot => setColumns(snapshot),
        request: () => patch(`/projects/${projectId}/columns/reorder`, { order: next.map(column => column.id) }),
        onError: () => onError(refused('Erro ao reordenar colunas')),
      })
      return
    }
    const item = items.find(candidate => candidate.id === activeId)
    if (!item || !item.isLeaf || item.type === 'EPIC') return
    const target = getDropColumnId(event, columns, items, effectiveOver)
    if (!target) return
    if (item.columnId === target) {
      // Card B14 — a âncora é o card que fica depois da vaga, então a ordem nova é
      // montada inserindo o card nesse ponto. `arrayMove` até o índice da âncora
      // deixava o card um slot abaixo da vaga quando o arraste era para baixo.
      const order = destinationOrderWithInserted(items, target, activeId, over)
      if (order.length === 0) return
      const positions = Object.fromEntries(order.map((id, position) => [id, position]))
      const snapshot = items.map(candidate => ({ ...candidate }))
      await runOptimisticMutation({
        beforeApply: cancelPendingReads,
        capture: () => snapshot,
        apply: () => setItems(previous => previous.map(candidate => positions[candidate.id] === undefined ? candidate : { ...candidate, position: positions[candidate.id] })),
        restore: previous => setItems(previous),
        request: () => patch(`/projects/${projectId}/items/reorder`, { columnId: target, order }),
        onError: () => onError(refused('Erro ao reordenar')),
      })
      return
    }
    // Card T89 — a coluna e a posição são as duas coisas que o usuário escolheu ao
    // soltar na vaga: o move aplica a coluna e o reorder fixa a ordem da coluna de
    // destino com o card no índice da vaga.
    const previous = { ...item }
    const column = columns.find(candidate => candidate.id === target)
    const order = destinationOrderWithInserted(items, target, activeId, over)
    const positions = Object.fromEntries(order.map((id, position) => [id, position]))
    // O rollback é cirúrgico: devolve coluna, status e posições afetadas sem apagar
    // atualizações mais recentes de outros itens que chegaram durante a requisição.
    const posicoesAnteriores = Object.fromEntries(items
      .filter(candidate => candidate.id === activeId || order.includes(candidate.id))
      .map(candidate => [candidate.id, candidate.position]))
    await runOptimisticMutation({
      beforeApply: cancelPendingReads,
      capture: () => previous,
      apply: () => setItems(current => current.map(candidate => {
        const position = positions[candidate.id]
        if (candidate.id === activeId && column) {
          return { ...candidate, columnId: target, status: column.baseStatus as ItemData['status'], position: position ?? candidate.position }
        }
        return position === undefined ? candidate : { ...candidate, position }
      })),
      restore: snapshot => setItems(current => current.map(candidate => {
        if (candidate.id === activeId) {
          return { ...candidate, columnId: snapshot.columnId, status: snapshot.status, position: snapshot.position }
        }
        const anterior = posicoesAnteriores[candidate.id]
        return anterior === undefined ? candidate : { ...candidate, position: anterior }
      })),
      request: async () => {
        await patch(`/projects/${projectId}/items/${activeId}/move`, { columnId: target })
        if (order.length > 0) await patch(`/projects/${projectId}/items/reorder`, { columnId: target, order })
      },
      onError: () => onError(refused('Erro ao mover card')),
    })
  }
}

export function useBoardInteraction(options: BoardInteractionOptions) {
  return useCallback(() => createBoardInteractionHandler(options), [options])()
}
