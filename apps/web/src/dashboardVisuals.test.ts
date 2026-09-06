import { describe, expect, test } from 'bun:test'
import { agingData, burnupData, distributionData, hoursByAuthorData, overdueAgeData, progressData, statusData, teamLoadData } from './dashboardAdapters'
import type { DashboardAging, DashboardBurnup, DashboardHours, DashboardSnapshot } from '@azy-board/types'
import ptBRDescriptions from './i18n/locales/pt-BR/dashboardDescriptions.json'
import enDescriptions from './i18n/locales/en/dashboardDescriptions.json'
import esDescriptions from './i18n/locales/es/dashboardDescriptions.json'

const snapshot = (overrides: Partial<DashboardSnapshot['boxes']> = {}): DashboardSnapshot => ({ coverage: { startedAt: null, partial: false }, filters: { applied: [], inapplicable: [] }, boxes: { progressScope: { total: 10, done: 4, completionPercent: 40, points: 20, donePoints: 8, estimationCoverage: 80 }, wip: { total: 3, byStatus: { DONE: 0, IN_PROGRESS: 2, BLOCKED: 1, NOT_STARTED: 0 }, byStatusPoints: { DONE: 0, IN_PROGRESS: 4, BLOCKED: 2, NOT_STARTED: 0 }, pointsCoverage: 80, items: [] }, blocked: { total: 0, items: [] }, overdue: { total: 0, items: [], remainingItems: [] }, teamLoad: { members: [], unassignedWip: 1, unassignedWipPoints: null, pointsCoverage: null }, ...overrides } })

describe('dashboard chart adapters', () => {
  test('normal data feeds the current visualizations', () => {
    const current = snapshot({ teamLoad: { members: [{ userId: 'u', userName: 'Ana', squadId: null, squadName: null, wipTotal: 2, wipPoints: 5, pointsCoverage: 50 }], unassignedWip: 0, unassignedWipPoints: null, pointsCoverage: 50 } })
    const burnup: DashboardBurnup = { partial: true, coverageStartedAt: '2026-01-01', series: [{ date: '2026-01-01', total: 2, done: 1, points: 4, donePoints: 2 }] }
    const aging: DashboardAging = { coverageStartedAt: '2026-01-01', items: [{ id: 'i', title: 'Item', ageHours: 48 }] }
    const hours: DashboardHours = { semantics: 'manual', totalMinutes: 150, rows: [{ authorId: 'u', authorName: 'Ana', squadName: 'Core', itemId: 'i', versionId: null, moduleId: null, durationMin: 90, createdAt: '2026-01-02T10:00:00Z' }, { authorId: 'u', authorName: 'Ana', squadName: 'Core', itemId: 'j', versionId: null, moduleId: null, durationMin: 60, createdAt: '2026-01-03T10:00:00Z' }] }
    expect(progressData(current).donut.length).toBe(2); expect(statusData(current).length).toBe(4); expect(statusData(current, 'points').find(item => item.status === 'IN_PROGRESS')?.value).toBe(4); expect(distributionData([{ id: 'i', title: 'x', assigneeId: null }]).length).toBe(1); expect(overdueAgeData([]).length).toBe(3); expect(burnupData(burnup, 'points')[0].done).toBe(2); expect(agingData(aging)[1].value).toBe(1); expect(teamLoadData(current, 'items')[0].value).toBe(2); expect(teamLoadData(current, 'points')[0].value).toBe(5); expect(hoursByAuthorData(hours)[0].value).toBe(150)
  })
  test('empty, zero-blocked, partial and many-item inputs stay finite', () => {
    const empty = snapshot(); const hours: DashboardHours = { semantics: '', totalMinutes: 0, rows: [] }; const aging: DashboardAging = { coverageStartedAt: null, items: [] }
    expect(progressData(empty).donut[1].value).toBe(6); expect(JSON.stringify(distributionData(empty.boxes.blocked.items))).toBe('[]'); expect(overdueAgeData(empty.boxes.overdue.items).every(item => item.value === 0)).toBe(true); expect(agingData(aging).every(item => item.value === 0)).toBe(true); expect(JSON.stringify(hoursByAuthorData(hours))).toBe('[]'); expect(statusData(empty).length).toBe(4)
    const unestimated = teamLoadData(snapshot({ teamLoad: { members: [{ userId: 'u', userName: 'Sem pontos', squadId: null, squadName: null, wipTotal: 1, wipPoints: null, pointsCoverage: 0 }], unassignedWip: 0, unassignedWipPoints: null, pointsCoverage: 0 } }), 'points')[0]; expect(unestimated.name).toBe('Sem pontos'); expect(unestimated.value).toBe(0); expect(unestimated.pointsAvailable).toBe(false)
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
