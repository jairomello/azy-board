import { describe, expect, test } from 'bun:test'
import { burnupData, hoursByAuthorData, progressData, rankingData, statusData, teamLoadData } from './dashboardAdapters'
import type { DashboardAging, DashboardBurnup, DashboardHours, DashboardSnapshot } from '@azy-board/ui-contracts'
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
