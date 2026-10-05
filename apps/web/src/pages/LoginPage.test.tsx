import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import * as bunTest from 'bun:test'
import i18n from '../i18n'
import { limparEmailLembrado, gravarEmailLembrado } from '../lib/rememberedEmail'

type LoginCall = [string, string, boolean | undefined]
const loginCalls: LoginCall[] = []

// `mock.module` existe em runtime, mas não nos tipos atuais do bun:test.
const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: async (email: string, password: string, remember?: boolean) => {
      loginCalls.push([email, password, remember])
    },
  }),
}))

const { default: LoginPage } = await import('./LoginPage')

function renderLogin() {
  return render(<MemoryRouter><LoginPage /></MemoryRouter>)
}

describe('LoginPage — lembrar-me (card T31)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR')
    loginCalls.length = 0
    limparEmailLembrado()
  })

  test('pré-preenche o e-mail lembrado e começa com o checkbox desmarcado', () => {
    gravarEmailLembrado('eu@test.local')
    renderLogin()

    expect(screen.getByLabelText('E-mail')).toHaveValue('eu@test.local')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  test('envia remember=true quando o checkbox está marcado', async () => {
    const user = userEvent.setup()
    gravarEmailLembrado('eu@test.local')
    renderLogin()

    await user.type(screen.getByLabelText('Senha'), 'segredo')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(loginCalls.some(call => call[0] === 'eu@test.local' && call[1] === 'segredo' && call[2] === true)).toBe(true))
  })

  test('envia remember=false quando o checkbox está desmarcado', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('E-mail'), 'outro@test.local')
    await user.type(screen.getByLabelText('Senha'), 'segredo')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(loginCalls.some(call => call[0] === 'outro@test.local' && call[1] === 'segredo' && call[2] === false)).toBe(true))
  })
})
