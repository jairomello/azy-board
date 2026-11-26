import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

// Teste de caracterização (P0 — rede de segurança do redesenho da página Conta).
// A7-06: modo claro/escuro e tema automático por horário na AccountPage. Com o
// automático ligado, a escolha manual fica desabilitada. Toda mudança passa por
// `updatePreferences` e mostra um toast de sucesso ou de erro.
// A6-10: no radiogroup "Tema do shell", as setas trocam o preset (direita/baixo
// avançam, esquerda/cima voltam, com volta circular) e salvam na hora.

interface Preferencias { theme?: string; lightShellTheme?: string; autoThemeByTime?: boolean }

const auth = {
  user: {
    id: 'u1', name: 'Pessoa', email: 'pessoa@test.local', globalGroup: 'ADMIN', language: 'pt-BR',
    theme: 'light', lightShellTheme: 'petroleum', autoThemeByTime: false,
  },
  updatePreferences: async (_preferencias: Preferencias) => {},
}
let toasts: Array<[string, string | undefined]> = []

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../contexts/AuthContext', () => ({ useAuth: () => auth }))
mockModule('../contexts/AssistantContext', () => ({ useAssistant: () => ({ setPageContext: () => {} }) }))
mockModule('../hooks/useAssistantCacheInvalidation', () => ({ useAssistantCacheInvalidation: () => {} }))
mockModule('../components/Toast', () => ({ useToast: () => ({ toast: (mensagem: string, tipo?: string) => { toasts.push([mensagem, tipo]) } }) }))
mockModule('../components/ApiKeysSection', () => ({ ApiKeysSection: () => null }))
mockModule('../components/McpConnectionsSection', () => ({ McpConnectionsSection: () => null }))
mockModule('../components/ProfilePhotoSection', () => ({ ProfilePhotoSection: () => null }))
mockModule('../components/PasswordSection', () => ({ PasswordSection: () => null }))
mockModule('../components/ShowHiddenProjectsSwitch', () => ({ ShowHiddenProjectsSwitch: () => null }))

const { default: AccountPage } = await import('./AccountPage')

function renderPagina() {
  return render(<MemoryRouter><AccountPage /></MemoryRouter>)
}

const modoDeCor = () => screen.getByRole('group', { name: 'Modo de cor' })
const automatico = () => screen.getByRole('switch', { name: /Tema automático por horário/ })

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  auth.user.theme = 'light'
  auth.user.autoThemeByTime = false
  auth.user.lightShellTheme = 'petroleum'
  auth.updatePreferences = async () => {}
  toasts = []
})

describe('AccountPage — modo de cor e tema automático (A7-06)', () => {
  test('mostra Claro e Escuro com o tema atual pressionado', () => {
    renderPagina()
    expect(within(modoDeCor()).getByRole('button', { name: 'Claro' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(modoDeCor()).getByRole('button', { name: 'Escuro' })).toHaveAttribute('aria-pressed', 'false')
    expect(automatico()).toHaveAttribute('aria-checked', 'false')
  })

  test('escolher Escuro e depois Claro chama updatePreferences com o tema e avisa sucesso', async () => {
    const chamadas: Preferencias[] = []
    auth.updatePreferences = async preferencias => { chamadas.push(preferencias) }
    const user = userEvent.setup()
    renderPagina()

    await user.click(within(modoDeCor()).getByRole('button', { name: 'Escuro' }))
    await user.click(within(modoDeCor()).getByRole('button', { name: 'Claro' }))
    await waitFor(() => expect(chamadas).toEqual([{ theme: 'dark' }, { theme: 'light' }]))
    await waitFor(() => expect(toasts).toEqual([['Preferência salva', undefined], ['Preferência salva', undefined]]))
  })

  test('ligar o tema automático chama updatePreferences com autoThemeByTime: true', async () => {
    const chamadas: Preferencias[] = []
    auth.updatePreferences = async preferencias => { chamadas.push(preferencias) }
    const user = userEvent.setup()
    renderPagina()

    await user.click(automatico())
    await waitFor(() => expect(chamadas).toEqual([{ autoThemeByTime: true }]))
  })

  test('com o automático ligado o manual fica desabilitado, com aviso, e o switch desliga', async () => {
    auth.user.autoThemeByTime = true
    const chamadas: Preferencias[] = []
    auth.updatePreferences = async preferencias => { chamadas.push(preferencias) }
    const user = userEvent.setup()
    renderPagina()

    expect(within(modoDeCor()).getByRole('button', { name: 'Claro' })).toBeDisabled()
    expect(within(modoDeCor()).getByRole('button', { name: 'Escuro' })).toBeDisabled()
    expect(screen.getByText('Desligue o tema automático para escolher manualmente.')).toBeInTheDocument()
    expect(automatico()).toHaveAttribute('aria-checked', 'true')

    await user.click(within(modoDeCor()).getByRole('button', { name: 'Escuro' }))
    expect(chamadas).toEqual([])
    await user.click(automatico())
    await waitFor(() => expect(chamadas).toEqual([{ autoThemeByTime: false }]))
  })

  test('sem o automático o aviso não aparece e o manual fica habilitado', () => {
    renderPagina()
    expect(screen.queryByText('Desligue o tema automático para escolher manualmente.')).toBeNull()
    expect(within(modoDeCor()).getByRole('button', { name: 'Escuro' })).toBeEnabled()
  })

  test('falha ao salvar mostra o toast de erro', async () => {
    auth.updatePreferences = async () => { throw new Error('offline') }
    const user = userEvent.setup()
    renderPagina()
    await user.click(within(modoDeCor()).getByRole('button', { name: 'Escuro' }))
    await waitFor(() => expect(toasts).toEqual([['Não foi possível salvar no servidor. A preferência local foi mantida.', 'error']]))
  })
})

describe('AccountPage — setas no radiogroup de temas do shell (A6-10)', () => {
  const grupoDeTemas = () => screen.getByRole('radiogroup', { name: 'Tema do shell' })
  const radioMarcado = () => within(grupoDeTemas()).getAllByRole('radio').find(radio => radio.getAttribute('aria-checked') === 'true')!

  test('o preset atual (petroleum) é o primeiro radio e o único marcado', () => {
    renderPagina()
    const radios = within(grupoDeTemas()).getAllByRole('radio')
    expect(radios.length).toBe(10)
    expect(radios.filter(radio => radio.getAttribute('aria-checked') === 'true')).toEqual([radios[0]!])
  })

  const casos: Array<[string, string]> = [
    ['ArrowRight', 'ocean'],
    ['ArrowDown', 'ocean'],
    ['ArrowLeft', 'silver'],
    ['ArrowUp', 'silver'],
  ]
  for (const [tecla, esperado] of casos) test(`${tecla} troca para ${esperado} e chama updatePreferences com o preset`, async () => {
    const chamadas: Preferencias[] = []
    auth.updatePreferences = async preferencias => { chamadas.push(preferencias) }
    renderPagina()

    fireEvent.keyDown(radioMarcado(), { key: tecla })
    await waitFor(() => expect(chamadas).toEqual([{ lightShellTheme: esperado }]))
    await waitFor(() => expect(toasts).toEqual([['Preferência salva', undefined]]))
  })

  test('a partir de um preset do meio, direita avança e esquerda volta um passo', async () => {
    auth.user.lightShellTheme = 'graphite'
    const chamadas: Preferencias[] = []
    auth.updatePreferences = async preferencias => { chamadas.push(preferencias) }
    renderPagina()

    fireEvent.keyDown(radioMarcado(), { key: 'ArrowRight' })
    fireEvent.keyDown(radioMarcado(), { key: 'ArrowLeft' })
    await waitFor(() => expect(chamadas).toEqual([{ lightShellTheme: 'classic' }, { lightShellTheme: 'emerald' }]))
  })

  test('teclas que não são setas não salvam nada', async () => {
    const chamadas: Preferencias[] = []
    auth.updatePreferences = async preferencias => { chamadas.push(preferencias) }
    renderPagina()

    for (const tecla of ['a', 'Home', 'End', ' ']) fireEvent.keyDown(radioMarcado(), { key: tecla })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(chamadas).toEqual([])
  })
})
