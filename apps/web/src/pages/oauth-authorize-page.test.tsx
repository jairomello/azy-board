import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'ana@empresa.com', name: 'Ana' } }),
}))

const { default: OAuthAuthorizePage } = await import('./OAuthAuthorizePage')

type Chamada = { metodo: string; url: string; corpo: unknown }
const estado: { chamadas: Chamada[]; validate: { status: number; body: unknown }; assigned: string[] } = {
  chamadas: [],
  validate: { status: 200, body: {} },
  assigned: [],
}

const fetchOriginal = globalThis.fetch
const locationWithAssign = window.location as unknown as { assign: (url: string) => void }
const assignOriginal = locationWithAssign.assign

const PARAMS = 'response_type=code&client_id=cli-1&redirect_uri=http%3A%2F%2F127.0.0.1%3A3333%2Fcallback&code_challenge=abc&code_challenge_method=S256&state=xyz&resource=https%3A%2F%2Fboard.test%2Fmcp%2Fprojects%2Fp-1'

const validacaoOk = {
  client: { id: 'cli-1', name: 'Claude Code', redirectHost: '127.0.0.1:3333' },
  account: { email: 'ana@empresa.com', name: 'Ana' },
  scopes: ['read', 'write'],
  resource: 'https://board.test/mcp/projects/p-1',
  project: { id: 'p-1', name: 'Projeto Rhiza' },
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderPage(query = PARAMS) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/oauth/authorize?${query}`]}>
        <OAuthAuthorizePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  estado.chamadas = []
  estado.assigned = []
  estado.validate = { status: 200, body: validacaoOk }
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const metodo = init?.method ?? 'GET'
    estado.chamadas.push({ metodo, url, corpo: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (url.startsWith('/api/oauth/mcp/authorize/validate')) return jsonResponse(estado.validate.body, estado.validate.status)
    if (url === '/api/oauth/mcp/authorize/approve') return jsonResponse({ redirectUrl: 'http://127.0.0.1:3333/callback?code=c1&state=xyz' })
    if (url === '/api/oauth/mcp/authorize/deny') return jsonResponse({ redirectUrl: 'http://127.0.0.1:3333/callback?error=access_denied&state=xyz' })
    return jsonResponse({}, 404)
  }) as typeof fetch
  locationWithAssign.assign = (url: string) => { estado.assigned.push(url) }
})

afterEach(() => {
  globalThis.fetch = fetchOriginal
  locationWithAssign.assign = assignOriginal
})

describe('OAuthAuthorizePage — consentimento do MCP', () => {
  test('valida os parâmetros e mostra app, aviso, conta, projeto e escopos', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Claude Code quer acessar o Azy Board' })).toBeInTheDocument()
    expect(estado.chamadas[0]?.url).toBe(`/api/oauth/mcp/authorize/validate?${PARAMS}`)
    expect(screen.getByText(/App não verificado: o acesso será entregue em 127\.0\.0\.1:3333/)).toBeInTheDocument()
    expect(screen.getByText('Conectando como ana@empresa.com')).toBeInTheDocument()
    expect(screen.getByText('Projeto: Projeto Rhiza')).toBeInTheDocument()
    expect(screen.getByText('Ler projetos, cards e comentários que você pode ver')).toBeInTheDocument()
    expect(screen.getByText('Criar e editar cards, comentários e registros')).toBeInTheDocument()
    expect(screen.queryByText('Excluir cards e outros itens')).toBeNull()
  })

  test('aprovar envia os mesmos parâmetros e segue para o redirectUrl', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Aprovar' }))
    await waitFor(() => expect(estado.assigned).toEqual(['http://127.0.0.1:3333/callback?code=c1&state=xyz']))
    const approve = estado.chamadas.find(chamada => chamada.url === '/api/oauth/mcp/authorize/approve')
    expect(approve?.metodo).toBe('POST')
    expect(approve?.corpo).toEqual(Object.fromEntries(new URLSearchParams(PARAMS)))
  })

  test('negar chama deny e segue para o redirectUrl com access_denied', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Negar' }))
    await waitFor(() => expect(estado.assigned).toEqual(['http://127.0.0.1:3333/callback?error=access_denied&state=xyz']))
    expect(estado.chamadas.some(chamada => chamada.url === '/api/oauth/mcp/authorize/approve')).toBe(false)
  })

  test('não mostra projeto quando o recurso é o MCP geral', async () => {
    estado.validate = { status: 200, body: { ...validacaoOk, project: null, resource: 'https://board.test/mcp' } }
    renderPage()
    await screen.findByRole('heading', { name: 'Claude Code quer acessar o Azy Board' })
    expect(screen.queryByText(/^Projeto:/)).toBeNull()
  })

  test('erro de validação mostra a mensagem sem botões e sem redirecionar', async () => {
    estado.validate = { status: 400, body: { error: 'redirect_uri não registrado para este cliente', code: 'invalid_redirect_uri' } }
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('redirect_uri não registrado para este cliente')
    expect(screen.getByText('Não foi possível autorizar esta conexão')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aprovar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Negar' })).toBeNull()
    expect(estado.assigned).toEqual([])
  })
})
