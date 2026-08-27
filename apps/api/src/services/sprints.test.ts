import { describe, expect, test } from 'bun:test'
import { validateSprintDates, validateSprintTransition } from './sprints'

describe('sprint lifecycle rules', () => {
  test('requires ordered ISO dates and a name', () => {
    expect(validateSprintDates('', '2026-01-01', '2026-01-02')).toBeTruthy()
    expect(validateSprintDates('Sprint 1', undefined, '2026-01-02')).toBeTruthy()
    expect(validateSprintDates('Sprint 1', '2026-02-01', '2026-01-02')).toBeTruthy()
    expect(validateSprintDates('Sprint 1', '2026-01-01', '2026-01-02')).toBeNull()
  })

  test('allows only proposed to open and open to closed', () => {
    expect(validateSprintTransition('PROPOSED', 'open')).toBeNull()
    expect(validateSprintTransition('OPEN', 'close')).toBeNull()
    expect(validateSprintTransition('CLOSED', 'open')).toBeTruthy()
    expect(validateSprintTransition('PROPOSED', 'close')).toBeTruthy()
  })
})
