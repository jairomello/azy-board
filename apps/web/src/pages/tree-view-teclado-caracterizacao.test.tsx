// Testes de caracterização do teclado na Árvore (TreeViewPage), rede de
// segurança antes dos atalhos de teclado globais. Prendem o comportamento ATUAL:
// - A6-06: Esc fecha o menu de colunas ("Adicionar coluna após …") e o menu de
//   filtro do cabeçalho da coluna ("Filtrar …");
// - A6-07: Esc na edição inline de célula (nome e pontos) cancela: restaura o
//   valor, sai da edição e não envia PATCH.
import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, configure, fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as bunTest from 'bun:test'
import i18n from '../i18n'
import type { BoardFilterState } from '../components/BoardFilters'

configure({ asyncUtilTimeout: 5000 })
// Montagem pesada (editor rico, board/árvore inteiros): com a máquina ou o CI
// carregados, o teste passa dos 5 s padrão do bun:test sem estar errado.
;(bunTest as unknown as { setDefaultTimeout: (ms: number) => void }).setDefaultTimeout(20_000)

const no = (id: string, title: string, type: string, parentId: string, children: unknown[] = [], extra: Record<string, unknown> = {}) => ({
  id, title, type, parentId, moduleId: 'mod-1', updatedAt: '2026-11-01T10:00:00.000Z', children, ...extra,
})

const arvore = [
  {
    id: 'mod-1', name: 'Modulo', type: 'module', children: [
      no('epic-1', 'Epic 1', 'EPIC', 'mod-1', [
        no('story-1', 'História 1', 'STORY', 'epic-1', [
          no('task-1', 'Tarefa 1', 'TASK', 'story-1', [], { points: 3 }),
        ]),
      ]),
    ],
  },
]

const filtrosBase: BoardFilterState = {
  moduleId: '', sprintId: '', assigneeId: '', types: [], tagIds: [], versionId: '', priority: '', status: '',
  authorId: '', costCenterId: '', updatedWithin: '', hideEmptyEpics: false, hideEmptyStories: false, squadId: '',
  showSubtasks: false, storyDisplay: 'lanes', moduleViewMode: 'hierarchy',
}

const fetchOriginal = globalThis.fetch
const requisicoes: Array<[string, string]> = []

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  localStorage.clear()
  requisicoes.length = 0
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    requisicoes.push([init?.method ?? 'GET', url])
    if (url.includes('/items/tree')) {
      return new Response(JSON.stringify(structuredClone(arvore)), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = fetchOriginal
})

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

const { TreeViewPage } = await import('./TreeViewPage')

function renderArvore() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TreeViewPage projectId="project-1" filters={filtrosBase} onFiltersChange={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const esc = () => act(() => { fireEvent.keyDown(document.body, { key: 'Escape' }) })
const mutacoes = () => requisicoes.filter(([metodo]) => metodo !== 'GET')

async function expandirTudo() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Expandir tudo' }))
  await screen.findByText('Tarefa 1')
}

describe('TreeViewPage — Esc fecha os menus da grade (A6-06)', () => {
  test('Esc fecha o menu de colunas aberto pelo "+" entre cabeçalhos', async () => {
    renderArvore()
    const abrir = await screen.findByRole('button', { name: 'Adicionar coluna após Nome' })
    fireEvent.click(abrir)
    expect(screen.getByText('Colunas visíveis')).toBeInTheDocument()
    expect(abrir).toHaveAttribute('aria-expanded', 'true')

    await esc()
    expect(screen.queryByText('Colunas visíveis')).toBeNull()
    expect(screen.getByRole('button', { name: 'Adicionar coluna após Nome' })).toHaveAttribute('aria-expanded', 'false')
  })

  test('Esc fecha o menu de filtro do cabeçalho da coluna', async () => {
    renderArvore()
    fireEvent.click(await screen.findByRole('button', { name: 'Filtrar Status' }))
    expect(screen.getByRole('checkbox', { name: 'Em andamento' })).toBeInTheDocument()

    await esc()
    expect(screen.queryByRole('checkbox', { name: 'Em andamento' })).toBeNull()
  })

  test('outras teclas não fecham os menus', async () => {
    renderArvore()
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar coluna após Nome' }))
    for (const key of ['a', 'Enter', 'Tab', '?']) await act(() => { fireEvent.keyDown(document.body, { key }) })
    expect(screen.getByText('Colunas visíveis')).toBeInTheDocument()
  })
})

describe('TreeViewPage — Esc cancela a edição inline de célula (A6-07)', () => {
  test('nome: Esc restaura o título, sai da edição e não envia PATCH', async () => {
    renderArvore()
    await expandirTudo()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Nome de Tarefa 1' }))
    // O campo de edição nasce com autoFocus e o título atual.
    const campo = await waitFor(() => {
      const ativo = document.activeElement as HTMLInputElement | null
      expect(ativo?.tagName).toBe('INPUT')
      return ativo!
    })
    expect(campo.value).toBe('Tarefa 1')
    fireEvent.change(campo, { target: { value: 'Título descartado' } })
    expect(campo.value).toBe('Título descartado')

    fireEvent.keyDown(campo, { key: 'Escape' })

    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar Nome de Tarefa 1' })).toBeInTheDocument())
    expect(campo.isConnected).toBe(false)
    expect(screen.queryByDisplayValue('Título descartado')).toBeNull()
    await act(() => new Promise(resolve => setTimeout(resolve, 20)))
    expect(mutacoes()).toEqual([])
  })

  test('pontos: Esc restaura o valor, sai da edição e não envia PATCH', async () => {
    renderArvore()
    await expandirTudo()
    fireEvent.click(screen.getByRole('button', { name: 'Editar pontos de Tarefa 1' }))
    const campo = await screen.findByRole('spinbutton')
    expect(campo).toHaveFocus()
    fireEvent.change(campo, { target: { value: '8' } })

    fireEvent.keyDown(campo, { key: 'Escape' })

    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar pontos de Tarefa 1' })).toBeInTheDocument())
    expect(screen.queryByRole('spinbutton')).toBeNull()
    await act(() => new Promise(resolve => setTimeout(resolve, 20)))
    expect(mutacoes()).toEqual([])
  })

  test('controle: Enter com valor alterado salva via PATCH (o Esc é que descarta)', async () => {
    renderArvore()
    await expandirTudo()
    fireEvent.click(screen.getByRole('button', { name: 'Editar pontos de Tarefa 1' }))
    const campo = await screen.findByRole('spinbutton')
    fireEvent.change(campo, { target: { value: '8' } })

    fireEvent.keyDown(campo, { key: 'Enter' })

    await waitFor(() => expect(mutacoes().some(([metodo, url]) => metodo === 'PATCH' && url.endsWith('/projects/project-1/items/task-1'))).toBe(true))
  })
})
