/**
 * Prévia do arraste de cards (`docs/board-drag-animation.md`).
 *
 * O `verticalListSortingStrategy` do dnd-kit só desloca o item ativo quando o
 * destino é um item da **mesma** lista: ao pairar sobre outra coluna, `over` não
 * pertence ao `SortableContext` de origem e nenhum deslocamento acontece. Para
 * valer em qualquer destino, a prévia é resolvida aqui — a partir do ponteiro e da
 * geometria medida no início do arraste — e os componentes apenas desenham o
 * resultado: o card ativo sai do fluxo e a vaga entra no índice calculado.
 */

import { resolveDragTarget, type DragPointer, type DragTargetRect } from './dragAnimation'

/** Retângulo de viewport de um card, medido no início do arraste. */
export interface PreviewCardRect {
  id: string
  top: number
  bottom: number
  height: number
}

/** Coluna medida: alvo de soltura, cards na ordem exibida e o espaço entre eles. */
export interface PreviewColumn {
  /** Id do alvo de soltura da coluna (`lane:col:<columnId>`): o que o ponteiro acerta. */
  id: string
  /** Id da coluna. */
  columnId: string
  /** Retângulo da coluna. */
  rect: DragTargetRect
  /** Cards exibidos, na ordem, com as posições medidas no início do arraste. */
  cards: PreviewCardRect[]
  /** Espaço vertical entre cards consecutivos da lista. */
  gap: number
}

/** Card arrastado: o que sai do fluxo e dá altura à vaga. */
export interface PreviewSource {
  id: string
  columnId: string
  height: number
}

/** Resultado da prévia: onde a vaga aparece e qual card ancora a soltura. */
export interface DragPreview {
  /** Coluna de destino sob o ponteiro, ou `null` quando o ponteiro está fora. */
  targetId: string | null
  /** Coluna em que a vaga é desenhada; `null` quando não há destino. */
  columnId: string | null
  /** Índice de inserção da vaga na coluna (0 = antes do primeiro card). */
  index: number
  /** Altura da vaga, igual à do card arrastado. */
  height: number
  /** Card que fica logo depois da vaga; `null` quando a vaga é a última. */
  anchorId: string | null
  /** Ids dos outros cards da coluna, na ordem em que estão (o ativo fora do fluxo). */
  order: string[]
}

/** Prévia em repouso: sem destino, sem vaga. */
export function emptyPreview(height = 0): DragPreview {
  return { targetId: null, columnId: null, index: 0, height, anchorId: null, order: [] }
}

/**
 * Reposiciona os cards que ficam abaixo da origem: com o card arrastado fora do
 * fluxo, eles sobem uma altura de card mais o espaço entre cards. Sem isso, o
 * teste de ponto médio usaria posições de antes da saída do card.
 */
function semOCardArrastado(column: PreviewColumn, source: PreviewSource): PreviewCardRect[] {
  const origem = column.cards.findIndex(card => card.id === source.id)
  const deslocamento = origem >= 0 ? source.height + column.gap : 0
  return column.cards
    .filter(card => card.id !== source.id)
    .map(card => column.cards.indexOf(card) > origem && origem >= 0
      ? { ...card, top: card.top - deslocamento, bottom: card.bottom - deslocamento }
      : card)
}

/** Índice em que a vaga entra: depois de todos os cards cujo meio está acima do ponteiro. */
function insertionIndex(cards: readonly PreviewCardRect[], pointerY: number): number {
  return cards.filter(card => pointerY > card.top + card.height / 2).length
}

export function resolveDragPreview(
  pointer: DragPointer,
  source: PreviewSource,
  columns: readonly PreviewColumn[],
): DragPreview {
  const targetId = resolveDragTarget(pointer, columns.map(column => ({ id: column.id, rect: column.rect })))
  if (!targetId) return emptyPreview(source.height)

  const column = columns.find(candidate => candidate.id === targetId)
  if (!column) return emptyPreview(source.height)

  const restantes = semOCardArrastado(column, source)
  const index = insertionIndex(restantes, pointer.y)
  return {
    targetId,
    columnId: column.columnId,
    index,
    height: source.height,
    anchorId: restantes[index]?.id ?? null,
    order: restantes.map(card => card.id),
  }
}

/**
 * Âncora usada para persistir a soltura: o card que fica **depois** da vaga.
 *
 * `null` quando a vaga é a última — aí o chamador resolve o marcador da coluna
 * (`:drop:`), que manda inserir no fim sem confundir um card com a âncora. Usar o
 * último card como âncora inseriria o card **antes** dele, um slot acima da vaga.
 */
export function dropAnchor(preview: DragPreview): string | null {
  return preview.anchorId
}
