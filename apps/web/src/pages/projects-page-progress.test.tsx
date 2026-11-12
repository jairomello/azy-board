import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
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

const fetchOriginal = globalThis.fetch
let archived = false

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const activeProject = {
  id: 'project-1', name: 'Projeto Progresso', description: null, role: 'ADMIN', boardMode: 'SIMPLE',
  isRestricted: false, isHidden: false, progress: { advance: 73, done: 8, total: 12 },
}
const archivedProject = {
  id: 'project-2', name: 'Projeto Arquivado', description: null, role: 'ADMIN', boardMode: 'SIMPLE',
  isRestricted: false, isHidden: false, progress: { advance: 100, done: 4, total: 4 },
}

function installFetchStub(progress: unknown = { advance: 73, done: 8, total: 12 }) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input).replace(/^\/api/, '').split('?')[0]
    if (path === '/projects') {
      const project = archived ? archivedProject : { ...activeProject, progress }
      return jsonResponse([project])
    }
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
  archived = false
  installFetchStub()
})

afterEach(() => { globalThis.fetch = fetchOriginal })

describe('ProjectsPage — progresso do projeto', () => {
  test('exibe percentual, contagem e valor acessível', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('73% concluído')).toBeTruthy())
    expect(screen.getByText('8/12 entregas')).toBeTruthy()
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('73')
    expect(bar.getAttribute('aria-valuetext')).toContain('8 de 12 entregas')
  })

  test('mostra 0/0 sem divisão inválida', async () => {
    installFetchStub({ advance: 0, done: 0, total: 0 })
    renderPage()

    await waitFor(() => expect(screen.getByText('0% concluído')).toBeTruthy())
    expect(screen.getByText('0/0 entregas')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
  })

  test('sinaliza progresso indisponível quando o resumo é nulo', async () => {
    installFetchStub(null)
    renderPage()

    await waitFor(() => expect(screen.getByText('Progresso indisponível')).toBeTruthy())
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  test('mantém a barra no recorte de arquivados', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText('Projeto Progresso')).toBeTruthy())

    archived = true
    await user.click(screen.getByRole('button', { name: 'Ver arquivados' }))

    await waitFor(() => expect(screen.getByText('Projeto Arquivado')).toBeTruthy())
    expect(screen.getByText('100% concluído')).toBeTruthy()
    expect(screen.getByText('4/4 entregas')).toBeTruthy()
  })
})
