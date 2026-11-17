import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as bunTest from 'bun:test'
import i18n from '../i18n'
import type { BoardFilterState } from '../components/BoardFilters'

const node = (id: string, title: string, type: string, parentId: string, children: unknown[] = []) => ({
  id, title, type, parentId, moduleId: 'mod-1', updatedAt: '2026-11-01T10:00:00.000Z', children,
})

const treeData = [
  {
    id: 'mod-1', name: 'Modulo', type: 'module', children: [
      node('epic-1', 'Epic com trabalho', 'EPIC', 'mod-1', [
        node('story-filled', 'História com tarefa', 'STORY', 'epic-1', [
          node('task-1', 'Tarefa 1', 'TASK', 'story-filled'),
        ]),
        node('story-empty', 'História sem tarefa', 'STORY', 'epic-1'),
      ]),
      node('epic-empty', 'Epic vazio', 'EPIC', 'mod-1'),
    ],
  },
  { id: 'mod-empty', name: 'Modulo vazio', type: 'module', children: [] },
]

const baseFilters: BoardFilterState = {
  moduleId: '', sprintId: '', assigneeId: '', types: [], tagIds: [], versionId: '', priority: '', status: '',
  authorId: '', costCenterId: '', updatedWithin: '', hideEmptyEpics: false, hideEmptyStories: false, squadId: '',
  showSubtasks: false, storyDisplay: 'lanes', moduleViewMode: 'hierarchy',
}

const fetchOriginal = globalThis.fetch

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  localStorage.clear()
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).includes('/items/tree')) {
      return new Response(JSON.stringify(structuredClone(treeData)), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: 'não esperado' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
})

afterEach(() => {
  cleanup()
  globalThis.fetch = fetchOriginal
})

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module
mockModule('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

const { TreeViewPage } = await import('./TreeViewPage')

async function renderTree(filters: BoardFilterState) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TreeViewPage projectId="project-1" filters={filters} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Expandir tudo' }))
  return user
}

describe('TreeViewPage — ocultar itens vazios (paridade com o Kanban)', () => {
  test('sem os filtros de vazio, mostra épicos e histórias vazios', async () => {
    await renderTree(baseFilters)
    expect(await screen.findByText('Epic vazio')).toBeInTheDocument()
    expect(await screen.findByText('História sem tarefa')).toBeInTheDocument()
    expect(await screen.findByText('Modulo vazio')).toBeInTheDocument()
  })

  test('ocultar histórias vazias remove a história sem tarefa e mantém o épico', async () => {
    await renderTree({ ...baseFilters, hideEmptyStories: true })
    expect(await screen.findByText('História com tarefa')).toBeInTheDocument()
    expect(screen.queryByText('História sem tarefa')).not.toBeInTheDocument()
    expect(screen.getByText('Epic com trabalho')).toBeInTheDocument()
  })

  test('ocultar épicos vazios remove o épico sem filhos e mantém o que tem trabalho', async () => {
    await renderTree({ ...baseFilters, hideEmptyEpics: true })
    expect(await screen.findByText('Epic com trabalho')).toBeInTheDocument()
    expect(screen.queryByText('Epic vazio')).not.toBeInTheDocument()
    expect(screen.queryByText('Modulo vazio')).not.toBeInTheDocument()
  })

  test('ocultar épicos vazios também remove o épico que só tinha histórias vazias', async () => {
    await renderTree({ ...baseFilters, hideEmptyEpics: true, hideEmptyStories: true })
    expect(await screen.findByText('Epic com trabalho')).toBeInTheDocument()
    expect(screen.queryByText('História sem tarefa')).not.toBeInTheDocument()
    expect(screen.queryByText('Epic vazio')).not.toBeInTheDocument()
  })
})
