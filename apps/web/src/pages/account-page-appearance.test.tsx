import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import * as bunTest from 'bun:test'
import i18n from '../i18n'
import type { LightShellTheme } from '@azy-board/ui-contracts'
import { SHELL_THEMES } from '../lib/shellThemes'

interface PreferencesUpdate {
  theme?: string
  lightShellTheme?: LightShellTheme
  language?: string
  autoThemeByTime?: boolean
}

const auth: {
  user: {
    id: string
    name: string
    email: string
    globalGroup: string
    language: string
    theme: string
    lightShellTheme: LightShellTheme
    autoThemeByTime: boolean
  }
  updatePreferences: (preferences: PreferencesUpdate) => Promise<void>
} = {
  user: {
    id: 'u1',
    name: 'Pessoa',
    email: 'pessoa@test.local',
    globalGroup: 'ADMIN',
    language: 'pt-BR',
    theme: 'light',
    lightShellTheme: 'petroleum',
    autoThemeByTime: false,
  },
  updatePreferences: async () => {},
}

// `mock.module` existe em runtime, mas não nos tipos atuais do bun:test.
const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../contexts/AuthContext', () => ({ useAuth: () => auth }))
mockModule('../contexts/AssistantContext', () => ({ useAssistant: () => ({ setPageContext: () => {} }) }))
mockModule('../hooks/useAssistantCacheInvalidation', () => ({ useAssistantCacheInvalidation: () => {} }))
mockModule('../components/Toast', () => ({ useToast: () => ({ toast: () => {} }) }))
// Seções vizinhas não fazem parte deste teste: evitam rede e estados próprios.
mockModule('../components/ApiKeysSection', () => ({ ApiKeysSection: () => null }))
mockModule('../components/ProfilePhotoSection', () => ({ ProfilePhotoSection: () => null }))
mockModule('../components/PasswordSection', () => ({ PasswordSection: () => null }))
mockModule('../components/ShowHiddenProjectsSwitch', () => ({ ShowHiddenProjectsSwitch: () => null }))

const { default: AccountPage } = await import('./AccountPage')

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountPage />
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  localStorage.clear()
  auth.user.lightShellTheme = 'petroleum'
  auth.updatePreferences = async () => {}
  await i18n.changeLanguage('pt-BR')
  document.documentElement.classList.remove('dark')
})

describe('AccountPage — seletor de presets do shell', () => {
  test('cada preset mostra a amostra clara e a escura no mesmo tile', () => {
    renderPage()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(SHELL_THEMES.length)

    for (const radio of radios) {
      const swatches = radio.querySelectorAll('[data-swatch]')
      expect(swatches).toHaveLength(2)
      expect(radio.querySelector('[data-swatch="light"]')).not.toBeNull()
      const dark = radio.querySelector('[data-swatch="dark"]') as HTMLElement | null
      expect(dark).not.toBeNull()
      const darkSidebar = dark!.firstElementChild as HTMLElement
      expect(darkSidebar.style.backgroundColor.length).toBeGreaterThan(0)
    }
  })

  test('o rótulo não restringe o preset ao modo claro', () => {
    renderPage()
    expect(screen.getByText('Tema do shell')).toBeInTheDocument()
    expect(screen.queryByText('Tema do shell claro')).not.toBeInTheDocument()
  })

  test('selecionar um preset persiste a escolha', async () => {
    const calls: PreferencesUpdate[] = []
    auth.updatePreferences = async preferences => { calls.push(preferences) }
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('radio', { name: 'Roxo' }))

    await waitFor(() => expect(calls).toEqual([{ lightShellTheme: 'amethyst' }]))
  })
})
