import { describe, expect, test } from 'bun:test'
import {
  aggregatedAdvance,
  averageAdvance,
  columnProgressWeight,
  completionRatio,
  computeAdvance,
  countsForProgress,
  createAdvanceResolver,
  isProgressLeafType,
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

  test('coluna planejada vale 0 e não desloca a faixa do fluxo', () => {
    const weights = resolveColumnProgressWeights([
      column('backlog', 'NOT_STARTED', 0),
      column('planejado', 'PLANNED', 1),
      column('fazendo', 'IN_PROGRESS', 2),
      column('testar', 'IN_PROGRESS', 3),
      column('concluidas', 'DONE', 4),
    ])
    expect(weights.get('planejado')).toBe(0)
    // A faixa continua entre 50 e 90: PLANNED não consome posição.
    expect(weights.get('fazendo')).toBe(50)
    expect(weights.get('testar')).toBe(90)
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
  test('usa o peso da coluna', () => {
    expect(computeAdvance({ columnWeight: 90 })).toBe(90)
    expect(computeAdvance({ columnWeight: 50 })).toBe(50)
  })

  test('limita o peso ao intervalo de 0 a 100', () => {
    expect(computeAdvance({ columnWeight: 140 })).toBe(100)
    expect(computeAdvance({ columnWeight: -10 })).toBe(0)
    expect(computeAdvance({ columnWeight: Number.NaN })).toBe(0)
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

  test('checklist não altera a média do conjunto', () => {
    expect(itemsAdvance(columns, [{ columnId: 'fazendo' }])).toBe(50)
    expect(itemsAdvance(columns, [{ columnId: 'fazendo' }, { columnId: 'fazendo' }])).toBe(50)
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

  test('cancelado e arquivado ficam fora da conclusão', () => {
    expect(completionRatio(['DONE', 'CANCELLED', 'ARCHIVED', 'NOT_STARTED'])).toBe(50)
    expect(completionRatio(['CANCELLED'])).toBe(0)
  })
})

// B19 — o status define a faixa de avanço e a coluna refina dentro dela.
describe('avanço por status (B19)', () => {
  // Mesmo fluxo do projeto real: Backlog, A Fazer, Fazendo 50, A Testar 63, Testando 77,
  // Em Homologação 90, Concluídas 100.
  const real: ProgressColumn[] = [
    column('backlog', 'NOT_STARTED', 0),
    column('fazer', 'NOT_STARTED', 1),
    column('fazendo', 'IN_PROGRESS', 2),
    column('testar', 'IN_PROGRESS', 3),
    column('testando', 'IN_PROGRESS', 4),
    column('homolog', 'IN_HOMOLOGATION', 5),
    column('concluidas', 'DONE', 6),
  ]
  const resolve = createAdvanceResolver(real)

  test('pesos derivados do fluxo real', () => {
    const weights = resolveColumnProgressWeights(real)
    expect(['fazendo', 'testar', 'testando', 'homolog', 'concluidas'].map(id => weights.get(id))).toEqual([50, 63, 77, 90, 100])
  })

  test('T189: em homologação parado no Backlog vale 90, e não 0', () => {
    expect(resolve({ status: 'IN_HOMOLOGATION', columnId: 'backlog' })).toBe(90)
  })

  test('concluído vale 100 em qualquer coluna', () => {
    expect(resolve({ status: 'DONE', columnId: 'backlog' })).toBe(100)
    expect(resolve({ status: 'DONE', columnId: 'fazendo' })).toBe(100)
    expect(resolve({ status: 'DONE', columnId: 'concluidas' })).toBe(100)
  })

  test('não iniciado e planejado valem 0 mesmo em coluna do fluxo', () => {
    expect(resolve({ status: 'NOT_STARTED', columnId: 'fazendo' })).toBe(0)
    expect(resolve({ status: 'PLANNED', columnId: 'testar' })).toBe(0)
  })

  test('em andamento na coluna compatível usa o peso da coluna', () => {
    expect(resolve({ status: 'IN_PROGRESS', columnId: 'testar' })).toBe(63)
    expect(resolve({ status: 'IN_PROGRESS', columnId: 'testando' })).toBe(77)
  })

  test('em andamento fora de coluna compatível usa a primeira coluna em andamento', () => {
    expect(resolve({ status: 'IN_PROGRESS', columnId: 'backlog' })).toBe(50)
    expect(resolve({ status: 'IN_PROGRESS', columnId: 'homolog' })).toBe(50)
    expect(resolve({ status: 'IN_PROGRESS', columnId: null })).toBe(50)
  })

  test('checklist não altera o avanço da coluna usada', () => {
    // A faixa de "Fazendo" é 0→50; o checklist não afina mais esse percentual.
    expect(resolve({ status: 'IN_PROGRESS', columnId: 'backlog' })).toBe(50)
    expect(resolve({ status: 'IN_PROGRESS', columnId: 'testar' })).toBe(63)
  })

  test('bloqueado fica onde parou no fluxo e vale 0 antes de começar', () => {
    expect(resolve({ status: 'BLOCKED', columnId: 'testando' })).toBe(77)
    expect(resolve({ status: 'BLOCKED', columnId: 'fazer' })).toBe(0)
  })

  test('cancelado e arquivado ficam fora da conta', () => {
    expect(resolve({ status: 'CANCELLED', columnId: 'concluidas' })).toBeNull()
    expect(resolve({ status: 'ARCHIVED', columnId: 'fazendo' })).toBeNull()
    expect(countsForProgress('CANCELLED')).toBe(false)
    expect(countsForProgress('DONE')).toBe(true)
  })

  test('sem coluna do status no projeto usa o valor padrão do status', () => {
    const semHomologacao = createAdvanceResolver([column('fazer', 'NOT_STARTED', 0), column('fim', 'DONE', 1)])
    expect(semHomologacao({ status: 'IN_HOMOLOGATION', columnId: 'fazer' })).toBe(90)
    expect(semHomologacao({ status: 'IN_PROGRESS', columnId: 'fazer' })).toBe(50)
  })

  test('sem status informado mantém a regra anterior, só pela coluna', () => {
    expect(resolve({ columnId: 'testar' })).toBe(63)
    expect(resolve({ columnId: null })).toBe(0)
  })

  test('cancelado não entra no denominador da média', () => {
    expect(itemsAdvance(real, [
      { status: 'DONE', columnId: 'concluidas' },
      { status: 'CANCELLED', columnId: 'backlog' },
    ])).toBe(100)
    expect(itemsAdvance(real, [{ status: 'CANCELLED', columnId: 'backlog' }])).toBe(0)
  })

  test('linhas agregadas usam a mesma regra e ignoram cancelados', () => {
    expect(aggregatedAdvance(real, [
      { status: 'DONE', columnId: 'backlog', count: 3 },
      { status: 'IN_HOMOLOGATION', columnId: 'backlog', count: 1 },
      { status: 'CANCELLED', columnId: 'backlog', count: 10 },
    ])).toBe(98)
    expect(aggregatedAdvance(real, [])).toBe(0)
  })

  test('tipos que contam como folha de progresso', () => {
    expect(['TASK', 'BUG', 'STORY', 'EPIC'].every(isProgressLeafType)).toBe(true)
    expect(isProgressLeafType('EXTERNAL')).toBe(false)
  })
})
