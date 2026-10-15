import { describe, expect, test } from 'bun:test'
import { burnupData, burnupHasEvolution, hoursByAuthorData, progressData, rankingData, statusData, teamLoadData, tokenRecorteData, tokenSeriesData, tokenStatusData, tokensHaveSeries } from './dashboardAdapters'
import type { DashboardAging, DashboardBurnup, DashboardHours, DashboardSnapshot, DashboardTokens } from '@azy-board/ui-contracts'
import ptBRDescriptions from './i18n/locales/pt-BR/dashboardDescriptions.json'
import enDescriptions from './i18n/locales/en/dashboardDescriptions.json'
import esDescriptions from './i18n/locales/es/dashboardDescriptions.json'

const t = (key: string) => key

const snapshot = (overrides: Partial<DashboardSnapshot['boxes']> = {}): DashboardSnapshot => ({ coverage: { startedAt: null, partial: false }, filters: { applied: [], inapplicable: [] }, boxes: { progressScope: { total: 10, done: 4, completionPercent: 40, advance: 70, points: 20, donePoints: 8, estimationCoverage: 80 }, wip: { total: 3, byStatus: { DONE: 0, IN_PROGRESS: 2, BLOCKED: 1, NOT_STARTED: 0 }, byStatusPoints: { DONE: 0, IN_PROGRESS: 4, BLOCKED: 2, NOT_STARTED: 0 }, pointsCoverage: 80, items: [] }, blocked: { total: 0, items: [] }, overdue: { total: 0, items: [], remainingItems: [] }, teamLoad: { members: [], unassignedWip: 1, unassignedWipPoints: null, pointsCoverage: null }, ...overrides } })

describe('dashboard chart adapters', () => {
  test('normal data feeds the current visualizations', () => {
    const current = snapshot({ teamLoad: { members: [{ userId: 'u', userName: 'Ana', squadId: null, squadName: null, wipTotal: 2, wipPoints: 5, pointsCoverage: 50 }], unassignedWip: 0, unassignedWipPoints: null, pointsCoverage: 50 } })
    const burnup: DashboardBurnup = { partial: true, coverageStartedAt: '2026-01-01', series: [{ date: '2026-01-01', total: 2, done: 1, points: 4, donePoints: 2 }] }
    const hours: DashboardHours = { semantics: 'manual', totalMinutes: 150, byAuthor: [{ authorId: 'u', authorName: 'Ana', squadName: 'Core', totalMinutes: 150 }], pagination: { limit: 50, total: 2, hasMore: false, truncated: false, nextCursor: null }, totalRows: 2, rows: [{ id: 'l1', authorId: 'u', authorName: 'Ana', squadName: 'Core', itemId: 'i', versionId: null, moduleId: null, durationMin: 90, createdAt: '2026-01-02T10:00:00Z' }] }
    expect(progressData(current, t).donut.length).toBe(2); expect(progressData(current, t).advance).toBe(70); expect(statusData(current, 'items', t).length).toBe(4); expect(statusData(current, 'points', t).find(item => item.status === 'IN_PROGRESS')?.value).toBe(4); expect(statusData(current, 'items', t).find(item => item.status === 'IN_PROGRESS')?.label).toBe('inProgress'); expect(burnupData(burnup, 'points')[0].done).toBe(2); expect(teamLoadData(current, 'items', t)[0].value).toBe(2); expect(teamLoadData(current, 'points', t)[0].value).toBe(5); expect(hoursByAuthorData(hours, t)[0].value).toBe(150)
  })
  test('empty, zero-blocked, partial and many-item inputs stay finite', () => {
    const empty = snapshot(); const hours: DashboardHours = { semantics: '', totalMinutes: 0, rows: [] }
    expect(progressData(empty, t).donut[1].value).toBe(6); expect(JSON.stringify(hoursByAuthorData(hours, t))).toBe('[]'); expect(statusData(empty, 'items', t).length).toBe(4)
    const unestimated = teamLoadData(snapshot({ teamLoad: { members: [{ userId: 'u', userName: 'Sem pontos', squadId: null, squadName: null, wipTotal: 1, wipPoints: null, pointsCoverage: 0 }], unassignedWip: 0, unassignedWipPoints: null, pointsCoverage: 0 } }), 'points', t)[0]; expect(unestimated.name).toBe('Sem pontos'); expect(unestimated.value).toBe(0); expect(unestimated.pointsAvailable).toBe(false)
    const blockedSubset = teamLoadData(snapshot({ teamLoad: { members: [{ userId: 'u', userName: 'Bloqueada', squadId: null, squadName: null, wipTotal: 2, blockedSubset: 1, wipPoints: 5, blockedPoints: 2, pointsCoverage: 100 }], unassignedWip: 0, unassignedWipPoints: null, pointsCoverage: 100 } }), 'items', t)[0]; expect(blockedSubset.value).toBe(1)
  })
})

describe('adapter de tokens de IA (T80)', () => {
  const tokens = (overrides: Partial<DashboardTokens> = {}): DashboardTokens => ({
    coverageStartedAt: '2026-04-01', tokensStartedAt: '2026-04-01', partial: true, hasTokens: true,
    filters: { applied: [], inapplicable: ['from', 'to'] },
    boxes: {
      scope: { tokensInput: 1400, tokensOutput: 350, tokens: 1750, doneTokensInput: 1000, doneTokensOutput: 200, doneTokens: 1200, count: 3 },
      byStatus: [{ key: 'DONE', tokensInput: 1000, tokensOutput: 200, tokens: 1200, doneTokensInput: 1000, doneTokensOutput: 200, count: 1 }, { key: 'NOT_STARTED', tokensInput: 0, tokensOutput: 50, tokens: 50, doneTokensInput: 0, doneTokensOutput: 0, count: 1 }],
      byType: [], byModule: [{ key: 'm1', tokensInput: 1000, tokensOutput: 200, tokens: 1200, doneTokensInput: 0, doneTokensOutput: 0, count: 1 }, { key: null, tokensInput: 10, tokensOutput: 0, tokens: 10, doneTokensInput: 0, doneTokensOutput: 0, count: 1 }], bySprint: [], byVersion: [], byAssignee: [], bySquad: [],
    },
    series: [{ date: '2026-04-01', tokensInput: 1400, tokensOutput: 350, tokens: 1750, doneTokensInput: 1000, doneTokensOutput: 200, doneTokens: 1200 }, { date: '2026-04-02', tokensInput: 1500, tokensOutput: 400, tokens: 1900, doneTokensInput: 1500, doneTokensOutput: 400, doneTokens: 1900 }],
    ...overrides,
  })

  test('série, recortes por status e ranking por módulo', () => {
    const data = tokens()
    expect(tokenSeriesData(data).map(point => point.registered)).toEqual([1750, 1900])
    expect(tokenSeriesData(data).map(point => point.done)).toEqual([1200, 1900])
    expect(tokensHaveSeries(data)).toBe(true)
    expect(tokenStatusData(data, t).find(row => row.status === 'DONE')?.label).toBe('done')
    const ranking = tokenRecorteData(data.boxes.byModule, key => key ?? 'Sem módulo')
    expect(ranking.map(row => row.name)).toEqual(['m1', 'Sem módulo'])
    expect(ranking[0]?.value).toBe(1200)
  })

  test('projeto sem tokens não apresenta série como resultado', () => {
    const empty = tokens({ hasTokens: false, boxes: { ...tokens().boxes, scope: { tokensInput: 0, tokensOutput: 0, tokens: 0, doneTokensInput: 0, doneTokensOutput: 0, doneTokens: 0, count: 1 }, byModule: [], byStatus: [] }, series: [] })
    expect(tokensHaveSeries(empty)).toBe(false)
    expect(tokenSeriesData(empty)).toEqual([])
    expect(tokenRecorteData(empty.boxes.byModule, key => key ?? 'Sem módulo')).toEqual([])
  })
})

describe('rótulos dos rankings do dashboard (B8)', () => {
  test('usa o código sequencial ou o título, nunca o identificador técnico', () => {
    const aging: DashboardAging = { coverageStartedAt: null, items: [
      { id: '03aaeac2-0f8e-4223-be29-dedefb802d02', sequenceCode: 'T20', title: 'Sincronizar novamente pelo painel', ageHours: 48 },
      { id: '09c505e7-0bd6-4d20-9de4-33212e2bae48', title: 'Receber confirmação do salvamento', ageHours: 24 },
    ] }
    const ranking = rankingData(aging.items, 'aging')
    expect(ranking[0]?.name).toBe('T20')
    expect(ranking[1]?.name).toBe('Receber confirmação do salvamento')
    // O título completo permanece disponível para o tooltip.
    expect(ranking[0]?.title).toBe('Sincronizar novamente pelo painel')
    expect(ranking.every(item => !String(item.name).includes('03aaeac2'))).toBe(true)
  })

  test('carga da equipe abrevia o nome no eixo e preserva o completo no tooltip (B10/T76)', () => {
    const current = snapshot({ teamLoad: { members: [{ userId: 'u', userName: 'Thiago Corrêa Simas de Melo Porto', squadId: null, squadName: null, wipTotal: 27, wipPoints: null, pointsCoverage: 0 }], unassignedWip: 0, unassignedWipPoints: null, pointsCoverage: 0 } })
    const load = teamLoadData(current, 'items', t)[0]
    // O eixo abrevia para duas partes; o tooltip usa `title` com o nome completo.
    expect(load?.name).toBe('Thiago Porto')
    expect(load?.title).toBe('Thiago Corrêa Simas de Melo Porto')
  })

  test('ordena pelo mais antigo e limita a dez itens', () => {
    const items = Array.from({ length: 12 }, (_, index) => ({ id: `i-${index}`, sequenceCode: `T${index}`, title: `Item ${index}`, ageHours: index }))
    const ranking = rankingData(items, 'aging')
    expect(ranking).toHaveLength(10)
    expect(ranking[0]?.name).toBe('T11')
  })
})

describe('rótulos do dashboard vêm da tradução (B11)', () => {
  // O gate de i18n não enxerga literais que só aparecem como dado do gráfico; este teste
  // garante, por comportamento, que todo rótulo exibido passa pelo tradutor.
  const marked = (key: string) => `<${key}>`

  test('status, carga da equipe e horas usam o tradutor', () => {
    const current = snapshot({
      teamLoad: { members: [{ userId: 'u', userName: 'Ana', squadId: null, squadName: null, wipTotal: 1, wipPoints: null, pointsCoverage: 0 }], unassignedWip: 2, unassignedWipPoints: null, pointsCoverage: 0 },
    })
    // Rótulos de categoria vêm do tradutor; nomes de pessoa são dados.
    const translated = [
      ...statusData(current, 'items', marked).map(item => String(item.label)),
      ...progressData(current, marked).donut.map(item => String(item.name)),
    ]
    expect(translated.every(label => label.startsWith('<') && label.endsWith('>'))).toBe(true)
    // O rótulo de "sem responsável" também passa pelo tradutor.
    expect(teamLoadData(current, 'items', marked).map(item => item.name)).toContain('<unassigned>')
    // Horas sem autor usam a chave traduzida, não um literal em inglês.
    const hours: DashboardHours = { semantics: '', totalMinutes: 0, rows: [{ id: 'l', authorId: 'u', authorName: null, squadName: null, itemId: 'i', versionId: null, moduleId: null, durationMin: 30, createdAt: '2026-01-02T10:00:00Z' }] }
    expect(hoursByAuthorData(hours, marked)[0]?.name).toBe('<unknownAuthor>')
  })
})

describe('burnup sem evolução (T78)', () => {
  const serie = (pontos: Array<{ date: string; total: number; done: number; points: number; donePoints: number }>): DashboardBurnup =>
    ({ partial: true, coverageStartedAt: '2026-10-13T19:02:58.589Z', projection: { status: 'ROLLUP' }, series: pontos })

  test('sem conclusão e com escopo constante não há evolução', () => {
    const dados = serie([
      { date: '2026-10-13', total: 33, done: 0, points: 0, donePoints: 0 },
      { date: '2026-10-14', total: 33, done: 0, points: 0, donePoints: 0 },
      { date: '2026-10-15', total: 33, done: 0, points: 0, donePoints: 0 },
    ])
    expect(burnupHasEvolution(dados, 'items')).toBe(false)
  })

  test('conclusão em qualquer dia é evolução', () => {
    const dados = serie([
      { date: '2026-10-13', total: 33, done: 0, points: 0, donePoints: 0 },
      { date: '2026-10-14', total: 33, done: 2, points: 0, donePoints: 0 },
    ])
    expect(burnupHasEvolution(dados, 'items')).toBe(true)
  })

  test('variação de escopo sem conclusão é evolução', () => {
    const dados = serie([
      { date: '2026-10-13', total: 30, done: 0, points: 0, donePoints: 0 },
      { date: '2026-10-14', total: 33, done: 0, points: 0, donePoints: 0 },
    ])
    expect(burnupHasEvolution(dados, 'items')).toBe(true)
  })

  test('o recorte de pontos avalia pontos, não itens', () => {
    const dados = serie([
      { date: '2026-10-13', total: 33, done: 0, points: 5, donePoints: 0 },
      { date: '2026-10-14', total: 33, done: 0, points: 8, donePoints: 0 },
    ])
    expect(burnupHasEvolution(dados, 'items')).toBe(false)
    expect(burnupHasEvolution(dados, 'points')).toBe(true)
  })
})

describe('dashboard translations', () => {
  test('contains eight card descriptions and distinct WIP labels in every supported language', () => {
    const locales = [ptBRDescriptions, enDescriptions, esDescriptions]
    const descriptionKeys = ['descriptionProgressScope', 'descriptionWip', 'descriptionBlocked', 'descriptionOverdue', 'descriptionBurnup', 'descriptionAging', 'descriptionTeamLoad', 'descriptionHours'] as const
    for (const locale of locales) {
      expect(descriptionKeys.every(key => locale[key].length > 0)).toBe(true)
      expect(locale.wipByItems === locale.wipByPoints).toBe(false)
    }
  })
})
