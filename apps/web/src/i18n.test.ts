import { describe, expect, test } from 'bun:test'
import i18n from './i18n'
import { formatDate, formatNumber } from './lib/formatters'

describe('i18n runtime contract', () => {
  test('changes visible translations without reloading', async () => {
    await i18n.changeLanguage('en')
    expect(i18n.t('greeting', { name: 'Jairo' })).toBe('Hello, Jairo')

    await i18n.changeLanguage('es')
    expect(i18n.t('greeting', { name: 'Jairo' })).toBe('Hola, Jairo')
    await i18n.changeLanguage('pt-BR')
  })

  test('keeps PT-BR as the runtime fallback', async () => {
    await i18n.changeLanguage('en')
    expect(i18n.t('accordion.activityHistoryTitle')).toBe('Change history')
    expect(i18n.t('missing.test.key')).toBe('missing.test.key')
    await i18n.changeLanguage('pt-BR')
  })

  // O mesmo status aparece no filtro (`board:statusInProgress`) e na coluna
  // Status da grade (`common:status.IN_PROGRESS`). Rótulos divergentes fazem o
  // usuário achar que o filtro não corresponde ao valor exibido.
  test('status label é idêntico entre filtro e coluna de status', async () => {
    const boardKeys: Record<string, string> = {
      NOT_STARTED: 'statusNotStarted',
      IN_PROGRESS: 'statusInProgress',
      BLOCKED: 'statusBlocked',
      DONE: 'statusDone',
      CANCELLED: 'statusCancelled',
    }
    for (const language of ['pt-BR', 'en', 'es']) {
      await i18n.changeLanguage(language)
      for (const [status, boardKey] of Object.entries(boardKeys)) {
        expect(i18n.t(`board:${boardKey}`)).toBe(i18n.t(`common:status.${status}`))
      }
    }
    await i18n.changeLanguage('pt-BR')
  })

  test('formats dates and numbers using the active locale', async () => {
    await i18n.changeLanguage('pt-BR')
    expect(formatDate('2026-09-09T15:00:00Z').includes('09/09/2026')).toBe(true)
    expect(formatNumber(1234567.89).includes(',')).toBe(true)

    await i18n.changeLanguage('en')
    expect(formatDate('2026-09-09T15:00:00Z').includes('09/09/2026')).toBe(true)
    expect(formatNumber(1234567.89).includes('.')).toBe(true)
    await i18n.changeLanguage('pt-BR')
  })
})
