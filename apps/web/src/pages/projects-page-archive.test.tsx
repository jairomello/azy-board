import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Admin', email: 'admin@test.local', globalGroup: 'ADMIN', language: 'pt-BR', theme: 'light', lightShellTheme: 'petroleum' }, showHiddenProjects: false }) }))
mockModule('../contexts/AssistantContext', () => ({ useAssistant: () => ({ setPageContext: () => {} }) }))
mockModule('../hooks/useAssistantCacheInvalidation', () => ({ useAssistantCacheInvalidation: () => {} }))
mockModule('../components/Toast', () => ({ useToast: () => ({ toast: () => {} }) }))

const { default: ProjectsPage } = await import('./ProjectsPage')

const activeProjects = [
  { id: 'p-1', name: 'Alpha Board', description: null, role: 'ADMIN', boardMode: 'HIERARCHICAL', isRestricted: false, isHidden: false, isArchived: false },
  { id: 'p-2', name: 'Beta Board', description: null, role: 'ADMIN', boardMode: 'HIERARCHICAL', isRestricted: false, isHidden: false, isArchived: false },
]
const archivedProjects = [
  { id: 'p-3', name: 'Gamma Arquivado', description: null, role: 'ADMIN', boardMode: 'HIERARCHICAL', isRestricted: false, isHidden: false, isArchived: true },
]

const calls: Array<{ method: string; url: string }> = []
const fetchOriginal = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function installFetchStub() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = url.replace(/^\/api/, '').split('?')[0]
    calls.push({ method, url })
    if (method === 'GET' && path === '/projects') {
      return jsonResponse(url.includes('includeArchived=true') ? archivedProjects : activeProjects)
    }
    if (method === 'POST' && path.endsWith('/archive')) return jsonResponse({ ok: true })
    if (method === 'POST' && path.endsWith('/unarchive')) return jsonResponse({ ok: true })
    if (method === 'GET' && path === '/tenant/attachments/enabled') return jsonResponse({ enabled: false })
    return jsonResponse({}, 404)
  }) as typeof fetch
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  calls.length = 0
  installFetchStub()
})

afterEach(() => { globalThis.fetch = fetchOriginal })

describe('ProjectsPage — busca de projetos (T81)', () => {
  test('filtra por nome sem distinguir maiúsculas e limpar restaura a lista', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Alpha Board')
    expect(screen.getByText('Beta Board')).toBeTruthy()

    const search = screen.getByLabelText('Buscar projetos')
    await user.type(search, 'beta')

    expect(screen.queryByText('Alpha Board')).toBeNull()
    expect(screen.getByText('Beta Board')).toBeTruthy()

    // O ambiente de teste não entrega o evento de limpeza do `user.clear`; o
    // backspace exercita o mesmo caminho controlado do campo de busca.
    await user.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}')
    expect(await screen.findByText('Alpha Board')).toBeTruthy()
  })

  test('busca sem correspondência mostra estado vazio específico', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Alpha Board')
    await user.type(screen.getByLabelText('Buscar projetos'), 'inexistente')

    expect(await screen.findByText('Nenhum projeto encontrado com essa busca')).toBeTruthy()
    expect(screen.queryByText('Alpha Board')).toBeNull()
  })
})

describe('ProjectsPage — arquivar e restaurar (T81)', () => {
  test('confirmar arquivamento envia POST e cancelar não envia', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Alpha Board')
    await user.click(screen.getByRole('button', { name: 'Arquivar projeto Alpha Board' }))

    // Cancelar mantém o projeto e não chama a API.
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(calls.some(call => call.method === 'POST' && call.url.includes('/archive'))).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Arquivar projeto Alpha Board' }))
    await user.click(screen.getByRole('button', { name: 'Arquivar' }))
    expect(calls.some(call => call.method === 'POST' && call.url.includes('/projects/p-1/archive'))).toBe(true)
  })

  test('alternar para arquivados pede includeArchived e permite restaurar', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Alpha Board')
    await user.click(screen.getByRole('button', { name: 'Ver arquivados' }))

    expect(await screen.findByText('Gamma Arquivado')).toBeTruthy()
    expect(calls.some(call => call.method === 'GET' && call.url.includes('includeArchived=true'))).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Restaurar projeto Gamma Arquivado' }))
    expect(calls.some(call => call.method === 'POST' && call.url.includes('/projects/p-3/unarchive'))).toBe(true)
  })
})
