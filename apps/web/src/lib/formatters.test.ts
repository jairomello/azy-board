import { afterEach, describe, expect, test } from 'bun:test'
import i18n from '../i18n'
import { formatDate, formatDateValue, formatNumber, formatTokens, parseDateOnly } from './formatters'

afterEach(async () => { await i18n.changeLanguage('pt-BR') })

describe('formatação por locale', () => {
  test('data em pt-BR e en seguem o formato do idioma', async () => {
    // Data civil local: o teste é sobre o formato do locale, não sobre o fuso.
    const civil = new Date(2026, 9, 13)
    await i18n.changeLanguage('pt-BR')
    expect(formatDate(civil)).toBe('13/10/2026')
    await i18n.changeLanguage('en')
    expect(formatDate(civil)).toBe('10/13/2026')
  })

  test('decimal usa vírgula em pt-BR e ponto em en', async () => {
    await i18n.changeLanguage('pt-BR')
    expect(formatNumber(0.7)).toBe('0,7')
    await i18n.changeLanguage('en')
    expect(formatNumber(0.7)).toBe('0.7')
  })

  test('data curta de eixo mantém dia e mês', async () => {
    await i18n.changeLanguage('pt-BR')
    expect(formatDateValue('2026-10-13', { day: '2-digit', month: '2-digit' })).toBe('13/10')
  })

  test('total de tokens usa notação compacta por locale (T77)', async () => {
    const norm = (value: string) => value.replace(/\u00a0/g, ' ')
    await i18n.changeLanguage('pt-BR')
    expect(formatTokens(950)).toBe('950')
    expect(norm(formatTokens(1_500))).toBe('1,5 mil')
    expect(norm(formatTokens(9_800_000))).toBe('9,8 mi')
    await i18n.changeLanguage('en')
    expect(norm(formatTokens(9_800_000))).toBe('9.8M')
  })
})

describe('data civil e instante', () => {
  test('data sem hora não desloca de dia', async () => {
    await i18n.changeLanguage('pt-BR')
    const civil = parseDateOnly('2026-10-13')!
    // Mesma data local de `new Date(2026, 9, 13)` — o parser de instante daria o dia anterior.
    expect(civil.getTime()).toBe(new Date(2026, 9, 13).getTime())
    expect(civil.getDate()).toBe(13)
    expect(civil.getHours()).toBe(0)
    expect(formatDateValue('2026-10-13', { day: '2-digit', month: '2-digit' })).toBe('13/10')
  })

  test('instante com hora continua no fuso do usuário', async () => {
    await i18n.changeLanguage('pt-BR')
    const instante = '2026-10-13T19:02:58.589Z'
    expect(parseDateOnly(instante)).toBeNull()
    expect(formatDateValue(instante, { day: '2-digit', month: '2-digit', hour: '2-digit' }))
      .toBe(new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit' }).format(new Date(instante)))
  })

  test('valor que não é data volta como veio', async () => {
    await i18n.changeLanguage('pt-BR')
    expect(parseDateOnly('sem-data')).toBeNull()
    expect(formatDateValue('sem-data')).toBe('sem-data')
  })
})
