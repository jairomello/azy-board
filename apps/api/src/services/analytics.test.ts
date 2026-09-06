import { describe, expect, test } from 'bun:test'
import { completionPercent, distributionByStatus, fillDailySeries, isEligibleLeaf, overdueGroups, period, topTenOldest } from '../routes/dashboard'

describe('fórmulas do dashboard', () => {
  test('aplica leaf rule antes da população e não duplica pais', () => {
    expect(isEligibleLeaf({ type: 'TASK', status: 'IN_PROGRESS' }, true)).toBe(true)
    expect(isEligibleLeaf({ type: 'TASK', status: 'IN_PROGRESS' }, false)).toBe(false)
    expect(isEligibleLeaf({ type: 'STORY', status: 'DONE' }, true)).toBe(false)
    expect(isEligibleLeaf({ type: 'TASK', status: 'ARCHIVED' }, true)).toBe(false)
  })

  test('retorna percentuais nulos sem população e preserva cobertura parcial', () => {
    expect(completionPercent(0, 0)).toBeNull()
    expect(completionPercent(1, 4)).toBe(25)
  })

  test('preenche cada dia com o último estado observado', () => {
    const values = new Map([['2026-08-01', { total: 2 }], ['2026-08-03', { total: 3 }]])
    expect(fillDailySeries(values, '2026-08-01', '2026-08-04', { total: 0 })).toEqual([
      { date: '2026-08-01', total: 2 }, { date: '2026-08-02', total: 2 }, { date: '2026-08-03', total: 3 }, { date: '2026-08-04', total: 3 },
    ])
  })

  test('aplica o limite comum de período', () => {
    expect(period('2026-01-01', '2027-01-10')).toContain('máximo')
    expect(period('2026-02-01', '2026-01-01')).toBe('Período inválido')
    expect(period('2026-01-01', '2026-01-02')).toBeNull()
  })

  test('distribui folhas por quantidade e pontos sem inventar pontos nulos', () => {
    const result = distributionByStatus([{ status: 'DONE', points: null }, { status: 'BLOCKED', points: 3 }, { status: 'NOT_STARTED', points: null }])
    expect(result.DONE).toEqual({ count: 1, points: 0 })
    expect(result.BLOCKED).toEqual({ count: 1, points: 3 })
  })

  test('limita rankings aos dez mais antigos sem mutar a entrada', () => {
    const items = Array.from({ length: 12 }, (_, age) => ({ id: age, age }))
    expect(topTenOldest(items).map(item => item.age)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
    expect(items[0].age).toBe(0)
  })

  test('separa atrasados e restantes sem duplicar folhas', () => {
    const rows = [{ id: 'late', status: 'IN_PROGRESS', dueDate: '2026-08-01' }, { id: 'done', status: 'DONE', dueDate: '2026-08-01' }, { id: 'open', status: 'IN_PROGRESS', dueDate: null }]
    const groups = overdueGroups(rows, '2026-08-31')
    expect(groups.overdue.map(row => row.id)).toEqual(['late'])
    expect(groups.remaining.map(row => row.id)).toEqual(['done', 'open'])
  })
})
