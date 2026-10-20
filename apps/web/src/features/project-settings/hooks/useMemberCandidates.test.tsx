import '../../../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as bunTest from 'bun:test'
import type { ReactNode } from 'react'

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', globalGroup: 'ADMIN' } }),
}))

const { useMemberCandidates, MEMBER_CANDIDATES_PAGE_SIZE } = await import('./useMemberCandidates')

const urls: string[] = []
const fetchOriginal = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Primeira página com continuação; a segunda fecha a lista.
function installFetchStub() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    urls.push(url)
    const cursor = new URL(`http://test.local${url}`).searchParams.get('cursor')
    if (!cursor) {
      return jsonResponse({
        data: [{ id: 'u1', name: 'Ana Souza', email: 'ana@empresa.com', avatarUrl: null, globalGroup: 'TEAM_MEMBER', isMember: false }],
        page: 1, limit: MEMBER_CANDIDATES_PAGE_SIZE, total: 2, hasMore: true, nextCursor: 'c2',
      })
    }
    return jsonResponse({
      data: [{ id: 'u2', name: 'Bruno Lima', email: 'bruno@empresa.com', avatarUrl: null, globalGroup: 'TEAM_MEMBER', isMember: false }],
      page: 1, limit: MEMBER_CANDIDATES_PAGE_SIZE, total: 2, hasMore: false, nextCursor: null,
    })
  }) as typeof fetch
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => { urls.length = 0; installFetchStub() })
afterEach(() => { globalThis.fetch = fetchOriginal })

describe('useMemberCandidates — carregamento sob demanda da grade', () => {
  test('carrega a primeira página com busca e recorte de elegíveis', async () => {
    const { result } = renderHook(() => useMemberCandidates('p-1', '  ana  ', true), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.candidates.map(candidate => candidate.id)).toEqual(['u1'])
    expect(result.current.total).toBe(2)
    expect(result.current.hasMore).toBe(true)

    const [url] = urls
    expect(url).toContain('/projects/p-1/member-candidates?')
    expect(url).toContain('eligibleOnly=true')
    expect(url).toContain(`limit=${MEMBER_CANDIDATES_PAGE_SIZE}`)
    expect(url).toContain('q=ana')
    expect(url).not.toContain('cursor=')
  })

  test('loadMore acrescenta a próxima página mantendo a anterior', async () => {
    const { result } = renderHook(() => useMemberCandidates('p-1', '', true), { wrapper })

    await waitFor(() => expect(result.current.candidates).toHaveLength(1))
    await act(async () => { await result.current.loadMore() })

    await waitFor(() => expect(result.current.candidates).toHaveLength(2))
    expect(result.current.candidates.map(candidate => candidate.id)).toEqual(['u1', 'u2'])
    expect(result.current.hasMore).toBe(false)
    expect(urls.some(url => url.includes('cursor=c2'))).toBe(true)
  })

  test('não dispara a consulta com o dialog fechado', async () => {
    const { result } = renderHook(() => useMemberCandidates('p-1', '', false), { wrapper })

    // Dá chance ao efeito de consulta de rodar antes de afirmar que nada foi pedido.
    await act(async () => { await Promise.resolve() })
    expect(urls).toEqual([])
    expect(result.current.candidates).toEqual([])
    expect(result.current.loading).toBe(false)
  })
})
