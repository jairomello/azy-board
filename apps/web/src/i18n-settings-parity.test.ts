import { describe, expect, test } from 'bun:test'
import ptBR from './i18n/locales/pt-BR/settings.json'
import en from './i18n/locales/en/settings.json'
import es from './i18n/locales/es/settings.json'

describe('paridade de chaves do namespace settings', () => {
  test('en e es têm exatamente as mesmas chaves de pt-BR', () => {
    const base = Object.keys(ptBR).sort()
    expect(Object.keys(en).sort()).toEqual(base)
    expect(Object.keys(es).sort()).toEqual(base)
  })

  test('as chaves do download da skill existem nos três idiomas', () => {
    for (const locale of [ptBR, en, es] as Record<string, unknown>[]) {
      expect(typeof locale.mcpGuideDownloadSkill).toBe('string')
      expect(typeof locale.mcpGuideDownloading).toBe('string')
      expect(typeof locale.mcpGuideDownloadFailed).toBe('string')
    }
  })

  test('as chaves da seção de senha existem nos três idiomas', () => {
    for (const locale of [ptBR, en, es] as Record<string, unknown>[]) {
      for (const key of ['passwordSectionTitle', 'passwordCurrentLabel', 'passwordNewLabel', 'passwordConfirmLabel', 'passwordSubmit', 'passwordChanged', 'passwordPolicyHint', 'passwordManagedByProvider']) {
        expect(typeof locale[key]).toBe('string')
      }
    }
  })
})
