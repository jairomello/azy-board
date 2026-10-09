import { describe, expect, test } from 'bun:test'
import { isLightShellTheme, LIGHT_SHELL_THEMES } from '@azy-board/ui-contracts'
import { preferencesSchema } from './validation'

describe('preferências de shell claro (PATCH /api/users/me)', () => {
  test('aceita os 5 novos presets', () => {
    for (const preset of ['ruby', 'amber', 'amethyst', 'rose', 'silver'] as const) {
      expect(preferencesSchema.safeParse({ lightShellTheme: preset }).success).toBe(true)
    }
  })

  test('rejeita um preset desconhecido', () => {
    expect(preferencesSchema.safeParse({ lightShellTheme: 'turquesa' }).success).toBe(false)
  })

  test('a validação da rota e o schema compartilham a mesma lista canônica', () => {
    for (const preset of LIGHT_SHELL_THEMES) expect(isLightShellTheme(preset)).toBe(true)
  })
})
