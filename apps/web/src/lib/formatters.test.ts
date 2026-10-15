import { afterEach, describe, expect, test } from 'bun:test'
import i18n from '../i18n'
import { formatDate, formatNumber } from './formatters'

afterEach(async () => { await i18n.changeLanguage('pt-BR') })

describe('formatação por locale', () => {
  test('data em pt-BR e en seguem o formato do idioma', async () => {
    await i18n.changeLanguage('pt-BR')
    expect(formatDate('2026-10-13')).toBe('13/10/2026')
    await i18n.changeLanguage('en')
    expect(formatDate('2026-10-13')).toBe('10/13/2026')
  })

  test('decimal usa vírgula em pt-BR e ponto em en', async () => {
    await i18n.changeLanguage('pt-BR')
    expect(formatNumber(0.7)).toBe('0,7')
    await i18n.changeLanguage('en')
    expect(formatNumber(0.7)).toBe('0.7')
  })

  test('data curta de eixo mantém dia e mês', async () => {
    await i18n.changeLanguage('pt-BR')
    expect(formatDate('2026-10-13', { day: '2-digit', month: '2-digit' })).toBe('13/10')
  })
})
