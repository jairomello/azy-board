import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render } from '@testing-library/react'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

interface PreferencesUpdate {
  theme?: string
  lightShellTheme?: string
  language?: string
  autoThemeByTime?: boolean
}

const auth: {
  user: { theme?: string; autoThemeByTime?: boolean } | null
  updatePreferences: (preferences: PreferencesUpdate) => Promise<void>
} = { user: null, updatePreferences: async () => {} }

// `mock.module` existe em runtime, mas não nos tipos atuais do bun:test.
const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../contexts/AuthContext', () => ({ useAuth: () => auth }))
mockModule('./Toast', () => ({ useToast: () => ({ toast: () => {} }) }))

const { ThemeToggle } = await import('./ThemeToggle')

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  auth.user = null
  auth.updatePreferences = async () => {}
})

describe('ThemeToggle — modo automático por horário (Card T56)', () => {
  test('no modo automático fica desabilitado, mostra o ícone combinado e a dica', () => {
    auth.user = { theme: 'light', autoThemeByTime: true }
    const { container } = render(<ThemeToggle />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAttribute('aria-label', 'Desabilitado - modo automático selecionado.')
    expect(container.querySelector('.lucide-sun-moon')).not.toBeNull()
    expect(screen.getByText('Desabilitado - modo automático selecionado.')).toBeInTheDocument()
  })

  test('acionar no modo automático não altera a preferência', () => {
    const calls: PreferencesUpdate[] = []
    auth.user = { theme: 'light', autoThemeByTime: true }
    auth.updatePreferences = async (preferences) => { calls.push(preferences) }
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button'))
    expect(calls).toEqual([])
  })

  test('no modo manual permanece habilitado e alterna o tema', () => {
    const calls: PreferencesUpdate[] = []
    auth.user = { theme: 'dark', autoThemeByTime: false }
    auth.updatePreferences = async (preferences) => { calls.push(preferences) }
    const { container } = render(<ThemeToggle />)
    const button = screen.getByRole('button')
    expect(button).toBeEnabled()
    expect(button).toHaveAttribute('aria-label', 'Claro')
    expect(container.querySelector('.lucide-sun')).not.toBeNull()
    fireEvent.click(button)
    expect(calls).toEqual([{ theme: 'light' }])
  })
})
