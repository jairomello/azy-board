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

const calls: Array<{ method: string; path: string }> = []
const fetchOriginal = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const project = { id: 'project-1', name: 'Projeto Planejado', description: null, role: 'ADMIN', boardMode: 'HIERARCHICAL', isRestricted: false, isHidden: false }

function installFetchStub() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = url.replace(/^\/api/, '').split('?')[0]
    calls.push({ method, path })
    if (method === 'GET' && path === '/projects') return jsonResponse([project])
    if (method === 'GET' && path === '/projects/project-1') return jsonResponse(project)
    if (method === 'GET' && path === '/projects/project-1/members') return jsonResponse([{ userId: 'u1', role: 'ADMIN' }])
    if (method === 'GET' && path === '/tenant/attachments/enabled') return jsonResponse({ enabled: false })
    return jsonResponse({}, 404)
  }) as typeof fetch
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  calls.length = 0
  installFetchStub()
})

afterEach(() => { globalThis.fetch = fetchOriginal })

describe('ProjectsPage — editar abre a modal de planejamento (T59)', () => {
  test('clicar em editar abre a ProjectPlanningModal do projeto correto', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProjectsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await screen.findByText('Projeto Planejado')
    await user.click(screen.getByRole('button', { name: /Editar projeto Projeto Planejado/ }))

    await screen.findByRole('dialog', { name: 'Planejamento do projeto' })
    await waitFor(() => expect(calls.some(call => call.path === '/projects/project-1')).toBe(true))
  })
})
