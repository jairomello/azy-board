import { computeAdvance, orderColumns, resolveColumnProgressWeights } from '@azy-board/domain'
import type { Column } from './types'

/** Faixa de avanço de uma coluna: peso efetivo e piso (peso da coluna anterior no fluxo). */
export interface ColumnAdvanceBand {
  weight: number
  previous: number
}

/**
 * Faixas de avanço das colunas do projeto, na ordem do fluxo.
 *
 * O peso explícito da coluna (`progressWeightOverride`) entra como valor declarado e as
 * demais colunas são derivadas do status base e da posição — a mesma regra que as lanes,
 * a árvore e o dashboard usam (`packages/domain/src/progress.ts`).
 */
export function columnAdvanceBands(columns: Column[]): Map<string, ColumnAdvanceBand> {
  const ordered = orderColumns(columns.map(column => ({
    id: column.id,
    baseStatus: column.baseStatus,
    position: column.position,
    progressWeight: column.progressWeightOverride ?? null,
  })))
  const weights = resolveColumnProgressWeights(ordered)
  return new Map(ordered.map((column, index) => [column.id, {
    weight: weights.get(column.id) ?? 0,
    previous: index === 0 ? 0 : weights.get(ordered[index - 1]!.id) ?? 0,
  }]))
}

/** Avanço de um card dentro da faixa da sua coluna, refinado pelo checklist quando existir. */
export function cardAdvance(
  bands: Map<string, ColumnAdvanceBand>,
  card: { columnId?: string | null; checklistProgress?: { checked: number; total: number } | null },
): number {
  const band = card.columnId ? bands.get(card.columnId) : undefined
  if (!band) return 0
  return computeAdvance({
    columnWeight: band.weight,
    previousColumnWeight: band.previous,
    checklist: card.checklistProgress ?? null,
  })
}
