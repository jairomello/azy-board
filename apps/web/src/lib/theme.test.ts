import { describe, expect, test } from 'bun:test'
import { DAY_START_HOUR, NIGHT_START_HOUR, getEffectiveTheme, resolveThemeByTime } from './theme'

function at(hour: number, minute = 0): Date {
  return new Date(2026, 0, 15, hour, minute, 0, 0)
}

describe('resolveThemeByTime', () => {
  test('usa claro durante o dia e escuro à noite', () => {
    expect(resolveThemeByTime(at(10))).toBe('light')
    expect(resolveThemeByTime(at(22))).toBe('dark')
  })

  test('respeita os limites das faixas', () => {
    expect(resolveThemeByTime(at(DAY_START_HOUR - 1, 59))).toBe('dark')
    expect(resolveThemeByTime(at(DAY_START_HOUR, 0))).toBe('light')
    expect(resolveThemeByTime(at(NIGHT_START_HOUR - 1, 59))).toBe('light')
    expect(resolveThemeByTime(at(NIGHT_START_HOUR, 0))).toBe('dark')
    expect(resolveThemeByTime(at(0, 0))).toBe('dark')
  })
})

describe('getEffectiveTheme', () => {
  test('modo automático desligado usa o tema manual', () => {
    expect(getEffectiveTheme({ auto: false, manual: 'dark', date: at(10) })).toBe('dark')
    expect(getEffectiveTheme({ auto: false, manual: 'light', date: at(22) })).toBe('light')
  })

  test('modo automático ligado ignora o tema manual e segue o horário', () => {
    expect(getEffectiveTheme({ auto: true, manual: 'dark', date: at(10) })).toBe('light')
    expect(getEffectiveTheme({ auto: true, manual: 'light', date: at(22) })).toBe('dark')
  })
})
