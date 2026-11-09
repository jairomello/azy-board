import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as bunTest from 'bun:test'
import i18n from '../i18n'

const expansivel = (id: string, title: string, type: string, parentId: string, children: unknown[] = []) => ({
  id, title, type, parentId, moduleId: 'mod-1', updatedAt: '2026-11-01T10:00:00.000Z', children,
})

const treeData = [
  {
    id: 'mod-1', name: 'Modulo', type: 'module', children: [
      expansivel('epic-1', 'Epic 1', 'EPIC', 'mod-1', [
        expansivel('story-1', 'História 1', 'STORY', 'epic-1', [
          expansivel('task-1', 'Tarefa 1', 'TASK', 'story-1'),
        ]),
        expansivel('story-2', 'História 2', 'STORY', 'epic-1'),
      ]),
    ],
  },
  {
    id: 'mod-2', name: 'Outro módulo', type: 'module', children: [
      expansivel('epic-2', 'Epic 2', 'EPIC', 'mod-2'),
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
      if (typeof rawBody === 'string') body = JSON.parse(rawBody) as Record<string, unknown>
      patchCalls.push({ path: url, body })
      return new Response(JSON.stringify({ item: { id: url.split('/').pop(), ...body } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url.includes('/items/tree')) {
      return new Response(JSON.stringify(structuredClone(treeData)), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: 'não esperado' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
}

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

const { TreeViewPage } = await import('./TreeViewPage')

function dataTransferStub() {
  const store = new Map<string, string>()
  return {
    effectAllowed: '',
    dropEffect: '',
    setData: (key: string, value: string) => { store.set(key, value) },
    getData: (key: string) => store.get(key) ?? '',
    types: [] as string[],
  }
}

function renderTree(props: Record<string, unknown> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TreeViewPage projectId="project-1" {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function expandAll() {
  const user = userEvent.setup()
  await screen.findByRole('button', { name: 'Expandir tudo' })
  await user.click(screen.getByRole('button', { name: 'Expandir tudo' }))
  await screen.findByText('Tarefa 1')
}

function rowOf(text: string): HTMLElement {
  const cell = screen.getByText(text)
  const row = cell.closest('tr')
  if (!row) throw new Error(`linha de "${text}" não encontrada`)
  return row as HTMLElement
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  localStorage.clear()
  installFetchStub()
})

afterEach(() => {
  cleanup()
  globalThis.fetch = fetchOriginal
})

describe('TreeViewPage — ícone de tipo abre a edição', () => {
  test('clicar no badge do épico chama onEdit com o id do item', async () => {
    const edited: string[] = []
    renderTree({ onEdit: (id: string) => { edited.push(id) } })
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Editar Épico Epic 1' }))
    expect(edited).toEqual(['epic-1'])
  })

  test('sem permissão de edição o badge não vira botão', async () => {
    renderTree({ canEdit: false })
    await screen.findByText('Epic 1')
    expect(screen.queryByRole('button', { name: 'Editar Épico Epic 1' })).toBeNull()
  })
})

describe('TreeViewPage — mover itens entre pais', () => {
  test('arrastar tarefa para outra história envia parentId e atualiza a árvore', async () => {
    renderTree()
    await expandAll()

    const transfer = dataTransferStub()
    fireEvent.dragStart(screen.getByRole('button', { name: 'Mover Tarefa 1' }), { dataTransfer: transfer })
    fireEvent.dragOver(rowOf('História 2'), { dataTransfer: transfer })
    fireEvent.drop(rowOf('História 2'), { dataTransfer: transfer })

    await waitFor(() => expect(patchCalls).toHaveLength(1))
    expect(patchCalls[0].path).toContain('/projects/project-1/items/task-1')
    expect(patchCalls[0].body.parentId).toBe('story-2')
    expect(patchCalls[0].body.moduleId).toBe('mod-1')
  })

  test('arrastar história para outro épico envia parentId', async () => {
    renderTree()
    await expandAll()

    const transfer = dataTransferStub()
    fireEvent.dragStart(screen.getByRole('button', { name: 'Mover História 2' }), { dataTransfer: transfer })
    fireEvent.dragOver(rowOf('Epic 2'), { dataTransfer: transfer })
    fireEvent.drop(rowOf('Epic 2'), { dataTransfer: transfer })

    await waitFor(() => expect(patchCalls).toHaveLength(1))
    expect(patchCalls[0].body.parentId).toBe('epic-2')
    expect(patchCalls[0].body.moduleId).toBe('mod-1')
  })

  test('arrastar épico para outro módulo envia moduleId', async () => {
    renderTree()
    await expandAll()

    const transfer = dataTransferStub()
    fireEvent.dragStart(screen.getByRole('button', { name: 'Mover Epic 2' }), { dataTransfer: transfer })
    fireEvent.dragOver(rowOf('Outro módulo'), { dataTransfer: transfer })
    fireEvent.drop(rowOf('Outro módulo'), { dataTransfer: transfer })

    await waitFor(() => expect(patchCalls).toHaveLength(1))
    expect(patchCalls[0].body.moduleId).toBe('mod-2')
  })

  test('soltar tarefa sobre épico não envia PATCH (hierarquia inválida)', async () => {
    renderTree()
    await expandAll()

    const transfer = dataTransferStub()
    fireEvent.dragStart(screen.getByRole('button', { name: 'Mover Tarefa 1' }), { dataTransfer: transfer })
    fireEvent.dragOver(rowOf('Epic 2'), { dataTransfer: transfer })
    fireEvent.drop(rowOf('Epic 2'), { dataTransfer: transfer })

    await waitFor(() => expect(screen.getByText('Tarefa 1')).toBeInTheDocument())
    expect(patchCalls).toHaveLength(0)
  })

  test('soltar história no próprio descendente não envia PATCH (ciclo)', async () => {
    renderTree()
    await expandAll()

    const transfer = dataTransferStub()
    fireEvent.dragStart(screen.getByRole('button', { name: 'Mover História 1' }), { dataTransfer: transfer })
    fireEvent.dragOver(rowOf('Tarefa 1'), { dataTransfer: transfer })
    fireEvent.drop(rowOf('Tarefa 1'), { dataTransfer: transfer })

    await waitFor(() => expect(screen.getByText('História 1')).toBeInTheDocument())
    expect(patchCalls).toHaveLength(0)
  })
})
