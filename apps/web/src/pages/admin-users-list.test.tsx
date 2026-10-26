import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', name: 'Admin', email: 'admin@test.local', globalGroup: 'ADMIN', language: 'pt-BR', theme: 'light', lightShellTheme: 'petroleum' },
    showHiddenProjects: false,
  }),
}))
mockModule('../contexts/AssistantContext', () => ({ useAssistant: () => ({ setPageContext: () => {} }) }))
mockModule('../hooks/useAssistantCacheInvalidation', () => ({ useAssistantCacheInvalidation: () => {} }))

const { default: AdminUsersPage } = await import('./AdminUsersPage')

const allUsers = Array.from({ length: 30 }, (_, index) => ({
  id: `user-${index + 1}`,
  name: `Pessoa ${String(index + 1).padStart(2, '0')}`,
  email: `pessoa${index + 1}@test.local`,
  globalGroup: index % 3 === 0 ? 'ADMIN' : 'TEAM_MEMBER',
  avatarUrl: null,
}))

const requests: URLSearchParams[] = []
const fetchOriginal = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function installFetchStub() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://test.local')
    if (url.pathname.replace(/^\/api/, '') !== '/users') return jsonResponse({}, 404)
    const params = url.searchParams
    requests.push(params)
    const page = Number(params.get('page') ?? '1')
    const limit = Number(params.get('limit') ?? '25')
    const term = (params.get('q') ?? '').toLowerCase()
    const group = params.get('globalGroup') ?? ''
    let filtered = allUsers
    if (term) filtered = filtered.filter(user => user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term))
    if (group) filtered = filtered.filter(user => user.globalGroup === group)
    const start = (page - 1) * limit
    const data = filtered.slice(start, start + limit)
    return jsonResponse({ data, page, limit, total: filtered.length, hasMore: start + limit < filtered.length })
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

function requestedAfter(count: number): URLSearchParams | undefined {
  return requests.filter(params => Boolean(params.get('page')))[count - 1]
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  requests.length = 0
  installFetchStub()
})

afterEach(() => { globalThis.fetch = fetchOriginal })

describe('AdminUsersPage — listagem paginada e filtros', () => {
  test('formulário de cadastro desativa o autofill de credenciais do navegador', async () => {
    renderPage()
    await screen.findByText('Pessoa 01')
    const form = screen.getByLabelText('Nome').closest('form')
    expect(form).toHaveAttribute('autocomplete', 'off')
    expect(screen.getByLabelText('Nome')).toHaveAttribute('autocomplete', 'off')
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('autocomplete', 'off')
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('name', 'new-user-email')
  })

  test('mostra a primeira página e avança para a próxima', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Pessoa 01')).toBeInTheDocument()
    expect(screen.getByText('Pessoa 25')).toBeInTheDocument()
    expect(screen.queryByText('Pessoa 26')).toBeNull()
    expect(screen.getByText('Exibindo 1–25 de 30')).toBeInTheDocument()
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Próximo' }))

    expect(await screen.findByText('Pessoa 26')).toBeInTheDocument()
    expect(screen.queryByText('Pessoa 25')).toBeNull()
    expect(screen.getByText('Exibindo 26–30 de 30')).toBeInTheDocument()
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
    expect(requestedAfter(2)?.get('page')).toBe('2')
  })

  test('busca por nome ou e-mail volta para a primeira página e envia q', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pessoa 01')
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await screen.findByText('Pessoa 26')

    await user.type(screen.getByLabelText('Buscar por nome ou e-mail'), 'pessoa 07')
    await waitFor(() => expect(requestedAfter(requests.length)?.get('q')).toBe('pessoa 07'))

    expect(await screen.findByText('Pessoa 07')).toBeInTheDocument()
    expect(screen.queryByText('Pessoa 08')).toBeNull()
    const last = requestedAfter(requests.length)!
    expect(last.get('page')).toBe('1')
    expect(last.get('q')).toBe('pessoa 07')
  })

  test('filtro por grupo envia globalGroup e recalcula o total', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pessoa 01')

    await user.selectOptions(screen.getByLabelText('Filtrar por grupo'), 'ADMIN')
    await waitFor(() => expect(requestedAfter(requests.length)?.get('globalGroup')).toBe('ADMIN'))

    // ADMIN nos índices 0, 3, 6... → 10 usuários no total.
    expect(await screen.findByText('Exibindo 1–10 de 10')).toBeInTheDocument()
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument()
  })

  test('mostra mensagem quando nenhum usuário atende aos filtros', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pessoa 01')

    await user.type(screen.getByLabelText('Buscar por nome ou e-mail'), 'ninguem')
    expect(await screen.findByText('Nenhum usuário encontrado para os filtros atuais.')).toBeInTheDocument()
    expect(screen.getByText('Exibindo 0–0 de 0')).toBeInTheDocument()
  })
})
