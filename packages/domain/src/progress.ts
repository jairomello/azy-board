// Peso de avanço por coluna e cálculo do avanço de um card.
//
// O progresso do produto deixou de ser binário (DONE = 100%, resto = 0%) e passou a
// derivar da posição do card no fluxo: cada coluna tem um peso, e o checklist afina
// dentro da faixa da coluna. Fonte única da regra — API (dashboard) e web (board,
// sprint e árvore) usam exatamente estas funções.
//
// Sem valor explícito, o peso é derivado do `baseStatus` e da posição entre as colunas
// do mesmo status:
// - `NOT_STARTED`/`CANCELLED` = 0;
// - `DONE` = 100;
// - `IN_PROGRESS`/`BLOCKED` = faixa do fluxo: a última coluna vale 90; quando há mais de
//   uma, a primeira vale 50 e as demais são distribuídas entre 50 e 90.
//
// Um item bloqueado não inventa histórico nesta versão: a coluna `BLOCKED` participa da
// faixa do fluxo como uma etapa em progresso (congelar no último peso conhecido exigiria
// o histórico de eventos por item).
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

/** Progresso de checklist de um card (nome próprio para não colidir com o contrato de UI). */
export interface CardChecklistProgress {
  checked: number
  total: number
}

function isFlowStatus(status: ColumnBaseStatus): boolean {
  return status === 'IN_PROGRESS' || status === 'BLOCKED'
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
 * Peso da coluna imediatamente anterior no fluxo — o piso da faixa em que o checklist
 * posiciona o card. A primeira coluna do fluxo tem piso 0.
 */
export function previousColumnProgressWeight(columnId: string, columns: readonly ProgressColumn[]): number {
  const ordered = orderColumns(columns)
  const index = ordered.findIndex(column => column.id === columnId)
  if (index <= 0) return 0
  const weights = resolveColumnProgressWeights(ordered)
  return weights.get(ordered[index - 1]!.id) ?? 0
}

/**
 * Avanço de um card: o peso da coluna quando não há checklist; com checklist, a posição
 * do checklist dentro da faixa entre o peso da coluna anterior e o da coluna atual.
 * Marcar itens nunca reduz o avanço.
 */
export function computeAdvance(input: {
  columnWeight: number
  previousColumnWeight: number
  checklist?: CardChecklistProgress | null
}): number {
  const columnWeight = clampWeight(input.columnWeight)
  const checklist = input.checklist
  if (!checklist || checklist.total <= 0) return columnWeight
  const floor = Math.min(clampWeight(input.previousColumnWeight), columnWeight)
  const ratio = Math.max(0, Math.min(1, checklist.checked / checklist.total))
  return clampWeight(floor + ratio * (columnWeight - floor))
}

/** Média do avanço das folhas; conjunto vazio vale 0%. */
export function averageAdvance(values: readonly number[]): number {
  if (!values.length) return 0
  return clampWeight(values.reduce((total, value) => total + value, 0) / values.length)
}

/**
 * Avanço de um conjunto de cards (média das folhas) a partir das colunas do projeto.
 * O card sem coluna conhecida vale 0%. Use as colunas com o valor explícito em
 * `progressWeight` para que a derivação aconteça aqui, em um único lugar.
 */
export function itemsAdvance(
  columns: readonly ProgressColumn[],
  items: readonly { columnId?: string | null; checklist?: CardChecklistProgress | null }[],
): number {
  const ordered = orderColumns(columns)
  const weights = resolveColumnProgressWeights(ordered)
  const advances = items.map(item => {
    const index = ordered.findIndex(column => column.id === item.columnId)
    if (index < 0) return 0
    const columnWeight = weights.get(ordered[index]!.id) ?? 0
    const previous = index === 0 ? 0 : weights.get(ordered[index - 1]!.id) ?? 0
    return computeAdvance({ columnWeight, previousColumnWeight: previous, checklist: item.checklist ?? null })
  })
  return averageAdvance(advances)
}

/** Proporção de conclusão (folhas `DONE`) sobre o total — indicador distinto do avanço. */
export function completionRatio(statuses: readonly string[]): number {
  if (!statuses.length) return 0
  return clampWeight((statuses.filter(status => status === 'DONE').length / statuses.length) * 100)
}
