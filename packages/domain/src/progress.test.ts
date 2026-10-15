import { describe, expect, test } from 'bun:test'
import {
  averageAdvance,
  columnProgressWeight,
  completionRatio,
  computeAdvance,
  itemsAdvance,
  previousColumnProgressWeight,
  resolveColumnProgressWeights,
  type ProgressColumn,
} from './progress'

const column = (id: string, baseStatus: ProgressColumn['baseStatus'], position: number, progressWeight?: number | null): ProgressColumn =>
  ({ id, baseStatus, position, progressWeight })

const board = (): ProgressColumn[] => [
  column('backlog', 'NOT_STARTED', 0),
  column('fazer', 'NOT_STARTED', 1),
  column('fazendo', 'IN_PROGRESS', 2),
  column('testar', 'IN_PROGRESS', 3),
  column('concluidas', 'DONE', 4),
]

describe('derivação do peso de avanço por coluna', () => {
  test('projeto sem peso explícito: não iniciado 0, em progresso 50/90 e concluído 100', () => {
    const weights = resolveColumnProgressWeights(board())
    expect(weights.get('backlog')).toBe(0)
    expect(weights.get('fazer')).toBe(0)
    expect(weights.get('fazendo')).toBe(50)
    expect(weights.get('testar')).toBe(90)
    expect(weights.get('concluidas')).toBe(100)
  })

  test('três colunas em progresso distribuem a faixa entre 50 e 90', () => {
    const weights = resolveColumnProgressWeights([
      column('a', 'IN_PROGRESS', 0),
      column('b', 'IN_PROGRESS', 1),
      column('c', 'IN_PROGRESS', 2),
    ])
    expect([weights.get('a'), weights.get('b'), weights.get('c')]).toEqual([50, 70, 90])
  })

  test('uma única coluna em progresso vale 90, e não 100', () => {
    const weights = resolveColumnProgressWeights([column('unica', 'IN_PROGRESS', 0), column('fim', 'DONE', 1)])
    expect(weights.get('unica')).toBe(90)
  })

  test('coluna bloqueada participa da faixa do fluxo', () => {
    const weights = resolveColumnProgressWeights([
      column('fazendo', 'IN_PROGRESS', 0),
      column('bloqueado', 'BLOCKED', 1),
    ])
    expect([weights.get('fazendo'), weights.get('bloqueado')]).toEqual([50, 90])
  })

  test('peso explícito tem precedência e não entra na distribuição', () => {
    const weights = resolveColumnProgressWeights([
      column('fazendo', 'IN_PROGRESS', 0, 30),
      column('testar', 'IN_PROGRESS', 1),
    ])
    expect(weights.get('fazendo')).toBe(30)
    // Sobra apenas "testar" na distribuição: coluna única da faixa vale 90.
    expect(weights.get('testar')).toBe(90)
  })

  test('peso explícito fora da faixa é limitado a 0–100', () => {
    expect(columnProgressWeight(column('x', 'IN_PROGRESS', 0, 150), [column('x', 'IN_PROGRESS', 0, 150)])).toBe(100)
    expect(columnProgressWeight(column('y', 'IN_PROGRESS', 0, -10), [column('y', 'IN_PROGRESS', 0, -10)])).toBe(0)
  })

  test('coluna cancelada vale 0', () => {
    expect(columnProgressWeight(column('c', 'CANCELLED', 0), [column('c', 'CANCELLED', 0)])).toBe(0)
  })

  test('a ordem usa a posição da coluna, não a ordem de entrada', () => {
    const weights = resolveColumnProgressWeights([
      column('testar', 'IN_PROGRESS', 3),
      column('fazendo', 'IN_PROGRESS', 2),
    ])
    expect(weights.get('fazendo')).toBe(50)
    expect(weights.get('testar')).toBe(90)
  })
})

describe('peso da coluna anterior no fluxo', () => {
  test('primeira coluna tem piso 0 e as demais usam a anterior', () => {
    expect(previousColumnProgressWeight('backlog', board())).toBe(0)
    expect(previousColumnProgressWeight('fazendo', board())).toBe(0)
    expect(previousColumnProgressWeight('testar', board())).toBe(50)
    expect(previousColumnProgressWeight('concluidas', board())).toBe(90)
  })

  test('coluna desconhecida tem piso 0', () => {
    expect(previousColumnProgressWeight('inexistente', board())).toBe(0)
  })
})

describe('avanço de um card', () => {
  test('sem checklist usa o peso da coluna', () => {
    expect(computeAdvance({ columnWeight: 90, previousColumnWeight: 50 })).toBe(90)
    expect(computeAdvance({ columnWeight: 90, previousColumnWeight: 50, checklist: null })).toBe(90)
  })

  test('checklist parcial afina dentro da faixa da coluna', () => {
    // "Fazendo" (faixa 0→50) com metade dos itens marcados.
    expect(computeAdvance({ columnWeight: 50, previousColumnWeight: 0, checklist: { checked: 5, total: 10 } })).toBe(25)
    // "A Testar" (faixa 50→90) com metade dos itens marcados.
    expect(computeAdvance({ columnWeight: 90, previousColumnWeight: 50, checklist: { checked: 5, total: 10 } })).toBe(70)
  })

  test('checklist vazio ou sem itens não reduz o avanço', () => {
    expect(computeAdvance({ columnWeight: 90, previousColumnWeight: 50, checklist: { checked: 0, total: 10 } })).toBe(50)
    expect(computeAdvance({ columnWeight: 90, previousColumnWeight: 50, checklist: { checked: 0, total: 0 } })).toBe(90)
  })

  test('checklist completo alcança o topo da faixa da coluna', () => {
    expect(computeAdvance({ columnWeight: 90, previousColumnWeight: 50, checklist: { checked: 10, total: 10 } })).toBe(90)
  })

  test('marcar mais itens nunca reduz o avanço', () => {
    const readings = [0, 1, 3, 7, 10].map(checked =>
      computeAdvance({ columnWeight: 90, previousColumnWeight: 50, checklist: { checked, total: 10 } }))
    for (let index = 1; index < readings.length; index += 1) {
      expect(readings[index]!).toBeGreaterThanOrEqual(readings[index - 1]!)
    }
  })

  test('piso acima do peso da coluna não inverte a faixa', () => {
    expect(computeAdvance({ columnWeight: 20, previousColumnWeight: 90, checklist: { checked: 0, total: 4 } })).toBe(20)
  })
})

describe('média do avanço', () => {
  test('calcula a média das folhas e trata conjunto vazio', () => {
    expect(averageAdvance([90, 90, 0])).toBe(60)
    expect(averageAdvance([])).toBe(0)
  })

  test('arredonda para inteiro dentro de 0–100', () => {
    expect(averageAdvance([33, 33, 34])).toBe(33)
    expect(averageAdvance([100, 100])).toBe(100)
  })
})

describe('avanço de um conjunto de cards', () => {
  const columns: ProgressColumn[] = [
    { id: 'fazer', baseStatus: 'NOT_STARTED', position: 0 },
    { id: 'fazendo', baseStatus: 'IN_PROGRESS', position: 1 },
    { id: 'testar', baseStatus: 'IN_PROGRESS', position: 2 },
    { id: 'done', baseStatus: 'DONE', position: 3 },
  ]

  test('média das folhas pela coluna de cada card', () => {
    const advance = itemsAdvance(columns, [
      { columnId: 'testar' },
      { columnId: 'testar' },
      { columnId: 'fazer' },
    ])
    // 90, 90 e 0 → 60%
    expect(advance).toBe(60)
  })

  test('checklist refina dentro da faixa da coluna', () => {
    expect(itemsAdvance(columns, [{ columnId: 'fazendo', checklist: { checked: 4, total: 8 } }])).toBe(25)
    expect(itemsAdvance(columns, [{ columnId: 'fazendo', checklist: { checked: 8, total: 8 } }])).toBe(50)
  })

  test('card sem coluna conhecida vale 0 e conjunto vazio vale 0', () => {
    expect(itemsAdvance(columns, [{ columnId: null }])).toBe(0)
    expect(itemsAdvance(columns, [])).toBe(0)
  })

  test('respeita o peso explícito da coluna', () => {
    const withOverride = columns.map(column => column.id === 'testar' ? { ...column, progressWeight: 95 } : column)
    expect(itemsAdvance(withOverride, [{ columnId: 'testar' }])).toBe(95)
  })

  test('proporção de conclusão é distinta do avanço', () => {
    expect(completionRatio(['DONE', 'DONE', 'IN_PROGRESS', 'NOT_STARTED'])).toBe(50)
    expect(completionRatio([])).toBe(0)
  })
})
