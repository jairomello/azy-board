import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const state: {
  user: { name: string; email: string } | null
  updateName: (name: string) => Promise<void>
  toast: (message: string, type?: string) => void
} = { user: null, updateName: async () => {}, toast: () => {} }

// `mock.module` existe em runtime, mas não nos tipos atuais do bun:test.
const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../contexts/AuthContext', () => ({ useAuth: () => ({ user: state.user, updateName: state.updateName }) }))
mockModule('./Toast', () => ({ useToast: () => ({ toast: state.toast }) }))

const { ProfileNameField } = await import('./ProfileNameField')

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  state.user = { name: 'Administrador', email: 'admin@test.local' }
  state.updateName = async () => {}
  state.toast = () => {}
})

describe('ProfileNameField — edição do nome (Card T54)', () => {
  test('salva o nome normalizado e reflete o valor salvo', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    state.updateName = async (name) => {
      calls.push(name)
      state.user = { ...state.user!, name }
    }
    render(<ProfileNameField />)
    const input = screen.getByLabelText('Nome de exibição') as HTMLInputElement
    await user.clear(input)
    await user.type(input, '  Jairo Silva  ')
    fireEvent.submit(input.closest('form') as HTMLFormElement)
    await waitFor(() => expect(calls).toEqual(['Jairo Silva']))
    await waitFor(() => expect((screen.getByLabelText('Nome de exibição') as HTMLInputElement).value).toBe('Jairo Silva'))
  })

  test('não chama a API para nome inválido e avisa o usuário', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    const toasts: string[] = []
    state.updateName = async (name) => { calls.push(name) }
    state.toast = (message) => { toasts.push(message) }
    render(<ProfileNameField />)
    const input = screen.getByLabelText('Nome de exibição') as HTMLInputElement
    await user.clear(input)
    await user.type(input, '   ')
    fireEvent.submit(input.closest('form') as HTMLFormElement)
    expect(calls).toEqual([])
    expect(toasts).toContain('Informe um nome entre 1 e 200 caracteres.')
  })

  test('exibe o e-mail como texto somente leitura', () => {
    render(<ProfileNameField />)
    expect(screen.getByText('admin@test.local')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('admin@test.local')).toBeNull()
  })
})
