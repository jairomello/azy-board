import { describe, expect, test } from 'bun:test'
import { LIGHT_SHELL_THEMES, isLightShellTheme } from '@azy-board/ui-contracts'
import { SHELL_THEMES } from './lib/shellThemes'
import ptBR from './i18n/locales/pt-BR/settings.json'
import en from './i18n/locales/en/settings.json'
import es from './i18n/locales/es/settings.json'

describe('paridade dos presets de shell claro', () => {
  test('a lista canônica tem 10 presets, incluindo os 5 novos', () => {
    expect(LIGHT_SHELL_THEMES).toHaveLength(10)
    for (const preset of ['ruby', 'amber', 'amethyst', 'rose', 'silver'] as const) {
      expect(LIGHT_SHELL_THEMES).toContain(preset)
      expect(isLightShellTheme(preset)).toBe(true)
    }
  })

  test('as amostras da AccountPage cobrem a lista canônica na mesma ordem', () => {
    expect(SHELL_THEMES.map(theme => theme.id)).toEqual([...LIGHT_SHELL_THEMES])
  })

  test('cada preset tem rótulo nos três idiomas', () => {
    const labels = [ptBR, en, es].map(json => (json as { shellThemes: Record<string, string> }).shellThemes)
    for (const preset of LIGHT_SHELL_THEMES) {
      for (const locale of labels) expect(typeof locale[preset]).toBe('string')
    }
  })

  test('um valor desconhecido não é aceito como preset', () => {
    expect(isLightShellTheme('turquesa')).toBe(false)
    expect(isLightShellTheme(null)).toBe(false)
  })
})
