import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))

const { McpConnectionsSection } = await import('./McpConnectionsSection')

const grantGeral = {
  id: 'g1', clientName: 'Claude Code', resource: 'https://board.test/mcp', projectId: null, projectName: null,
  scopes: ['read', 'write'], createdAt: '2026-11-20T10:00:00.000Z', lastUsedAt: null,
}
const grantProjeto = {
  id: 'g2', clientName: 'Cursor', resource: 'https://board.test/mcp/projects/p-1', projectId: 'p-1', projectName: 'Projeto Rhiza',
  scopes: ['read'], createdAt: '2026-11-21T10:00:00.000Z', lastUsedAt: '2026-11-22T10:00:00.000Z',
}

const estado: { grants: unknown[]; chamadas: Array<{ metodo: string; url: string }> } = { grants: [], chamadas: [] }
const fetchOriginal = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderSecao() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><McpConnectionsSection /></QueryClientProvider>)
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  estado.chamadas = []
  estado.grants = [grantGeral, grantProjeto]
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const metodo = init?.method ?? 'GET'
    estado.chamadas.push({ metodo, url })
    if (metodo === 'DELETE') {
      const id = url.split('/').pop()
      estado.grants = estado.grants.filter(grant => (grant as { id: string }).id !== id)
      return jsonResponse({ revoked: true })
    }
    return jsonResponse({ grants: estado.grants })
  }) as typeof fetch
})

afterEach(() => { globalThis.fetch = fetchOriginal })

describe('McpConnectionsSection — conexões MCP em Minha conta', () => {
  test('lista app, recurso, escopos e datas', async () => {
    renderSecao()
    expect(await screen.findByText('Claude Code')).toBeInTheDocument()
    expect(estado.chamadas[0]).toEqual({ metodo: 'GET', url: '/api/oauth/mcp/grants' })
    expect(screen.getByText('Todos os projetos')).toBeInTheDocument()
    expect(screen.getByText('Projeto: Projeto Rhiza')).toBeInTheDocument()
    expect(screen.getByText('Escopos: read, write')).toBeInTheDocument()
    expect(screen.getByText('Escopos: read')).toBeInTheDocument()
    expect(screen.getByText(/Autorizada em: 20\/11\/2026/)).toBeInTheDocument()
    expect(screen.getByText('Nunca utilizada')).toBeInTheDocument()
    expect(screen.getByText(/Último uso: 22\/11\/2026/)).toBeInTheDocument()
  })

  test('revogar pede confirmação e remove a conexão da lista', async () => {
    const user = userEvent.setup()
    renderSecao()
    await user.click(await screen.findByRole('button', { name: 'Revogar conexão de Cursor' }))
    const dialogo = screen.getByRole('dialog', { name: 'Revogar conexão' })
    expect(estado.chamadas.some(chamada => chamada.metodo === 'DELETE')).toBe(false)

    await user.click(within(dialogo).getByRole('button', { name: 'Revogar conexão' }))
    await waitFor(() => expect(screen.queryByText('Cursor')).toBeNull())
    expect(estado.chamadas.filter(chamada => chamada.metodo === 'DELETE')).toEqual([{ metodo: 'DELETE', url: '/api/oauth/mcp/grants/g2' }])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Claude Code')).toBeInTheDocument()
  })

  test('cancelar a confirmação não revoga', async () => {
    const user = userEvent.setup()
    renderSecao()
    await user.click(await screen.findByRole('button', { name: 'Revogar conexão de Cursor' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(estado.chamadas.some(chamada => chamada.metodo === 'DELETE')).toBe(false)
  })

  test('sem conexões mostra o estado vazio', async () => {
    estado.grants = []
    renderSecao()
    expect(await screen.findByText('Nenhuma conexão MCP autorizada.')).toBeInTheDocument()
  })
})
