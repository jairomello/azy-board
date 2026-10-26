import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import * as bunTest from 'bun:test'
import i18n from '../i18n'
import type { GlobalGroup } from '@azy-board/domain'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
const state = {
  globalGroup: 'ROOT' as GlobalGroup,
  resetStatus: 200,
  resetCalls: [] as string[],
}

mockModule('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'root-1', name: 'Root', email: 'root@test.local', globalGroup: state.globalGroup, language: 'pt-BR', theme: 'light', lightShellTheme: 'petroleum' },
    showHiddenProjects: false,
  }),
}))
mockModule('../contexts/AssistantContext', () => ({ useAssistant: () => ({ setPageContext: () => {} }) }))
mockModule('../hooks/useAssistantCacheInvalidation', () => ({ useAssistantCacheInvalidation: () => {} }))

const { default: AdminUsersPage } = await import('./AdminUsersPage')

const managedUsers = [
  { id: 'root-1', name: 'Root', email: 'root@test.local', globalGroup: 'ROOT', avatarUrl: null },
  { id: 'user-2', name: 'Lorenzo Garcia', email: 'lorenzo@test.local', globalGroup: 'ADMIN', avatarUrl: null },
]

const fetchOriginal = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function installFetchStub() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = url.replace(/^\/api/, '').split('?')[0]
    if (method === 'GET' && path === '/users') return jsonResponse(managedUsers)
    if (method === 'POST' && path === '/users/user-2/reset-password') {
      state.resetCalls.push(path)
      if (state.resetStatus !== 200) return jsonResponse({ error: 'Permissão insuficiente' }, state.resetStatus)
      return jsonResponse({ ok: true, userId: 'user-2', temporaryPassword: 'Azy!Temporaria123' })
    }
    return jsonResponse({}, 404)
  }) as typeof fetch
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  state.globalGroup = 'ROOT'
  state.resetStatus = 200
  state.resetCalls = []
  installFetchStub()
})

afterEach(() => { globalThis.fetch = fetchOriginal })

describe('AdminUsersPage — redefinição de senha pelo ROOT', () => {
  test('ROOT confirma o reset e recebe a senha temporária uma única vez', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Lorenzo Garcia')
    const linha = screen.getByRole('row', { name: /Lorenzo Garcia/ })
    await user.click(within(linha).getByRole('button', { name: 'Redefinir senha' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Redefinir senha de Lorenzo Garcia')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirmar redefinição' }))
    expect(await screen.findByText('Azy!Temporaria123')).toBeInTheDocument()
    expect(screen.getByText(/Entregue a senha temporária para Lorenzo Garcia/)).toBeInTheDocument()
    expect(state.resetCalls).toEqual(['/users/user-2/reset-password'])

    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByText('Azy!Temporaria123')).toBeNull()
  })

  test('ADMIN não vê a ação de redefinir senha', async () => {
    state.globalGroup = 'ADMIN'
    renderPage()

    await screen.findByText('Lorenzo Garcia')
    expect(screen.queryByRole('button', { name: 'Redefinir senha' })).toBeNull()
    expect(screen.queryByText('Ações')).toBeNull()
  })

  test('falha do servidor aparece como alerta e mantém a lista', async () => {
    state.resetStatus = 403
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Lorenzo Garcia')
    const linha = screen.getByRole('row', { name: /Lorenzo Garcia/ })
    await user.click(within(linha).getByRole('button', { name: 'Redefinir senha' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar redefinição' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Permissão insuficiente')
    expect(screen.getByText('Lorenzo Garcia')).toBeInTheDocument()
    expect(screen.queryByText('Azy!Temporaria123')).toBeNull()
  })
})
