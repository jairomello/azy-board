import { describe, expect, test } from 'bun:test'
import { suggestDatesForSprint } from './itemSprintDates'

const sprint = { startDate: '2026-10-10', endDate: '2026-10-24' }

describe('suggestDatesForSprint (T58)', () => {
  test('sugere as datas da sprint quando o usuário ainda não digitou', () => {
    expect(suggestDatesForSprint(sprint, { startDate: '', dueDate: '' }, false))
      .toEqual({ startDate: '2026-10-10', dueDate: '2026-10-24' })
  })

  test('preserva datas digitadas pelo usuário', () => {
    expect(suggestDatesForSprint(sprint, { startDate: '2026-01-01', dueDate: '2026-01-02' }, true))
      .toEqual({ startDate: '2026-01-01', dueDate: '2026-01-02' })
  })

  test('sugestão completa substitui datas não digitadas', () => {
    expect(suggestDatesForSprint(sprint, { startDate: '2026-01-01', dueDate: '' }, false))
      .toEqual({ startDate: '2026-10-10', dueDate: '2026-10-24' })
  })

  test('sprint removida limpa apenas sugestões não digitadas', () => {
    expect(suggestDatesForSprint(undefined, { startDate: '2026-10-10', dueDate: '2026-10-24' }, false))
      .toEqual({ startDate: '', dueDate: '' })
    expect(suggestDatesForSprint(undefined, { startDate: '2026-01-01', dueDate: '2026-01-02' }, true))
      .toEqual({ startDate: '2026-01-01', dueDate: '2026-01-02' })
  })

  test('atualiza a sugestão ao trocar de sprint', () => {
    const next = { startDate: '2026-11-01', endDate: '2026-11-14' }
    expect(suggestDatesForSprint(next, { startDate: '2026-10-10', dueDate: '2026-10-24' }, false))
      .toEqual({ startDate: '2026-11-01', dueDate: '2026-11-14' })
  })
})
