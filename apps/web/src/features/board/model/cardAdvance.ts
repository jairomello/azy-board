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
 * Avanço de um card (B19): o status define a faixa e a coluna refina — a mesma regra da
 * árvore, das lanes e do dashboard. O checklist tem barra própria e não entra aqui.
 * Card cancelado ou arquivado não tem avanço (`null`).
 */
export function createCardAdvance(columns: Column[]) {
  const resolve = createAdvanceResolver(toProgressColumns(columns))
  return (card: { status?: string | null; columnId?: string | null }): number | null =>
    resolve({ status: card.status ?? null, columnId: card.columnId ?? null })
}

/**
 * B19 — o card está numa coluna de outro status, embora o projeto tenha coluna própria
 * para o status dele? É o mesmo critério da reconciliação status ↔ coluna da API
 * (`reconcileStatusAndColumn`): status sem coluna correspondente (ex.: BLOCKED,
 * CANCELLED num projeto sem essas colunas) não é desencontro. Devolve a coluna atual
 * quando há desencontro, senão `null`.
 */
export function statusColumnMismatch(
  card: { status?: string | null; columnId?: string | null },
  columns: Array<Pick<Column, 'id' | 'name' | 'baseStatus'>>,
): Pick<Column, 'id' | 'name' | 'baseStatus'> | null {
  if (!card.status) return null
  const current = columns.find(column => column.id === card.columnId)
  if (!current || current.baseStatus === card.status) return null
  return columns.some(column => column.baseStatus === card.status) ? current : null
}
