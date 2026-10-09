import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const treeData = [
  {
    id: 'mod-1', name: 'Modulo', type: 'module', children: [
      {
        id: 'epic-1', title: 'Epic', type: 'EPIC',
        dependencyCount: 1,
        dependencies: [{ dependsOnItemId: 'epic-2', dependencyType: 'FS', lagDays: 0, dependsOn: { id: 'epic-2', title: 'Epic 2', type: 'EPIC', sequenceCode: 'E2' } }],
        children: [],
      },
    ],
  },
]

const fetchOriginal = globalThis.fetch

function installFetchStub() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/items/tree')) {
      return new Response(JSON.stringify(structuredClone(treeData)), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: 'não esperado' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
}

// `mock.module` existe em runtime, mas não nos tipos atuais do bun:test.
const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

const { TreeViewPage } = await import('./TreeViewPage')

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  installFetchStub()
})

afterEach(() => {
  globalThis.fetch = fetchOriginal
})

describe('TreeViewPage — coluna de dependências (Card T46)', () => {
  test('exibe os itens dependidos de cada linha por sequenceCode', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><TreeViewPage projectId="project-1" /></MemoryRouter></QueryClientProvider>)

    await waitFor(() => expect(screen.getByText('Dependências')).toBeInTheDocument())
    // O épico depende de outro épico (E2) — o cell mostra o código do dependido.
    await waitFor(() => expect(screen.getByText('E2')).toBeInTheDocument())
  })
})