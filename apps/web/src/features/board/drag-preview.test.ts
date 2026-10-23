import { describe, expect, test } from 'bun:test'
import { dropAnchor, emptyPreview, resolveDragPreview, type PreviewColumn, type PreviewSource } from './model/dragPreview'

const fonte: PreviewSource = { id: 'a', columnId: 'todo', height: 100 }

function coluna(id: string, columnId: string, left: number, cards: Array<{ id: string; top: number }>): PreviewColumn {
  return {
    id,
    columnId,
    rect: { left, right: left + 292, top: 200, bottom: 900 },
    gap: 8,
    cards: cards.map(card => ({ id: card.id, top: card.top, bottom: card.top + 100, height: 100 })),
  }
}

const colunas: PreviewColumn[] = [
  coluna('lane:col:todo', 'todo', 100, [
    { id: 'a', top: 300 },
    { id: 'b', top: 408 },
    { id: 'c', top: 516 },
  ]),
  coluna('lane:col:doing', 'doing', 400, [
    { id: 'd', top: 300 },
    { id: 'e', top: 408 },
  ]),
]

describe('prévia do arraste', () => {
  test('sem coluna sob o ponteiro não há destino nem vaga', () => {
    const preview = resolveDragPreview({ x: 396, y: 400 }, fonte, colunas)
    expect(preview).toEqual(emptyPreview(100))
    expect(preview.targetId).toBeNull()
    expect(preview.columnId).toBeNull()
  })

  test('resolve a coluna, o índice e a âncora do destino', () => {
    // Acima do meio do card `d` (300 + 50).
    expect(resolveDragPreview({ x: 500, y: 320 }, fonte, colunas).index).toBe(0)
    expect(resolveDragPreview({ x: 500, y: 320 }, fonte, colunas).anchorId).toBe('d')

    // Entre os meios de `d` e `e`.
    const meio = resolveDragPreview({ x: 500, y: 390 }, fonte, colunas)
    expect(meio.index).toBe(1)
    expect(meio.anchorId).toBe('e')

    // Abaixo do meio do último card: a vaga vai para o fim.
    const fim = resolveDragPreview({ x: 500, y: 700 }, fonte, colunas)
    expect(fim.index).toBe(2)
    expect(fim.anchorId).toBeNull()
    expect(fim.order).toEqual(['d', 'e'])
    expect(dropAnchor(fim)).toBeNull()
    // Âncora vazia significa "inserir no fim", resolvida pelo marcador da coluna.
  })

  test('a vaga tem a altura do card arrastado e carrega a coluna de destino', () => {
    const preview = resolveDragPreview({ x: 500, y: 320 }, fonte, colunas)
    expect(preview.height).toBe(100)
    expect(preview.columnId).toBe('doing')
    expect(preview.targetId).toBe('lane:col:doing')
  })

  test('coluna vazia recebe a vaga no início e não tem âncora', () => {
    const vazia: PreviewColumn[] = [coluna('lane:col:vazia', 'vazia', 700, [])]
    const preview = resolveDragPreview({ x: 800, y: 500 }, fonte, vazia)
    expect(preview.index).toBe(0)
    expect(preview.anchorId).toBeNull()
    expect(dropAnchor(preview)).toBeNull()
  })

  test('na mesma coluna o card arrastado sai do fluxo e os de baixo sobem', () => {
    // `a` está no topo; `b` e `c` sobem 108 px quando `a` sai do fluxo.
    // Com o ponteiro logo acima do meio de `b` realocado (300 + 50), a vaga volta ao topo.
    const preview = resolveDragPreview({ x: 200, y: 320 }, fonte, colunas)
    expect(preview.index).toBe(0)
    expect(preview.anchorId).toBe('b')
    expect(preview.order).toEqual(['b', 'c'])

    // Ponteiro no fim da lista: a vaga vai para o último lugar.
    const fim = resolveDragPreview({ x: 200, y: 800 }, fonte, colunas)
    expect(fim.index).toBe(2)
    expect(dropAnchor(fim)).toBeNull()
  })

  test('respeita a borda da coluna como destino válido', () => {
    expect(resolveDragPreview({ x: 100, y: 200 }, fonte, colunas).targetId).toBe('lane:col:todo')
    expect(resolveDragPreview({ x: 99, y: 200 }, fonte, colunas).targetId).toBeNull()
  })
})
