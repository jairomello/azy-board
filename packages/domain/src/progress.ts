// Peso de avanço por coluna e cálculo do avanço de um card.
//
// O progresso do produto deixou de ser binário (DONE = 100%, resto = 0%) e passou a
// derivar do fluxo: cada coluna tem um peso. O checklist tem barra própria no card e
// NÃO refina o avanço. Fonte única da regra — API (árvore, dashboard, lista de projetos)
// e web (board, lanes, sprint) usam exatamente estas funções.
//
// Sem valor explícito, o peso é derivado do `baseStatus` e da posição entre as colunas
// do mesmo status:
// - `NOT_STARTED`/`PLANNED`/`CANCELLED` = 0;
// - `DONE` = 100;
// - `IN_PROGRESS`/`IN_HOMOLOGATION`/`BLOCKED` = faixa do fluxo: a última coluna vale 90;
//   quando há mais de uma, a primeira vale 50 e as demais são distribuídas entre 50 e 90.
//
// B19 — o **status** do item define a faixa de avanço e a coluna só refina dentro dela
// (`createAdvanceResolver`). Item cancelado ou arquivado fica fora da conta (nem soma nem
// entra no denominador), e o agrupador é a média de todos os itens válidos abaixo dele —
// o que equivale à média das filhas ponderada pelo número de itens de cada uma.
import type { ColumnBaseStatus } from './index'

/** Teto da faixa do fluxo: nenhuma coluna em progresso vale 100 (isso é do `DONE`). */
export const FLOW_WEIGHT_TOP = 90
/** Peso da primeira coluna em progresso quando existe mais de uma. */
export const FLOW_WEIGHT_START = 50
/** Peso da coluna concluída. */
export const DONE_WEIGHT = 100

export interface ProgressColumn {
  id: string
  baseStatus: ColumnBaseStatus
  position: number
  progressWeight?: number | null
}

function isFlowStatus(status: ColumnBaseStatus): boolean {
  return status === 'IN_PROGRESS' || status === 'IN_HOMOLOGATION' || status === 'BLOCKED'
}

function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function explicitWeight(column: ProgressColumn): number | null {
  return typeof column.progressWeight === 'number' ? clampWeight(column.progressWeight) : null
}

/** Ordem do fluxo: posição da coluna, com o id como desempate determinístico. */
export function orderColumns(columns: readonly ProgressColumn[]): ProgressColumn[] {
  return [...columns].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
}

/**
 * Peso efetivo de cada coluna: valor explícito quando houver, senão o derivado do
 * `baseStatus` e da posição entre as colunas do mesmo status.
 */
export function resolveColumnProgressWeights(columns: readonly ProgressColumn[]): Map<string, number> {
  const ordered = orderColumns(columns)
  const flow = ordered.filter(column => explicitWeight(column) === null && isFlowStatus(column.baseStatus))
  const weights = new Map<string, number>()
  for (const column of ordered) {
    const explicit = explicitWeight(column)
    if (explicit !== null) {
      weights.set(column.id, explicit)
      continue
    }
    if (column.baseStatus === 'DONE') {
      weights.set(column.id, DONE_WEIGHT)
      continue
    }
    if (!isFlowStatus(column.baseStatus)) {
      weights.set(column.id, 0)
      continue
    }
    const index = flow.indexOf(column)
    const count = flow.length
    const weight = count <= 1
      ? FLOW_WEIGHT_TOP
      : FLOW_WEIGHT_START + Math.round(((FLOW_WEIGHT_TOP - FLOW_WEIGHT_START) * index) / (count - 1))
    weights.set(column.id, clampWeight(weight))
  }
  return weights
}

/** Peso efetivo de uma coluna específica (0 quando ela não pertence ao conjunto). */
export function columnProgressWeight(column: ProgressColumn, columns: readonly ProgressColumn[]): number {
  return resolveColumnProgressWeights(columns).get(column.id) ?? 0
}

/**
 * Peso da coluna imediatamente anterior no fluxo — usada apenas como referência de leitura
 * do fluxo. Não interfere no avanço, que é o peso da própria coluna.
 */
export function previousColumnProgressWeight(columnId: string, columns: readonly ProgressColumn[]): number {
  const ordered = orderColumns(columns)
  const index = ordered.findIndex(column => column.id === columnId)
  if (index <= 0) return 0
  const weights = resolveColumnProgressWeights(ordered)
  return weights.get(ordered[index - 1]!.id) ?? 0
}

/**
 * Avanço de um card: o peso da coluna compatível com o status, ajustado pelo peso
 * explícito configurado. O checklist tem indicador próprio e não entra neste cálculo.
 */
export function computeAdvance(input: { columnWeight: number }): number {
  return clampWeight(input.columnWeight)
}

/** Média do avanço das folhas; conjunto vazio vale 0%. */
export function averageAdvance(values: readonly number[]): number {
  if (!values.length) return 0
  return clampWeight(values.reduce((total, value) => total + value, 0) / values.length)
}

/** Status que ficam fora de qualquer indicador de progresso (nem numerador nem denominador). */
export const PROGRESS_EXCLUDED_STATUSES: readonly string[] = ['CANCELLED', 'ARCHIVED']

/** Tipos que contam no progresso quando não têm filhos. `EXTERNAL` é dependência e fica à parte. */
export const PROGRESS_LEAF_TYPES: readonly string[] = ['TASK', 'BUG', 'STORY', 'EPIC']

/** O item entra no progresso? (cancelado e arquivado nunca entram) */
export function countsForProgress(status: string | null | undefined): boolean {
  return !status || !PROGRESS_EXCLUDED_STATUSES.includes(status)
}

/** O item é uma folha de progresso? Item sem filhos de tipo TASK, BUG, STORY ou EPIC. */
export function isProgressLeafType(type: string | null | undefined): boolean {
  return !!type && PROGRESS_LEAF_TYPES.includes(type)
}

export interface AdvanceItem {
  status?: string | null
  columnId?: string | null
}

/** Valor padrão quando o projeto não tem coluna do status do item. */
const STATUS_FALLBACK_WEIGHT: Record<string, number> = {
  IN_PROGRESS: FLOW_WEIGHT_START,
  IN_HOMOLOGATION: FLOW_WEIGHT_TOP,
  BLOCKED: 0,
}

/**
 * Cria a função que calcula o avanço de um item a partir das colunas do projeto.
 *
 * - `CANCELLED`/`ARCHIVED` → `null` (fora da conta);
 * - `DONE` → 100; `NOT_STARTED`/`PLANNED` → 0, em qualquer coluna;
 * - `IN_PROGRESS`/`IN_HOMOLOGATION` → faixa da própria coluna quando o `baseStatus` dela é
 *   o mesmo do item; senão, faixa da primeira coluna do projeto com esse status; sem
 *   nenhuma, 50 (andamento) ou 90 (homologação);
 * - `BLOCKED` → faixa da própria coluna quando ela é do fluxo (fica onde parou); fora do
 *   fluxo, 0 (bloqueado antes de começar);
 * - sem status informado → regra anterior, só pela coluna (compatibilidade).
 *
 * O checklist não influencia o avanço: ele tem barra própria no card.
 */
export function createAdvanceResolver(columns: readonly ProgressColumn[]): (item: AdvanceItem) => number | null {
  const ordered = orderColumns(columns)
  const weights = resolveColumnProgressWeights(ordered)
  const indexById = new Map(ordered.map((column, index) => [column.id, index]))

  function band(index: number): number {
    const column = ordered[index]!
    return computeAdvance({ columnWeight: weights.get(column.id) ?? 0 })
  }

  return (item: AdvanceItem): number | null => {
    const status = item.status ?? null
    if (!countsForProgress(status)) return null
    const index = item.columnId ? indexById.get(item.columnId) : undefined
    const column = index === undefined ? null : ordered[index]!
    if (!status) return index === undefined ? 0 : band(index)
    if (status === 'DONE') return DONE_WEIGHT
    if (status === 'NOT_STARTED' || status === 'PLANNED') return 0
    if (status === 'BLOCKED') {
      return column && index !== undefined && isFlowStatus(column.baseStatus) ? band(index) : 0
    }
    if (status === 'IN_PROGRESS' || status === 'IN_HOMOLOGATION') {
      if (column && index !== undefined && column.baseStatus === status) return band(index)
      const fallback = ordered.findIndex(candidate => candidate.baseStatus === status)
      if (fallback >= 0) return band(fallback)
      return STATUS_FALLBACK_WEIGHT[status] ?? 0
    }
    return index === undefined ? 0 : band(index)
  }
}

/**
 * Avanço de um conjunto de itens (média dos itens válidos) a partir das colunas do projeto.
 * Cancelados e arquivados ficam fora; conjunto sem item válido vale 0%. Use as colunas com o
 * valor explícito em `progressWeight` para que a derivação aconteça aqui, em um único lugar.
 */
export function itemsAdvance(columns: readonly ProgressColumn[], items: readonly AdvanceItem[]): number {
  const resolve = createAdvanceResolver(columns)
  return averageAdvance(items.map(resolve).filter((value): value is number => value !== null))
}

/**
 * Avanço de linhas agregadas (`count` itens com o mesmo status e coluna), usado por
 * consultas SQL agrupadas (dashboard, lista de projetos). Mesma regra de `itemsAdvance`.
 */
export function aggregatedAdvance(
  columns: readonly ProgressColumn[],
  rows: readonly { status?: string | null; columnId?: string | null; count: number }[],
): number {
  const resolve = createAdvanceResolver(columns)
  let total = 0
  let weighted = 0
  for (const row of rows) {
    const value = resolve({ status: row.status, columnId: row.columnId })
    if (value === null || row.count <= 0) continue
    total += row.count
    weighted += row.count * value
  }
  return total > 0 ? clampWeight(weighted / total) : 0
}

/**
 * Proporção de conclusão (folhas `DONE`) sobre o total — indicador distinto do avanço.
 * Cancelados e arquivados ficam fora do total.
 */
export function completionRatio(statuses: readonly string[]): number {
  const counted = statuses.filter(status => countsForProgress(status))
  if (!counted.length) return 0
  return clampWeight((counted.filter(status => status === 'DONE').length / counted.length) * 100)
}
