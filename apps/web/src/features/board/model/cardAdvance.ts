import { createAdvanceResolver, orderColumns, resolveColumnProgressWeights, type ProgressColumn } from '@azy-board/domain'
import type { Column } from './types'

/** Faixa de avanço de uma coluna: peso efetivo e piso (peso da coluna anterior no fluxo). */
export interface ColumnAdvanceBand {
  weight: number
  previous: number
}

/** Colunas do board no formato do domínio, com o peso explícito como valor declarado. */
export function toProgressColumns(columns: Column[]): ProgressColumn[] {
  return columns.map(column => ({
    id: column.id,
    baseStatus: column.baseStatus,
    position: column.position,
    progressWeight: column.progressWeightOverride ?? null,
  }))
}

/**
 * Faixas de avanço das colunas do projeto, na ordem do fluxo.
 *
 * O peso explícito da coluna (`progressWeightOverride`) entra como valor declarado e as
 * demais colunas são derivadas do status base e da posição — a mesma regra que as lanes,
 * a árvore e o dashboard usam (`packages/domain/src/progress.ts`).
 */
export function columnAdvanceBands(columns: Column[]): Map<string, ColumnAdvanceBand> {
  const ordered = orderColumns(toProgressColumns(columns))
  const weights = resolveColumnProgressWeights(ordered)
  return new Map(ordered.map((column, index) => [column.id, {
    weight: weights.get(column.id) ?? 0,
    previous: index === 0 ? 0 : weights.get(ordered[index - 1]!.id) ?? 0,
  }]))
}

/**
 * Avanço de um card (B19): o status define a faixa e a coluna refina, com o checklist
 * afinando dentro dela — a mesma regra da árvore, das lanes e do dashboard. Card cancelado
 * ou arquivado não tem avanço (`null`).
 */
export function createCardAdvance(columns: Column[]) {
  const resolve = createAdvanceResolver(toProgressColumns(columns))
  return (card: { status?: string | null; columnId?: string | null; checklistProgress?: { checked: number; total: number } | null }): number | null =>
    resolve({ status: card.status ?? null, columnId: card.columnId ?? null, checklist: card.checklistProgress ?? null })
}
