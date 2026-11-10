import { screen } from '../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
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
      node('epic-1', 'Epic 1', 'EPIC', 'mod-1', [
        node('story-1', 'História 1', 'STORY', 'epic-1', [
          node('task-1', 'Tarefa 1', 'TASK', 'story-1'),
        ]),
      ]),
    ],
  },
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

const { TreeViewPage, treeInlineCreationContext, treeInlineCreationTypes } = await import('./TreeViewPage')

function renderTree(props: Record<string, unknown> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TreeViewPage projectId="project-1" filters={baseFilters} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function expandAll() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Expandir tudo' }))
  await screen.findByText('Tarefa 1')
}

describe('TreeViewPage — filtro direto do cabeçalho da coluna', () => {
  test('filtra status pelo cabeçalho e combina com os valores já aplicados', async () => {
    const user = userEvent.setup()
    const changes: BoardFilterState[] = []
    renderTree({
      filters: { ...baseFilters, status: 'IN_PROGRESS' },
      onFiltersChange: (next: BoardFilterState) => changes.push(next),
    })

    await user.click(await screen.findByRole('button', { name: 'Filtrar Status' }))
    expect(screen.getByRole('checkbox', { name: 'Em andamento' })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Concluída' }))
    expect(changes[changes.length - 1]?.status).toBe('IN_PROGRESS,DONE')
  })

  test('filtra prioridade pelo cabeçalho', async () => {
    const user = userEvent.setup()
    localStorage.setItem('tree-grid-columns:user-1:project-1', JSON.stringify(['name', 'priority', 'actions']))
    const changes: BoardFilterState[] = []
    renderTree({ onFiltersChange: (next: BoardFilterState) => changes.push(next) })

    await user.click(await screen.findByRole('button', { name: 'Filtrar Prioridade' }))
    await user.click(await screen.findByRole('button', { name: 'Alta' }))
    expect(changes[changes.length - 1]?.priority).toBe('HIGH')
  })

  test('limpa a prioridade pelo item Todos do cabeçalho', async () => {
    const user = userEvent.setup()
    localStorage.setItem('tree-grid-columns:user-1:project-1', JSON.stringify(['name', 'priority', 'actions']))
    const changes: BoardFilterState[] = []
    renderTree({ filters: { ...baseFilters, priority: 'HIGH' }, onFiltersChange: (next: BoardFilterState) => changes.push(next) })

    await user.click(await screen.findByRole('button', { name: 'Filtrar Prioridade' }))
    await user.click(await screen.findByRole('button', { name: 'Todos' }))
    expect(changes[changes.length - 1]?.priority).toBe('')
  })

  test('marca o cabeçalho como filtrado quando o filtro está aplicado', async () => {
    renderTree({ filters: { ...baseFilters, status: 'DONE' }, onFiltersChange: () => {} })
    const trigger = await screen.findByRole('button', { name: 'Filtrar Status' })
    expect(trigger.className).toContain('text-primary')
  })
})

describe('TreeViewPage — adicionar atividade abaixo da linha', () => {
  test('cria o próximo nível hierárquico para épico, história e task', () => {
    expect(treeInlineCreationTypes('module')).toEqual(['EPIC'])
    expect(treeInlineCreationTypes('EPIC')).toEqual(['STORY'])
    expect(treeInlineCreationTypes('STORY')).toEqual(['TASK', 'BUG'])
    expect(treeInlineCreationTypes('TASK')).toEqual(['TASK', 'BUG'])

    expect(treeInlineCreationContext({ id: 'mod-1', type: 'module' })).toEqual({ moduleId: 'mod-1' })
    expect(treeInlineCreationContext({ id: 'epic-1', type: 'EPIC', moduleId: 'mod-1' })).toMatchObject({ parentId: 'epic-1', moduleId: 'mod-1' })
    expect(treeInlineCreationContext({ id: 'story-1', type: 'STORY', moduleId: 'mod-1' })).toMatchObject({ parentId: 'story-1', moduleId: 'mod-1' })
    // Em TASK/BUG, o "+" abaixo da linha cria um irmão sob o mesmo pai.
    expect(treeInlineCreationContext({ id: 'task-1', type: 'TASK', parentId: 'story-1', moduleId: 'mod-1' })).toMatchObject({ parentId: 'story-1', moduleId: 'mod-1' })
  })

  test('o "+" abaixo do módulo cria um épico no próprio módulo', async () => {
    const created: Array<[string, Record<string, unknown>]> = []
    renderTree({ onCreate: (type: string, context: Record<string, unknown>) => created.push([type, context]) })
    await expandAll()

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Épico abaixo de Modulo' }))
    expect(created[0]).toEqual(['EPIC', { moduleId: 'mod-1' }])
  })

  test('o "+" abaixo da história cria task com parentId da história', async () => {
    const created: Array<[string, Record<string, unknown>]> = []
    renderTree({ onCreate: (type: string, context: Record<string, unknown>) => created.push([type, context]) })
    await expandAll()

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Task abaixo de História 1' }))
    expect(created[0]?.[0]).toBe('TASK')
    expect(created[0]?.[1]).toMatchObject({ parentId: 'story-1', moduleId: 'mod-1' })
  })

  test('o "+" abaixo da task cria um irmão (mesmo pai da task)', async () => {
    const created: Array<[string, Record<string, unknown>]> = []
    renderTree({ onCreate: (type: string, context: Record<string, unknown>) => created.push([type, context]) })
    await expandAll()

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Bug abaixo de Tarefa 1' }))
    expect(created[0]?.[0]).toBe('BUG')
    expect(created[0]?.[1]).toMatchObject({ parentId: 'story-1' })
  })

  test('sem permissão de criação não exibe a criação por hover', async () => {
    renderTree({ canCreate: false, onCreate: () => {} })
    await waitFor(() => expect(screen.getByText('Modulo')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /abaixo de Modulo/ })).not.toBeInTheDocument()
  })
})
