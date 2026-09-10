import i18n from '../i18n'

export function currentLocale(): string {
  return i18n.resolvedLanguage ?? i18n.language ?? 'pt-BR'
}

export function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(currentLocale(), options ?? { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}

export function formatDateTime(value: string | Date): string {
  return formatDate(value, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(currentLocale(), options).format(value)
}
