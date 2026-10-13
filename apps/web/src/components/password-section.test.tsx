import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const state = {
  provider: 'LOCAL' as string,
  providerName: null as string | null,
  patchCalls: [] as { path: string; body: Record<string, string> }[],
  patchError: null as Error | null,
}

class MockApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// `mock.module` existe em runtime, mas não nos tipos atuais do bun:test.
const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../lib/api', () => ({
  ApiError: MockApiError,
  api: {
    get: async () => ({ provider: state.provider, providerName: state.providerName, oauthStartUrl: null }),
    patch: async (path: string, body: Record<string, string>) => {
      state.patchCalls.push({ path, body })
      if (state.patchError) throw state.patchError
      return { ok: true }
    },
  },
}))

const { PasswordSection } = await import('./PasswordSection')

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  state.provider = 'LOCAL'
  state.providerName = null
  state.patchCalls = []
  state.patchError = null
})

describe('PasswordSection — troca de senha na conta', () => {
  test('com login local exibe os três campos e a ação de salvar', async () => {
    render(<PasswordSection />)
    expect(await screen.findByLabelText('Senha atual')).toBeInTheDocument()
    expect(screen.getByLabelText('Nova senha')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar nova senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alterar senha' })).toBeInTheDocument()
  })

  test('envia a troca e limpa os campos após sucesso', async () => {
    const user = userEvent.setup()
    render(<PasswordSection />)
    await user.type(await screen.findByLabelText('Senha atual'), 'Atual123!')
    await user.type(screen.getByLabelText('Nova senha'), 'Nova456!')
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'Nova456!')
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }))

    expect(state.patchCalls).toHaveLength(1)
    expect(state.patchCalls[0]!.path).toBe('/users/me/password')
    expect(state.patchCalls[0]!.body).toEqual({ currentPassword: 'Atual123!', newPassword: 'Nova456!', confirmPassword: 'Nova456!' })
    expect((screen.getByLabelText('Senha atual') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Nova senha') as HTMLInputElement).value).toBe('')
  })

  test('com provedor integrado não exibe campos e informa quem gerencia a senha', async () => {
    state.provider = 'MICROSOFT'
    state.providerName = 'Microsoft'
    render(<PasswordSection />)
    expect(await screen.findByText('Sua senha é gerenciada pelo provedor Microsoft.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Senha atual')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Alterar senha' })).toBeNull()
  })

  test('mostra a mensagem do servidor e mantém os campos editáveis', async () => {
    const user = userEvent.setup()
    state.patchError = new MockApiError('A confirmação não confere com a nova senha', 400)
    render(<PasswordSection />)
    await user.type(await screen.findByLabelText('Senha atual'), 'Atual123!')
    await user.type(screen.getByLabelText('Nova senha'), 'Nova456!')
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'Diferente456!')
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A confirmação não confere com a nova senha')
    expect((screen.getByLabelText('Nova senha') as HTMLInputElement).value).toBe('Nova456!')
    expect(screen.getByRole('button', { name: 'Alterar senha' })).toBeEnabled()
  })

  test('traduz a seção para en e es', async () => {
    await i18n.changeLanguage('en')
    render(<PasswordSection />)
    expect(await screen.findByLabelText('Current password')).toBeInTheDocument()
    await i18n.changeLanguage('es')
    render(<PasswordSection />)
    expect(await screen.findAllByLabelText('Contraseña actual')).not.toHaveLength(0)
  })
})
