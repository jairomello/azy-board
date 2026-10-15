import i18n from '../i18n'

export function currentLocale(): string {
  return i18n.resolvedLanguage ?? i18n.language ?? 'pt-BR'
}

export function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(currentLocale(), options ?? { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}

/**
 * Data sem hora (`YYYY-MM-DD`) como data civil no fuso local.
 *
 * `new Date('2026-10-13')` é interpretado como meia-noite UTC; em fusos a oeste de UTC
 * isso vira o dia anterior. Aqui a data é montada a partir das partes, no fuso local.
 */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/**
 * Formata data ou data-hora pelo locale. Valores sem hora são tratados como data civil
 * (sem deslocamento de fuso); valores com hora seguem o fuso do usuário. Valor que não
 * for data volta como veio, sem lançar erro.
 */
export function formatDateValue(value: string, options?: Intl.DateTimeFormatOptions): string {
  const civil = parseDateOnly(value)
  if (civil) return formatDate(civil, options)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : formatDate(parsed, options)
}

export function formatDateTime(value: string | Date): string {
  return formatDate(value, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(currentLocale(), options).format(value)
}

/**
 * T77 — total de tokens em formato compacto (ex.: 1,2 mi / 980 mil).
 * Valores abaixo de mil saem por extenso; o tooltip costuma trazer o número exato.
 */
export function formatTokens(value: number): string {
  return new Intl.NumberFormat(currentLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
