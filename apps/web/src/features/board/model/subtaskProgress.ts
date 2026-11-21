import { averageAdvance, countsForProgress, createAdvanceResolver } from '@azy-board/domain'
import { toProgressColumns } from './cardAdvance'
import type { Column, ItemData } from './types'

/** Avanço médio das subtasks diretas de um card. */
export interface SubtasksProgress {
  advance: number
  total: number
}

interface SubtaskItem {
  id: string
  parentId?: string | null
  status?: string | null
  columnId?: string | null
}

const VIRTUAL_STORY_PREFIX = 'story-virtual-'

/**
 * Agrupa os filhos diretos de cada item e calcula a média de avanço deles pela mesma
 * regra do card (status + coluna, sem checklist). Cancelados e arquivados ficam fora;
 * item sem filho válido não entra no mapa. Custo O(n), uma vez por render do board.
 */
export function subtasksProgressByParent(
  items: readonly SubtaskItem[],
  columns: Column[],
): Map<string, SubtasksProgress> {
  const resolve = createAdvanceResolver(toProgressColumns(columns))
  const childrenByParent = new Map<string, SubtaskItem[]>()

  for (const item of items) {
    if (!item.parentId) continue
    const children = childrenByParent.get(item.parentId) ?? []
    children.push(item)
    childrenByParent.set(item.parentId, children)
  }

  const result = new Map<string, SubtasksProgress>()
  for (const [parentId, children] of childrenByParent) {
    const values = children
      .filter(item => countsForProgress(item.status))
      .map(item => resolve({ status: item.status ?? null, columnId: item.columnId ?? null }))
      .filter((value): value is number => value !== null)
    if (values.length === 0) continue
    result.set(parentId, { advance: averageAdvance(values), total: values.length })
  }
  return result
}

/** Consulta tolerando o prefixo dos cards virtuais de história. */
export function subtasksProgressForCard(
  progress: ReadonlyMap<string, SubtasksProgress>,
  cardId: string,
): SubtasksProgress | null {
  const direct = progress.get(cardId)
  if (direct) return direct
  if (!cardId.startsWith(VIRTUAL_STORY_PREFIX)) return null
  return progress.get(cardId.slice(VIRTUAL_STORY_PREFIX.length)) ?? null
}

/** Item completo do board, apenas para leitura dos campos usados no cálculo. */
export type SubtaskSource = Pick<ItemData, 'id' | 'parentId' | 'status' | 'columnId'>
