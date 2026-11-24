// Testes de caracterização do BoardScreen montado (rede de segurança antes do
// redesenho do arraste e do detalhe do card). Prendem o comportamento ATUAL:
// - A1-15: soltar o card fora das colunas não muda nada e mostra o toast
//   `dragDropCanceled`;
// - A1-28/A2-01: clicar no corpo do card abre o ItemModal do card;
// - A2-02: `?itemId=` abre o card quando ele está no board;
// - A1-35: abas de módulo (tablist) com `moduleViewMode=tabs`.
//
// Para montar a tela sem servidor, os módulos de borda são substituídos:
// sessão (AuthContext), casca (AppShell), toast e o cache remoto do board
// (useBoardData), que devolve dados fixos em estado React. O restante — lanes,
// colunas, cards, DndContext, sensores, prévia do arraste e modais — é o real.
import { screen } from '../../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as bunTest from 'bun:test'
import { act, configure, fireEvent, render, waitFor, within } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '../../i18n'
import type { Column, ItemData, Module } from './model/types'

configure({ asyncUtilTimeout: 5000 })

const mockModule = (bunTest as unknown as { mock: { module: (specifier: string, factory: () => unknown) => void } }).mock.module

const toasts: Array<[string, string | undefined]> = []
mockModule('../../components/Toast', () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => children,
  useToast: () => ({ toast: (mensagem: string, tipo?: string) => { toasts.push([mensagem, tipo]) } }),
}))

mockModule('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ user: { id: 'u1', name: 'Ana', email: 'ana@exemplo.test' }, loading: false }),
}))

mockModule('../../components/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="casca">{children}</div>,
}))

const COLUNAS: Column[] = [
  { id: 'todo', name: 'A Fazer', baseStatus: 'NOT_STARTED', position: 0 },
  { id: 'doing', name: 'Fazendo', baseStatus: 'IN_PROGRESS', position: 1 },
] as Column[]

const MODULOS: Module[] = [
  { id: 'mod-1', name: 'Módulo Um', position: 0 },
  { id: 'mod-2', name: 'Módulo Dois', position: 1 },
]

function caminho(...nos: Array<[string, string, string]>) {
  return JSON.stringify(nos.map(([id, type, title]) => ({ id, type, title })))
}

function base(overrides: Partial<ItemData>): ItemData {
  return {
    id: 'x', title: 'x', type: 'TASK', status: 'NOT_STARTED', priority: 'MEDIUM', columnId: 'todo',
    isLeaf: true, ancestryPath: '[]', position: 0, parentId: null, ...overrides,
  } as ItemData
}

const ITENS: ItemData[] = [
  base({ id: 'epic-1', title: 'Épico Um', type: 'EPIC', isLeaf: false, columnId: null, moduleId: 'mod-1' }),
  base({ id: 'story-1', title: 'História Um', type: 'STORY', isLeaf: false, columnId: 'todo', parentId: 'epic-1', ancestryPath: caminho(['epic-1', 'EPIC', 'Épico Um']) }),
  base({ id: 'task-1', title: 'Tarefa do módulo um', parentId: 'story-1', ancestryPath: caminho(['epic-1', 'EPIC', 'Épico Um'], ['story-1', 'STORY', 'História Um']) }),
  base({ id: 'epic-2', title: 'Épico Dois', type: 'EPIC', isLeaf: false, columnId: null, moduleId: 'mod-2' }),
  base({ id: 'story-2', title: 'História Dois', type: 'STORY', isLeaf: false, columnId: 'todo', parentId: 'epic-2', ancestryPath: caminho(['epic-2', 'EPIC', 'Épico Dois']) }),
  base({ id: 'task-2', title: 'Tarefa do módulo dois', parentId: 'story-2', ancestryPath: caminho(['epic-2', 'EPIC', 'Épico Dois'], ['story-2', 'STORY', 'História Dois']) }),
]

const estadoDoBoard = { itens: ITENS, requisicoesDeLeituraCanceladas: 0 }

mockModule('./hooks/useBoardData', () => ({
  useBoardData: () => {
    const [columns, setColumns] = useState<Column[]>(COLUNAS)
    const [allItems, setAllItems] = useState<ItemData[]>(estadoDoBoard.itens)
    const [modules, setModules] = useState<Module[]>(MODULOS)
    const [projectTags, setProjectTags] = useState([])
    return {
      columns, setColumns,
      allItems, setAllItems,
      modules, setModules,
      sprints: [], setSprints: () => {},
      members: [{ userId: 'u1', name: 'Ana', email: 'ana@exemplo.test', role: 'MEMBER' }], setMembers: () => {},
      projectTags, setProjectTags,
      projectVersions: [], setProjectVersions: () => {},
      versionsLoaded: true,
      projectCostCenters: [], setProjectCostCenters: () => {},
      costCentersLoaded: true,
      projectSquads: [], setProjectSquads: () => {},
      projectName: 'Projeto Teste', setProjectName: () => {},
      boardMode: 'HIERARCHICAL', setBoardMode: () => {},
      simpleStoryId: null, setSimpleStoryId: () => {},
      hideModules: false,
      hideEpics: false,
      advancedChecklists: false, setAdvancedChecklists: () => {},
      projectIcon: null, projectColor: null,
      loading: false, setLoading: () => {},
      syncState: 'synced',
      invalidateBoard: () => {},
      cancelBoardReads: () => { estadoDoBoard.requisicoesDeLeituraCanceladas += 1 },
    }
  },
}))

const { default: BoardPage } = await import('./BoardScreen')
// O ItemModal é carregado sob demanda pelo BoardModals; pré-carregá-lo evita que
// o primeiro teste que abre o detalhe pague a importação (editor rico) no tempo limite.
await import('../../components/ItemModal')

const fetchOriginal = globalThis.fetch
const requisicoes: Array<[string, string]> = []

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function respostaDetalhe(url: string): Response {
  for (const item of ITENS) {
    if (url.endsWith(`/projects/p1/items/${item.id}`)) return json(item)
  }
  if (url.includes('/tenant/attachments/enabled')) return json({ enabled: false })
  if (url.includes('/checklists')) return json([])
  if (url.includes('/work-log') || url.includes('/audit') || url.includes('/children')) return json({ data: [], total: 0 })
  return json({})
}

function renderBoard(rota = '/projects/p1/board') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/projects/:projectId/board" element={<BoardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Diálogo do detalhe; consulta por seletor porque `ByRole` fica lento com o board inteiro montado. */
async function dialogoDoDetalhe() {
  return waitFor(() => {
    const dialogo = document.querySelector('[role="dialog"]') as HTMLElement | null
    expect(dialogo).not.toBeNull()
    return dialogo!
  })
}

function cardPorId(id: string) {
  return document.querySelector(`.kanban-card[data-card-id="${id}"]`) as HTMLElement | null
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  toasts.length = 0
  requisicoes.length = 0
  estadoDoBoard.itens = ITENS
  estadoDoBoard.requisicoesDeLeituraCanceladas = 0
  try { localStorage.clear() } catch { /* sem storage */ }
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    requisicoes.push([init?.method ?? 'GET', url])
    return respostaDetalhe(url)
  }) as typeof fetch
})

afterEach(() => { globalThis.fetch = fetchOriginal })

describe('BoardScreen — soltar fora das colunas (A1-15)', () => {
  test('arrastar o card e soltar fora de qualquer coluna mostra o toast de cancelamento e não muda nada', async () => {
    renderBoard()
    const card = await waitFor(() => {
      const encontrado = cardPorId('task-1')
      expect(encontrado).not.toBeNull()
      return encontrado!
    })
    const alca = card.querySelector('.kanban-card-grip') as HTMLElement
    expect(alca).toHaveAttribute('aria-label', 'Arrastar card')

    act(() => { fireEvent.pointerDown(alca, { button: 0, isPrimary: true, pointerId: 1, clientX: 5000, clientY: 5000 }) })
    act(() => { fireEvent.pointerMove(document, { pointerId: 1, clientX: 5040, clientY: 5040 }) })
    // Durante o arraste o card de origem sai do fluxo.
    await waitFor(() => expect(document.querySelector('.kanban-card--dragging[data-card-id="task-1"]')).not.toBeNull())
    act(() => { fireEvent.pointerUp(document, { pointerId: 1, clientX: 5040, clientY: 5040 }) })

    await waitFor(() => expect(toasts).toEqual([['Movimento cancelado: solte o card sobre uma coluna.', undefined]]))
    // Nenhuma mutação foi enviada e o card continua na coluna de origem.
    expect(requisicoes.filter(([metodo]) => metodo !== 'GET')).toEqual([])
    expect(estadoDoBoard.requisicoesDeLeituraCanceladas).toBe(0)
    await waitFor(() => expect(cardPorId('task-1')).not.toBeNull())
    expect(cardPorId('task-1')!.closest('[data-drop-id]')?.getAttribute('data-drop-id')?.endsWith(':col:todo')).toBe(true)
    // Após a soltura o dnd-kit mantém por 50 ms um filtro de clique no documento;
    // esperar evita que ele engula o primeiro clique do teste seguinte.
    await act(() => new Promise(resolve => setTimeout(resolve, 120)))
  })
})

describe('BoardScreen — abrir o detalhe (A1-28, A2-01, A2-02)', () => {
  test('clicar no corpo do card abre o ItemModal do card', async () => {
    renderBoard()
    const card = await waitFor(() => {
      const encontrado = cardPorId('task-1')
      expect(encontrado).not.toBeNull()
      return encontrado!
    })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    fireEvent.click(card.querySelector('.kanban-card-footer .priority')!)

    const dialogo = await dialogoDoDetalhe()
    expect(dialogo.querySelector('#item-modal-title')).toHaveTextContent('Tarefa do módulo um')
    expect(requisicoes.some(([metodo, url]) => metodo === 'GET' && url.endsWith('/projects/p1/items/task-1'))).toBe(true)
  })

  test('?itemId= de um card do board abre o detalhe ao carregar', async () => {
    renderBoard('/projects/p1/board?itemId=task-2')
    const dialogo = await dialogoDoDetalhe()
    expect(dialogo.querySelector('#item-modal-title')).toHaveTextContent('Tarefa do módulo dois')
  })

  test('?itemId= de um id que não está no board não abre nada', async () => {
    renderBoard('/projects/p1/board?itemId=inexistente')
    await waitFor(() => expect(cardPorId('task-1')).not.toBeNull())
    await act(() => new Promise(resolve => setTimeout(resolve, 50)))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})

describe('BoardScreen — abas de módulo (A1-35)', () => {
  function comAbas() {
    localStorage.setItem('board-filters:p1', JSON.stringify({ moduleViewMode: 'tabs' }))
  }

  test('com moduleViewMode=tabs mostra a tablist com um botão por módulo e o primeiro selecionado', async () => {
    comAbas()
    renderBoard()
    const lista = await screen.findByRole('tablist', { name: 'como abas' })
    const abas = within(lista).getAllByRole('tab')
    expect(abas.map(aba => aba.textContent)).toEqual(['Módulo Um', 'Módulo Dois'])
    expect(abas[0]).toHaveAttribute('aria-selected', 'true')
    expect(abas[1]).toHaveAttribute('aria-selected', 'false')
    // Só o módulo ativo é exibido.
    await waitFor(() => expect(cardPorId('task-1')).not.toBeNull())
    expect(cardPorId('task-2')).toBeNull()
  })

  test('clicar na aba de outro módulo troca a seleção e o conteúdo exibido', async () => {
    comAbas()
    renderBoard()
    const lista = await screen.findByRole('tablist', { name: 'como abas' })
    fireEvent.click(within(lista).getByRole('tab', { name: 'Módulo Dois' }))

    expect(within(lista).getByRole('tab', { name: 'Módulo Dois' })).toHaveAttribute('aria-selected', 'true')
    expect(within(lista).getByRole('tab', { name: 'Módulo Um' })).toHaveAttribute('aria-selected', 'false')
    await waitFor(() => expect(cardPorId('task-2')).not.toBeNull())
    expect(cardPorId('task-1')).toBeNull()
  })

  test('no modo hierarquia (padrão) não há tablist e todos os módulos aparecem', async () => {
    renderBoard()
    await waitFor(() => expect(cardPorId('task-1')).not.toBeNull())
    expect(cardPorId('task-2')).not.toBeNull()
    expect(screen.queryByRole('tablist', { name: 'como abas' })).toBeNull()
  })
})
