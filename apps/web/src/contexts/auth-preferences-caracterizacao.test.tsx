import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, render, waitFor } from '@testing-library/react'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

// Teste de caracterização (P0 — rede de segurança do redesenho da página Conta).
// A7-07: `applyPreferences` grava theme / light-shell-theme / language no localStorage,
// marca `data-light-shell-theme` no <html>, troca o idioma do i18n e aplica o tema
// efetivo. `updatePreferences` é otimista: aplica, envia o PATCH /users/me e reaplica
// a resposta do servidor. Usa o AuthProvider real; só a API é simulada.

type Usuario = Record<string, unknown>
const usuarioBase: Usuario = {
  id: 'u1', name: 'Ana Souza', email: 'ana@empresa.com', avatarUrl: null, theme: 'light',
  lightShellTheme: 'petroleum', language: 'pt-BR', autoThemeByTime: false, globalGroup: 'ADMIN',
}

const api: {
  me: Usuario
  patches: Array<{ caminho: string; corpo: unknown }>
  respostaPatch: (corpo: Record<string, unknown>) => Promise<{ user: Usuario }>
} = { me: usuarioBase, patches: [], respostaPatch: async corpo => ({ user: { ...usuarioBase, ...corpo } }) }

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../lib/api', () => ({
  ApiError: class extends Error { status = 500 },
  isAbortError: () => false,
  api: {
    get: async () => ({ user: api.me }),
    post: async () => ({}),
    patch: (caminho: string, corpo: Record<string, unknown>) => { api.patches.push({ caminho, corpo }); return api.respostaPatch(corpo) },
  },
}))

const { AuthProvider, useAuth } = await import('./AuthContext')

let contexto: ReturnType<typeof useAuth> | null = null
function Captura() {
  contexto = useAuth()
  return <span data-testid="tema">{contexto.user ? `${contexto.user.theme}/${contexto.user.lightShellTheme}/${contexto.user.language}` : 'sem sessão'}</span>
}

async function renderProvider() {
  render(<AuthProvider><Captura /></AuthProvider>)
  await waitFor(() => expect(screen.getByTestId('tema').textContent).not.toBe('sem sessão'))
}

function limparPreferencias() {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  delete document.documentElement.dataset.lightShellTheme
}

beforeEach(async () => {
  limparPreferencias()
  api.me = { ...usuarioBase }
  api.patches = []
  api.respostaPatch = async corpo => ({ user: { ...usuarioBase, ...corpo } })
  contexto = null
  await i18n.changeLanguage('pt-BR')
})

afterEach(async () => {
  limparPreferencias()
  await i18n.changeLanguage('pt-BR')
})

describe('AuthContext — aplicação das preferências (A7-07)', () => {
  test('ao carregar a sessão aplica as preferências do usuário', async () => {
    api.me = { ...usuarioBase, theme: 'dark', lightShellTheme: 'amethyst', language: 'en' }
    await renderProvider()

    expect(localStorage.getItem('theme')).toBe('dark')
    expect(localStorage.getItem('light-shell-theme')).toBe('amethyst')
    expect(localStorage.getItem('language')).toBe('en')
    expect(localStorage.getItem('theme-auto-by-time')).toBe('false')
    expect(document.documentElement.dataset.lightShellTheme).toBe('amethyst')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    await waitFor(() => expect(i18n.language).toBe('en'))
  })

  test('preset de shell desconhecido vindo do servidor cai no padrão', async () => {
    api.me = { ...usuarioBase, lightShellTheme: 'turquesa' }
    await renderProvider()
    expect(document.documentElement.dataset.lightShellTheme).toBe('petroleum')
    expect(localStorage.getItem('light-shell-theme')).toBe('petroleum')
  })

  test('updatePreferences aplica antes da resposta (otimista) e envia PATCH /users/me', async () => {
    let liberar: (valor: { user: Usuario }) => void = () => {}
    api.respostaPatch = () => new Promise(resolve => { liberar = resolve })
    await renderProvider()

    let pendente: Promise<void> = Promise.resolve()
    act(() => { pendente = contexto!.updatePreferences({ theme: 'dark', lightShellTheme: 'ruby', language: 'es' }) })

    // Antes de o servidor responder, tudo já foi aplicado localmente.
    expect(api.patches).toEqual([{ caminho: '/users/me', corpo: { theme: 'dark', lightShellTheme: 'ruby', language: 'es' } }])
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(localStorage.getItem('light-shell-theme')).toBe('ruby')
    expect(localStorage.getItem('language')).toBe('es')
    expect(document.documentElement.dataset.lightShellTheme).toBe('ruby')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    await waitFor(() => expect(screen.getByTestId('tema').textContent).toBe('dark/ruby/es'))

    // A resposta do servidor é reaplicada por cima do otimista.
    await act(async () => {
      liberar({ user: { ...usuarioBase, theme: 'dark', lightShellTheme: 'amber', language: 'es' } })
      await pendente
    })
    expect(localStorage.getItem('light-shell-theme')).toBe('amber')
    expect(document.documentElement.dataset.lightShellTheme).toBe('amber')
    expect(screen.getByTestId('tema').textContent).toBe('dark/amber/es')
    await waitFor(() => expect(i18n.language).toBe('es'))
  })

  test('voltar para claro remove a classe dark do documento', async () => {
    api.me = { ...usuarioBase, theme: 'dark' }
    await renderProvider()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    await act(async () => { await contexto!.updatePreferences({ theme: 'light' }) })
    expect(localStorage.getItem('theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  test('autoThemeByTime é persistido no localStorage e enviado ao servidor', async () => {
    await renderProvider()
    await act(async () => { await contexto!.updatePreferences({ autoThemeByTime: true }) })
    expect(api.patches).toEqual([{ caminho: '/users/me', corpo: { autoThemeByTime: true } }])
    expect(localStorage.getItem('theme-auto-by-time')).toBe('true')
  })
})
