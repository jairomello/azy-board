import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { LIGHT_SHELL_THEMES, isLightShellTheme } from '@azy-board/ui-contracts'
import { SHELL_THEMES } from './lib/shellThemes'
import ptBR from './i18n/locales/pt-BR/settings.json'
import en from './i18n/locales/en/settings.json'
import es from './i18n/locales/es/settings.json'

// Lido direto do arquivo: o teste garante que cada preset da lista canônica
// também exista como variante escura no CSS, e que nenhum preset fique órfão.
const GLOBALS_CSS = readFileSync(new URL('./styles/globals.css', import.meta.url), 'utf8')

// Tokens que cada variante escura precisa redefinir. Os semânticos
// (`--status-*`, `--dashboard-series-*`) ficam só na base escura, por design.
const DARK_PRESET_TOKENS = [
  '--background', '--foreground', '--card', '--card-foreground', '--popover', '--popover-foreground',
  '--primary', '--primary-foreground', '--secondary', '--secondary-foreground', '--muted',
  '--muted-foreground', '--accent', '--accent-foreground', '--border', '--input', '--ring',
  '--canvas', '--surface', '--surface-raised', '--surface-floating',
  '--board-canvas', '--board-surface', '--board-column', '--board-card', '--board-border',
  '--board-line', '--board-glow-a', '--board-glow-b', '--board-glow-c',
  '--board-card-glow-a', '--board-card-glow-b', '--board-shadow-focus',
  '--shell-sidebar', '--shell-header', '--shell-border', '--shell-foreground', '--shell-muted',
  '--shell-active', '--shell-accent', '--shell-accent-foreground',
] as const

function darkBlock(selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(GLOBALS_CSS)
  return match?.[1] ?? null
}

function declaredTokens(block: string): Set<string> {
  return new Set([...block.matchAll(/(--[a-z0-9-]+):/g)].map(match => match[1]!))
}

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

  test('cada amostra traz os dois modos preenchidos', () => {
    for (const theme of SHELL_THEMES) {
      for (const key of ['sidebar', 'header', 'accent', 'darkSidebar', 'darkHeader', 'darkAccent'] as const) {
        expect({ preset: theme.id, key, preenchido: theme[key].trim().length > 0 })
          .toEqual({ preset: theme.id, key, preenchido: true })
      }
    }
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

describe('variantes escuras dos presets', () => {
  test('a base escura existe como fallback', () => {
    const fallback = darkBlock(':root.dark')
    expect(fallback).not.toBeNull()
    for (const token of DARK_PRESET_TOKENS) expect(declaredTokens(fallback!).has(token)).toBe(true)
  })

  test('cada preset tem variante escura (petroleum é a base e o fallback)', () => {
    const fallback = darkBlock(':root.dark')!
    for (const preset of LIGHT_SHELL_THEMES) {
      const block = preset === 'petroleum'
        ? fallback
        : darkBlock(`:root.dark[data-light-shell-theme="${preset}"]`)
      expect(block).not.toBeNull()
      const tokens = declaredTokens(block!)
      for (const token of DARK_PRESET_TOKENS) {
        expect({ preset, token, declarado: tokens.has(token) }).toEqual({ preset, token, declarado: true })
      }
    }
  })

  test('não existe variante escura órfã fora da lista canônica', () => {
    const declared = [...GLOBALS_CSS.matchAll(/:root\.dark\[data-light-shell-theme="([a-z]+)"\]/g)]
      .map(match => match[1]!)
    expect(new Set([...declared, 'petroleum'])).toEqual(new Set(LIGHT_SHELL_THEMES))
  })

  test('as âncoras dos protótipos Grafite e Ameixa estão fixadas', () => {
    const graphite = darkBlock(':root.dark[data-light-shell-theme="graphite"]')!
    expect(graphite).toContain('--background: 240 10% 7%')
    expect(graphite).toContain('--board-canvas: #101114')
    expect(graphite).toContain('--shell-accent: #dadad6')

    const amethyst = darkBlock(':root.dark[data-light-shell-theme="amethyst"]')!
    expect(amethyst).toContain('--background: 260 21% 8%')
    expect(amethyst).toContain('--board-canvas: #121019')
    expect(amethyst).toContain('--shell-accent: #c6a0f5')
  })
})
