import { describe, expect, test } from 'bun:test'
import { PROJECT_TIME_ZONE, UPDATED_WITHIN_VALUES, isUpdatedWithin, updatedWithinStart } from './index'

describe('janelas de última alteração (T57)', () => {
  // 2026-10-12T18:00:00Z = 15:00 em America/Sao_Paulo (UTC-3).
  const reference = new Date('2026-10-12T18:00:00.000Z')

  test('enuncia as opções aceitas', () => {
    expect(UPDATED_WITHIN_VALUES).toEqual(['1d', '2d', '3d', '5d', '1w', '1m', 'current-sprint'])
    expect(isUpdatedWithin('3d')).toBe(true)
    expect(isUpdatedWithin('2w')).toBe(false)
    expect(isUpdatedWithin(null)).toBe(false)
    expect(PROJECT_TIME_ZONE).toBe('America/Sao_Paulo')
  })

  test('último dia começa em 00:00 de ontem no fuso do projeto', () => {
    expect(updatedWithinStart('1d', reference)).toBe('2026-10-11T03:00:00.000Z')
  })

  test('opções numéricas e semana/mês retrocedem N dias-calendário', () => {
    expect(updatedWithinStart('2d', reference)).toBe('2026-10-10T03:00:00.000Z')
    expect(updatedWithinStart('3d', reference)).toBe('2026-10-09T03:00:00.000Z')
    expect(updatedWithinStart('5d', reference)).toBe('2026-10-07T03:00:00.000Z')
    expect(updatedWithinStart('1w', reference)).toBe('2026-10-05T03:00:00.000Z')
    expect(updatedWithinStart('1m', reference)).toBe('2026-09-12T03:00:00.000Z')
  })

  test('atravessa virada de mês e de ano', () => {
    expect(updatedWithinStart('1d', new Date('2026-11-01T12:00:00.000Z'))).toBe('2026-10-31T03:00:00.000Z')
    expect(updatedWithinStart('1d', new Date('2027-01-01T12:00:00.000Z'))).toBe('2026-12-31T03:00:00.000Z')
  })
})
