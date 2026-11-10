import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const treeData = [
  {
    id: 'mod-1', name: 'Modulo', type: 'module', children: [
      {
        id: 'epic-1', title: 'Epic', type: 'EPIC',
        updatedAt: '2026-11-01T10:00:00.000Z',
        assignee: { id: 'user-1', name: 'Thiago Corrêa Simas de Melo Porto' },
        actualStartDate: '2026-01-10',
        actualDueDate: '2026-01-20',
        assigneeLabel: 'Infra Vivo',
        externalSource: 'planilha',
        externalRef: 'REF-1',
        dependencyCount: 1,
        dependencies: [{ dependsOnItemId: 'epic-2', dependencyType: 'FS', lagDays: 0, dependsOn: { id: 'epic-2', title: 'Epic 2', type: 'EPIC', sequenceCode: 'E2' } }],
        children: [],
      },
    ],
  },
]

const fetchOriginal = globalThis.fetch
const patchCalls: Array<{ path: string; body: Record<string, unknown> }> = []

function installFetchStub() {
  patchCalls.length = 0
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (method === 'PATCH' && url.includes('/projects/project-1/items/')) {
      const rawBody = init?.body ?? (input instanceof Request ? input.body : null)
      let body: Record<string, unknown> = {}
      if (typeof rawBody === 'string') {
        body = JSON.parse(rawBody) as Record<string, unknown>
      }
      patchCalls.push({ path: url, body })
      return new Response(JSON.stringify({ item: { id: 'epic-1', status: body.status ?? 'NOT_STARTED' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
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
  localStorage.clear()
  installFetchStub()
})

afterEach(() => {
  cleanup()
  globalThis.fetch = fetchOriginal
})

describe('TreeViewPage — coluna Responsável (T76)', () => {
  test('exibe o nome em duas partes e o completo no tooltip', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><TreeViewPage projectId="project-1" canEdit={false} /></MemoryRouter></QueryClientProvider>)

    const celula = await screen.findByTitle('Thiago Corrêa Simas de Melo Porto')
    expect(celula.textContent).toBe('Thiago Porto')
  })
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

describe('TreeViewPage — colunas de datas realizadas e responsável externo', () => {
  test('exibe as colunas novas quando incluídas na grade', async () => {
    localStorage.setItem('tree-grid-columns:user-1:project-1', JSON.stringify([
      'name', 'status', 'actualStartDate', 'actualDueDate', 'assigneeLabel', 'externalRef', 'actions',
    ]))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><TreeViewPage projectId="project-1" /></MemoryRouter></QueryClientProvider>)

    await waitFor(() => expect(screen.getByText('Início realizado')).toBeInTheDocument())
    expect(screen.getByText('Fim realizado')).toBeInTheDocument()
    expect(screen.getByText('Responsável externo')).toBeInTheDocument()
    expect(screen.getByText('Chave externa')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Infra Vivo')).toBeInTheDocument())
    expect(screen.getByText('planilha:REF-1')).toBeInTheDocument()
  })
})

describe('TreeViewPage — edição inline e colunas configuráveis', () => {
  test('rehidrata a configuração de colunas persistida no carregamento', async () => {
    localStorage.setItem('tree-grid-columns:user-1:project-1', JSON.stringify(['name', 'status', 'priority', 'actions']))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><TreeViewPage projectId="project-1" /></MemoryRouter></QueryClientProvider>)

    await waitFor(() => expect(screen.getAllByText('Prioridade').length).toBeGreaterThan(0))
    expect(screen.queryByText('Dependências')).not.toBeInTheDocument()
  })

  test('persiste colunas visíveis por usuário/projeto no localStorage', async () => {
    const user = userEvent.setup()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><TreeViewPage projectId="project-1" /></MemoryRouter></QueryClientProvider>)

    await user.click(await screen.findByRole('button', { name: 'Adicionar coluna após Status' }))
    const priorityCheckbox = screen.getByRole('checkbox', { name: 'Prioridade' })
    expect(priorityCheckbox).not.toBeChecked()
    await user.click(priorityCheckbox)
    expect(priorityCheckbox).toBeChecked()

    const saved = localStorage.getItem('tree-grid-columns:user-1:project-1')
    expect(saved).not.toBeNull()
    expect(saved).toContain('priority')
  })

  test('o + entre colunas insere a nova coluna naquela posição', async () => {
    const user = userEvent.setup()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><TreeViewPage projectId="project-1" /></MemoryRouter></QueryClientProvider>)

    // A faixa fica no limite direito de "Status", então a coluna entra logo depois dela.
    await user.click(await screen.findByRole('button', { name: 'Adicionar coluna após Status' }))
    await waitFor(() => expect(screen.getByText('Colunas visíveis')).toBeInTheDocument())
    await user.click(await screen.findByRole('checkbox', { name: /Prioridade/i }))

    await waitFor(() => expect(screen.getAllByText('Prioridade').length).toBeGreaterThan(0))
    const saved = JSON.parse(localStorage.getItem('tree-grid-columns:user-1:project-1') ?? '[]')
    expect(saved.slice(0, 3)).toEqual(['name', 'status', 'priority'])
  })

  test('arrastar a alça de redimensionamento altera a largura da coluna', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(<QueryClientProvider client={client}><MemoryRouter><TreeViewPage projectId="project-1" /></MemoryRouter></QueryClientProvider>)

    const handle = await screen.findByRole('button', { name: 'Redimensionar coluna Status' })
    const statusCol = () => container.querySelectorAll('colgroup col')[1] as HTMLElement

    expect(statusCol().style.width).toBe('170px')
    fireEvent.mouseDown(handle, { clientX: 300 })
    fireEvent.mouseMove(window, { clientX: 360 })
    await waitFor(() => expect(statusCol().style.width).toBe('230px'))
    fireEvent.mouseUp(window)

    expect(JSON.parse(localStorage.getItem('tree-grid-widths:user-1:project-1') ?? '{}').status).toBe(230)
  })

  test('a célula só vira editor depois do clique e então salva via PATCH', async () => {
    const user = userEvent.setup()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><TreeViewPage projectId="project-1" /></MemoryRouter></QueryClientProvider>)

    await waitFor(() => expect(screen.getByText('Dependências')).toBeInTheDocument())
    // Em repouso a grade é só leitura: nenhum controle de formulário exposto.
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Editar Status de Epic' }))
    const statusSelect = await screen.findByRole('combobox')
    await user.selectOptions(statusSelect, 'DONE')

    await waitFor(() => expect(patchCalls.length).toBeGreaterThan(0))
    const patch = patchCalls.find(call => call.path.includes('/projects/project-1/items/epic-1'))
    expect(patch).not.toBeUndefined()
    expect(patch?.body.status).toBe('DONE')
    expect(patch?.body.expectedUpdatedAt).toBe('2026-11-01T10:00:00.000Z')
  })
})