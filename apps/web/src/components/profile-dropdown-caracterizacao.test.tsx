import { screen } from '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

// Teste de caracterização (P0 — rede de segurança do redesenho do menu do avatar).
// Usa o AuthProvider real (só a API é simulada) para prender A7-01 a A7-04:
// abrir/fechar o dropdown, ir para /account, alternar "Projetos ocultos" na
// sessionStorage e sair (POST /auth/logout + limpeza da sessão). Também prende a
// ordem atual dos itens (Configurações da conta, separador, switch Projetos
// ocultos, separador, Sair) e que, com o cabeçalho ainda visível em /account,
// o clique em "Configurações da conta" fecha o menu.

const api = { chamadas: [] as Array<{ metodo: string; caminho: string; corpo?: unknown }> }
const usuario = {
  id: 'u1', name: 'Ana Souza', email: 'ana@empresa.com', avatarUrl: null, theme: 'light',
  lightShellTheme: 'petroleum', language: 'pt-BR', autoThemeByTime: false, globalGroup: 'ADMIN',
}

class MockApiError extends Error {
  status = 500
}

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../lib/api', () => ({
  ApiError: MockApiError,
  isAbortError: () => false,
  api: {
    get: async (caminho: string) => { api.chamadas.push({ metodo: 'GET', caminho }); return { user: usuario } },
    post: async (caminho: string, corpo: unknown) => { api.chamadas.push({ metodo: 'POST', caminho, corpo }); return {} },
    patch: async (caminho: string, corpo: unknown) => { api.chamadas.push({ metodo: 'PATCH', caminho, corpo }); return { user: usuario } },
  },
}))

const { AuthProvider, useAuth } = await import('../contexts/AuthContext')
const { ProfileDropdown } = await import('./ProfileDropdown')
const { queryClient } = await import('../lib/queryClient')

function Cabecalho() {
  const { user } = useAuth()
  return user ? <ProfileDropdown /> : <p>sem sessão</p>
}

function renderMenu() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <div data-testid="fora">área externa</div>
        <Routes>
          <Route path="/" element={<Cabecalho />} />
          <Route path="/account" element={<p>página da conta</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

// Variante com o cabeçalho num layout: o ProfileDropdown continua montado em
// /account, então dá para ver se o menu fechou depois da navegação.
function renderMenuComLayout() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<><Cabecalho /><Outlet /></>}>
            <Route path="/" element={<p>página inicial</p>} />
            <Route path="/account" element={<p>página da conta</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

/** Descreve os filhos diretos do painel do menu, na ordem do DOM. */
function estruturaDoMenu(): string[] {
  const painel = itemConta()!.parentElement as HTMLElement
  return Array.from(painel.children).map(filho => {
    const elemento = filho as HTMLElement
    if (elemento.tagName === 'BUTTON') return `item:${elemento.textContent?.trim()}`
    const interruptor = elemento.querySelector('[role="switch"]')
    if (interruptor) return `switch:${interruptor.getAttribute('aria-label') ?? interruptor.textContent?.trim()}`
    if (!elemento.textContent?.trim() && elemento.className.includes('border-t')) return 'separador'
    return `outro:${elemento.tagName}`
  })
}

const avatar = () => screen.getAllByRole('button', { name: 'Configurações da conta' }).find((botao: HTMLElement) => !botao.textContent?.includes('Configurações da conta'))!
const itemConta = () => screen.queryAllByRole('button', { name: 'Configurações da conta' }).find((botao: HTMLElement) => botao.textContent?.includes('Configurações da conta')) ?? null

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  api.chamadas = []
  sessionStorage.clear()
  localStorage.clear()
  queryClient.clear()
})

describe('ProfileDropdown — menu do avatar (A7-01 a A7-04)', () => {
  test('A7-01: o avatar abre o dropdown e clique fora fecha', async () => {
    const user = userEvent.setup()
    renderMenu()
    await screen.findByRole('button', { name: 'Configurações da conta' })
    expect(itemConta()).toBeNull()

    await user.click(avatar())
    expect(itemConta()).not.toBeNull()
    expect(screen.getByRole('switch', { name: 'Projetos ocultos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByTestId('fora'))
    await waitFor(() => expect(itemConta()).toBeNull())
    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull()

    // O avatar também alterna: abre e fecha.
    await user.click(avatar())
    expect(itemConta()).not.toBeNull()
    await user.click(avatar())
    expect(itemConta()).toBeNull()
  })

  test('A7-02: "Configurações da conta" navega para /account e fecha o menu', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(await screen.findByRole('button', { name: 'Configurações da conta' }))
    await user.click(itemConta()!)
    expect(await screen.findByText('página da conta')).toBeInTheDocument()
  })

  test('A7-03: o switch Projetos ocultos alterna a sessionStorage da sessão', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(await screen.findByRole('button', { name: 'Configurações da conta' }))

    const interruptor = screen.getByRole('switch', { name: 'Projetos ocultos' })
    expect(interruptor).toHaveAttribute('aria-checked', 'false')
    await user.click(interruptor)
    expect(screen.getByRole('switch', { name: 'Projetos ocultos' })).toHaveAttribute('aria-checked', 'true')
    expect(sessionStorage.getItem('show-hidden-projects')).toBe('true')
    // Mudar o switch não fecha o menu nem vai ao servidor.
    expect(itemConta()).not.toBeNull()
    expect(api.chamadas.filter(chamada => chamada.metodo !== 'GET')).toEqual([])

    await user.click(screen.getByRole('switch', { name: 'Projetos ocultos' }))
    expect(sessionStorage.getItem('show-hidden-projects')).toBe('false')
  })

  test('A7-04: Sair chama POST /auth/logout, zera ocultos, apaga rascunhos e limpa o cache', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem('show-hidden-projects', 'true')
    localStorage.setItem('item-draft:p-1:i-1:description', '{"value":"rascunho"}')
    localStorage.setItem('theme', 'light')
    queryClient.setQueryData(['auth', 'u1', 'projects'], [{ id: 'p-1' }])
    renderMenu()

    await user.click(await screen.findByRole('button', { name: 'Configurações da conta' }))
    await user.click(screen.getByRole('button', { name: 'Sair' }))

    expect(await screen.findByText('sem sessão')).toBeInTheDocument()
    expect(api.chamadas.filter(chamada => chamada.metodo === 'POST')).toEqual([{ metodo: 'POST', caminho: '/auth/logout', corpo: {} }])
    expect(sessionStorage.getItem('show-hidden-projects')).toBe('false')
    expect(localStorage.getItem('item-draft:p-1:i-1:description')).toBeNull()
    expect(localStorage.getItem('theme')).toBe('light')
    expect(queryClient.getQueryData(['auth', 'u1', 'projects'])).toBeUndefined()
  })

  test('A7-02: com o cabeçalho visível em /account, "Configurações da conta" navega e fecha o menu', async () => {
    const user = userEvent.setup()
    renderMenuComLayout()
    expect(await screen.findByText('página inicial')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Configurações da conta' }))
    expect(itemConta()).not.toBeNull()

    await user.click(itemConta()!)
    expect(await screen.findByText('página da conta')).toBeInTheDocument()
    // O avatar continua na tela, mas o painel do menu foi fechado.
    expect(avatar()).toBeInTheDocument()
    expect(itemConta()).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Projetos ocultos' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull()
  })

  test('ordem atual do menu: Configurações da conta, separador, Projetos ocultos, separador, Sair', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(await screen.findByRole('button', { name: 'Configurações da conta' }))
    expect(estruturaDoMenu()).toEqual([
      'item:Configurações da conta',
      'separador',
      'switch:Projetos ocultos',
      'separador',
      'item:Sair',
    ])
  })
})
