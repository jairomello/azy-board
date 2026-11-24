// Testes de caracterização das LIGAÇÕES do BoardScreen montado (rede de
// segurança antes do redesenho da barra). Os testes da BoardCommandBar isolada
// usam callbacks falsos; aqui a barra é a real, recebida pela tela real, e cada
// teste verifica o efeito na tela quando o usuário aciona a barra:
// - A4-01/A4-03: Board ↔ Unificado ↔ Árvore trocam o canvas; na Árvore some o menu Criar;
// - A4-05: no Unificado o contexto publicado ao assistente usa a visão `kanban`;
// - A5-13: densidade compacta aplica `density-compact`, esconde os chips e grava `board-density`;
// - A5-04/A5-14: Exportar abre o ExportDialog (lazy) e Arquivados abre o modal;
// - A3-24: o ExportDialog recebe os filtros atuais (com status, sem preferências de exibição);
// - A5-02: Recalcular datas faz POST no endpoint de cronograma e invalida o board;
// - A5-03: caminho crítico com 0 dependências avisa e não destaca;
// - A5-08: Recolher tudo grava os ids de módulos, épicos (+ 'orphan') e histórias;
// - A3-13: o squad da barra mostra só os cards de responsáveis membros dele;
// - A1-05: limiar de 5 px do PointerSensor na alça; o corpo do card não arrasta.
//
// Para montar a tela sem servidor, os módulos de borda são substituídos:
// sessão (AuthContext), casca (AppShell — que aqui renderiza a barra de comando
// e registra as props do assistente), toast, o cache remoto do board
// (useBoardData) e o ExportDialog (dublê que registra as props). O restante —
// barra, lanes, colunas, cards, DndContext, sensores e modais — é o real.
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as bunTest from 'bun:test'
import '../../test/setup'
import { act, configure, fireEvent, render, waitFor, within } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '../../i18n'
import type { Column, ItemData, Module } from './model/types'

configure({ asyncUtilTimeout: 5000 })
// A tela inteira montada é pesada: com a máquina carregada um teste longo passa dos 5 s padrão.
const { setDefaultTimeout } = bunTest as unknown as { setDefaultTimeout: (ms: number) => void }
setDefaultTimeout(20000)

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

// Props publicadas pela tela para a casca (contexto do assistente).
interface PropsDaCasca { assistantBoardView?: string; assistantScreen?: string; assistantScreenSnapshot?: { view?: { mode?: string } } | null }
const propsDaCasca: PropsDaCasca[] = []
mockModule('../../components/AppShell', () => ({
  AppShell: (props: PropsDaCasca & { children: ReactNode; commandBar?: ReactNode }) => {
    propsDaCasca.push({ assistantBoardView: props.assistantBoardView, assistantScreen: props.assistantScreen, assistantScreenSnapshot: props.assistantScreenSnapshot })
    return (
      <div>
        <div data-testid="barra">{props.commandBar}</div>
        <div data-testid="casca">{props.children}</div>
      </div>
    )
  },
}))

// Dublê do ExportDialog: o lazy do BoardScreen importa este módulo; o dublê
// registra as props recebidas para verificar os filtros repassados.
const propsDoExport: Array<{ projectId: string; filters: Record<string, unknown> }> = []
mockModule('../../components/ExportDialog', () => ({
  ExportDialog: (props: { projectId: string; filters: Record<string, unknown>; onClose: () => void }) => {
    propsDoExport.push({ projectId: props.projectId, filters: props.filters })
    return <div role="dialog" aria-label="dublê do ExportDialog" data-testid="export-dialog" />
  },
}))

const COLUNAS: Column[] = [
  { id: 'todo', name: 'A Fazer', baseStatus: 'NOT_STARTED', position: 0 },
  { id: 'doing', name: 'Fazendo', baseStatus: 'IN_PROGRESS', position: 1 },
] as Column[]

const MODULOS: Module[] = [
  { id: 'mod-1', name: 'Módulo Um', position: 0 },
  { id: 'mod-2', name: 'Módulo Dois', position: 1 },
]

const MEMBROS = [
  { userId: 'u1', name: 'Ana', email: 'ana@exemplo.test', role: 'MEMBER', squadId: 'squad-a' },
  { userId: 'u2', name: 'Bruno', email: 'bruno@exemplo.test', role: 'MEMBER', squadId: 'squad-b' },
]

const SQUADS = [{ id: 'squad-a', name: 'Squad A' }, { id: 'squad-b', name: 'Squad B' }]

function caminho(...nos: Array<[string, string, string]>) {
  return JSON.stringify(nos.map(([id, type, title]) => ({ id, type, title })))
}

function base(overrides: Partial<ItemData>): ItemData {
  return {
    id: 'x', title: 'x', type: 'TASK', status: 'NOT_STARTED', priority: 'MEDIUM', columnId: 'todo',
    isLeaf: true, ancestryPath: '[]', position: 0, parentId: null, ...overrides,
  } as ItemData
}

// task-1 (Ana, squad A) tem uma dependência cadastrada: habilita o switch do caminho crítico.
const ITENS: ItemData[] = [
  base({ id: 'epic-1', title: 'Épico Um', type: 'EPIC', isLeaf: false, columnId: null, moduleId: 'mod-1' }),
  base({ id: 'story-1', title: 'História Um', type: 'STORY', isLeaf: false, columnId: 'todo', parentId: 'epic-1', ancestryPath: caminho(['epic-1', 'EPIC', 'Épico Um']) }),
  base({ id: 'task-1', title: 'Tarefa da Ana', parentId: 'story-1', assigneeId: 'u1', dependencyCount: 1, ancestryPath: caminho(['epic-1', 'EPIC', 'Épico Um'], ['story-1', 'STORY', 'História Um']) } as Partial<ItemData>),
  base({ id: 'epic-2', title: 'Épico Dois', type: 'EPIC', isLeaf: false, columnId: null, moduleId: 'mod-2' }),
  base({ id: 'story-2', title: 'História Dois', type: 'STORY', isLeaf: false, columnId: 'todo', parentId: 'epic-2', ancestryPath: caminho(['epic-2', 'EPIC', 'Épico Dois']) }),
  base({ id: 'task-2', title: 'Tarefa do Bruno', parentId: 'story-2', assigneeId: 'u2', ancestryPath: caminho(['epic-2', 'EPIC', 'Épico Dois'], ['story-2', 'STORY', 'História Dois']) }),
]

const estadoDoBoard = { invalidacoes: 0 }

mockModule('./hooks/useBoardData', () => ({
  useBoardData: () => {
    const [columns, setColumns] = useState<Column[]>(COLUNAS)
    const [allItems, setAllItems] = useState<ItemData[]>(ITENS)
    const [modules, setModules] = useState<Module[]>(MODULOS)
    const [projectTags, setProjectTags] = useState([])
    return {
      columns, setColumns,
      allItems, setAllItems,
      modules, setModules,
      sprints: [], setSprints: () => {},
      members: MEMBROS, setMembers: () => {},
      projectTags, setProjectTags,
      projectVersions: [], setProjectVersions: () => {},
      versionsLoaded: true,
      projectCostCenters: [], setProjectCostCenters: () => {},
      costCentersLoaded: true,
      projectSquads: SQUADS, setProjectSquads: () => {},
      projectName: 'Projeto Teste', setProjectName: () => {},
      boardMode: 'HIERARCHICAL', setBoardMode: () => {},
      simpleStoryId: null, setSimpleStoryId: () => {},
      hideModules: false,
      hideEpics: false,
      advancedChecklists: false, setAdvancedChecklists: () => {},
      projectIcon: null, projectColor: null,
      loading: false, setLoading: () => {},
      syncState: 'synced',
      invalidateBoard: () => { estadoDoBoard.invalidacoes += 1 },
      cancelBoardReads: () => {},
    }
  },
}))

const { default: BoardPage } = await import('./BoardScreen')
// O ItemModal é carregado sob demanda pelo BoardModals; pré-carregá-lo evita que
// o teste que abre o detalhe pague a importação (editor rico) no tempo limite.
await import('../../components/ItemModal')

const t = (key: string) => i18n.t(key, { ns: 'board' })

const fetchOriginal = globalThis.fetch
const requisicoes: Array<[string, string]> = []

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function responder(url: string): Response {
  if (url.includes('/projects/p1/schedule/critical-path')) return json({ criticalPath: ['task-1'], dependencyCount: 0 })
  if (url.includes('/projects/p1/schedule/recalculate')) return json({ updatedCount: 2 })
  if (url.includes('/projects/p1/items/archived')) return json([])
  if (url.includes('/projects/p1/items/tree')) return json([])
  for (const item of ITENS) {
    if (url.endsWith(`/projects/p1/items/${item.id}`)) return json(item)
  }
  if (url.includes('/tenant/attachments/enabled')) return json({ enabled: false })
  if (url.includes('/checklists')) return json([])
  if (url.includes('/work-log') || url.includes('/audit') || url.includes('/children')) return json({ data: [], total: 0 })
  return json({})
}

function renderBoard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/p1/board']}>
        <Routes>
          <Route path="/projects/:projectId/board" element={<BoardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function cardPorId(id: string) {
  return document.querySelector(`.kanban-card[data-card-id="${id}"]`) as HTMLElement | null
}

async function boardMontado() {
  return waitFor(() => {
    const card = cardPorId('task-1')
    expect(card).not.toBeNull()
    return card!
  })
}

// Consultas restritas à barra: `ByRole` no board inteiro montado é lento.
const barra = () => within(screen().getByTestId('barra'))
const screen = () => within(document.body)
const botaoDaBarra = (nome: string) => barra().getByRole('button', { name: nome })
const consultaBotaoDaBarra = (nome: string) => barra().queryByRole('button', { name: nome })
const lerJson = (chave: string) => JSON.parse(localStorage.getItem(chave) ?? 'null') as unknown
const mutacoes = () => requisicoes.filter(([metodo]) => metodo !== 'GET')
const ultimo = <T,>(lista: T[]): T | undefined => lista[lista.length - 1]

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  toasts.length = 0
  requisicoes.length = 0
  propsDaCasca.length = 0
  propsDoExport.length = 0
  estadoDoBoard.invalidacoes = 0
  try { localStorage.clear() } catch { /* sem storage */ }
  try { sessionStorage.clear() } catch { /* sem storage */ }
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    requisicoes.push([init?.method ?? 'GET', url])
    return responder(url)
  }) as typeof fetch
})

afterEach(() => { globalThis.fetch = fetchOriginal })

describe('BoardScreen — troca de visão pela barra (A4-01, A4-03, A4-05)', () => {
  test('Unificado mostra o board unificado; Árvore troca o canvas pela TreeViewPage e some o menu Criar', async () => {
    renderBoard()
    await boardMontado()
    expect(document.querySelector('[data-board-layout="unified"]')).toBeNull()
    expect(botaoDaBarra(t('viewBoard'))).toHaveAttribute('aria-pressed', 'true')
    expect(botaoDaBarra(t('create'))).toBeInTheDocument()

    fireEvent.click(botaoDaBarra(t('viewUnified')))
    await waitFor(() => expect(document.querySelector('[data-board-layout="unified"]')).not.toBeNull())
    expect(botaoDaBarra(t('viewUnified'))).toHaveAttribute('aria-pressed', 'true')
    // O unificado não tem lanes de épico/história: os cards estão na faixa única.
    expect(document.querySelector('[data-board-layout="unified"] .kanban-card[data-card-id="task-1"]')).not.toBeNull()
    expect(botaoDaBarra(t('create'))).toBeInTheDocument()
    expect(requisicoes.some(([, url]) => url.includes('/projects/p1/items/tree'))).toBe(false)

    fireEvent.click(botaoDaBarra(t('viewTree')))
    // A TreeViewPage é montada no lugar do canvas e busca a árvore do projeto.
    await waitFor(() => expect(requisicoes.some(([metodo, url]) => metodo === 'GET' && url.includes('/projects/p1/items/tree'))).toBe(true))
    expect(document.querySelector('[data-board-layout="unified"]')).toBeNull()
    expect(cardPorId('task-1')).toBeNull()
    expect(botaoDaBarra(t('viewTree'))).toHaveAttribute('aria-pressed', 'true')
    expect(consultaBotaoDaBarra(t('create'))).toBeNull()

    fireEvent.click(botaoDaBarra(t('viewBoard')))
    await boardMontado()
    expect(botaoDaBarra(t('create'))).toBeInTheDocument()
  })

  test('A4-05: no Unificado o contexto publicado ao assistente usa a visão kanban; na Árvore, tree', async () => {
    renderBoard()
    await boardMontado()
    expect(ultimo(propsDaCasca)?.assistantBoardView).toBe('kanban')

    fireEvent.click(botaoDaBarra(t('viewUnified')))
    await waitFor(() => expect(document.querySelector('[data-board-layout="unified"]')).not.toBeNull())
    const noUnificado = ultimo(propsDaCasca)!
    expect(noUnificado.assistantBoardView).toBe('kanban')
    expect(noUnificado.assistantScreen).toBe('project-board-kanban')
    expect(noUnificado.assistantScreenSnapshot?.view?.mode).toBe('kanban')

    fireEvent.click(botaoDaBarra(t('viewTree')))
    await waitFor(() => expect(ultimo(propsDaCasca)?.assistantBoardView).toBe('tree'))
    expect(ultimo(propsDaCasca)?.assistantScreen).toBe('project-board-tree')
  })
})

describe('BoardScreen — densidade pela barra (A5-13)', () => {
  test('alternar para compacta aplica density-compact, esconde os chips ativos e grava board-density', async () => {
    // Prioridade MEDIUM mantém os cards visíveis e gera um chip de filtro ativo.
    localStorage.setItem('board-filters:p1', JSON.stringify({ priority: 'MEDIUM' }))
    renderBoard()
    await boardMontado()
    const canvas = document.querySelector('.board-canvas') as HTMLElement
    expect(canvas.classList.contains('density-compact')).toBe(false)
    expect(document.querySelector('.board-filter-chips')).not.toBeNull()

    fireEvent.click(botaoDaBarra(t('toggleDensity')))

    await waitFor(() => expect((document.querySelector('.board-canvas') as HTMLElement).classList.contains('density-compact')).toBe(true))
    expect(document.querySelector('.board-filter-chips')).toBeNull()
    expect(localStorage.getItem('board-density')).toBe('compact')
    expect(botaoDaBarra(t('toggleDensity'))).toHaveAttribute('title', `${t('density')}: ${t('compact')}`)

    fireEvent.click(botaoDaBarra(t('toggleDensity')))
    await waitFor(() => expect(document.querySelector('.board-filter-chips')).not.toBeNull())
    expect((document.querySelector('.board-canvas') as HTMLElement).classList.contains('density-compact')).toBe(false)
    expect(localStorage.getItem('board-density')).toBe('comfortable')
  })
})

describe('BoardScreen — Exportar e Arquivados pela barra (A5-04, A5-14, A3-24)', () => {
  test('o ícone Exportar abre o ExportDialog (lazy) do projeto', async () => {
    renderBoard()
    await boardMontado()
    expect(document.querySelector('[data-testid="export-dialog"]')).toBeNull()

    fireEvent.click(botaoDaBarra(t('exportData')))

    await waitFor(() => expect(document.querySelector('[data-testid="export-dialog"]')).not.toBeNull())
    expect(ultimo(propsDoExport)?.projectId).toBe('p1')
  })

  test('A3-24: o ExportDialog recebe os filtros atuais, com status, sem updatedWithin nem hideEmpty*', async () => {
    localStorage.setItem('board-filters:p1', JSON.stringify({
      priority: 'MEDIUM', status: 'NOT_STARTED,IN_PROGRESS', types: ['TASK'], assigneeId: 'u1',
      updatedWithin: '1w', hideEmptyEpics: true, hideEmptyStories: true, showSubtasks: true,
    }))
    renderBoard()
    await waitFor(() => expect(consultaBotaoDaBarra(t('exportData'))).not.toBeNull())

    fireEvent.click(botaoDaBarra(t('exportData')))

    await waitFor(() => expect(propsDoExport.length).toBeGreaterThan(0))
    const filtros = ultimo(propsDoExport)!.filters
    // Só as chaves preenchidas chegam com valor; as vazias vão como undefined.
    const definidos = Object.fromEntries(Object.entries(filtros).filter(([, valor]) => valor !== undefined))
    expect(definidos).toEqual({ priority: 'MEDIUM', status: 'NOT_STARTED,IN_PROGRESS', types: ['TASK'], assigneeId: 'u1' })
    expect(Object.keys(filtros).sort()).toEqual([
      'assigneeId', 'authorId', 'costCenterId', 'moduleId', 'priority', 'sprintId', 'squadId', 'status', 'tagIds', 'types', 'versionId',
    ])
  })

  test('o ícone Arquivados busca os arquivados e abre o modal', async () => {
    renderBoard()
    await boardMontado()
    expect(document.querySelector(`[role="dialog"][aria-label="${t('archivedItems')}"]`)).toBeNull()

    fireEvent.click(botaoDaBarra(t('archivedItems')))

    const dialogo = await waitFor(() => {
      const encontrado = document.querySelector(`[role="dialog"][aria-label="${t('archivedItems')}"]`) as HTMLElement | null
      expect(encontrado).not.toBeNull()
      return encontrado!
    })
    expect(requisicoes.some(([metodo, url]) => metodo === 'GET' && url.includes('/projects/p1/items/archived'))).toBe(true)
    await waitFor(() => expect(dialogo).toHaveTextContent(t('noArchivedItems')))
  })
})

describe('BoardScreen — cronograma em Opções (A5-02, A5-03)', () => {
  test('Recalcular datas faz POST /schedule/recalculate, avisa a contagem e invalida o board', async () => {
    renderBoard()
    await boardMontado()
    fireEvent.click(botaoDaBarra(t('optionsMenu')))
    fireEvent.click(botaoDaBarra(t('scheduleRecalculate')))

    await waitFor(() => expect(estadoDoBoard.invalidacoes).toBe(1))
    expect(mutacoes()).toHaveLength(1)
    expect(mutacoes()[0]![0]).toBe('POST')
    expect(mutacoes()[0]![1].endsWith('/projects/p1/schedule/recalculate')).toBe(true)
    expect(toasts).toEqual([['2 item(ns) com datas ajustadas.', undefined]])
  })

  test('caminho crítico com 0 dependências no servidor mostra toast de erro e não destaca nada', async () => {
    renderBoard()
    await boardMontado()
    fireEvent.click(botaoDaBarra(t('optionsMenu')))
    const chave = barra().getByRole('switch', { name: t('scheduleCriticalPath') })
    // Habilitado porque um card exibido tem dependencyCount > 0.
    expect(chave).toBeEnabled()
    expect(chave).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(chave)

    await waitFor(() => expect(toasts).toEqual([[t('scheduleNoDependencies'), 'error']]))
    expect(requisicoes.some(([metodo, url]) => metodo === 'GET' && url.endsWith('/projects/p1/schedule/critical-path'))).toBe(true)
    expect(barra().getByRole('switch', { name: t('scheduleCriticalPath') })).toHaveAttribute('aria-checked', 'false')
    expect(document.querySelector('.kanban-card.ring-amber-400\\/80')).toBeNull()
  })
})

describe('BoardScreen — Recolher tudo em Opções (A5-08)', () => {
  test('grava módulos, épicos + "orphan" e os grupos de história em board-collapsed-*:p1', async () => {
    renderBoard()
    await boardMontado()
    fireEvent.click(botaoDaBarra(t('optionsMenu')))
    fireEvent.click(botaoDaBarra(t('collapseAll')))

    await waitFor(() => expect((lerJson('board-collapsed-epics:p1') as string[] | null)?.length).toBe(3))
    expect((lerJson('board-collapsed-modules:p1') as string[]).sort()).toEqual(['mod-1', 'mod-2'])
    expect((lerJson('board-collapsed-epics:p1') as string[]).sort()).toEqual(['epic-1', 'epic-2', 'orphan'])
    expect((lerJson('board-collapsed-stories:p1') as string[]).sort()).toEqual(['story-1', 'story-2'])
    // Recolhidos, os cards saem da tela.
    await waitFor(() => expect(cardPorId('task-1')).toBeNull())
  })
})

describe('BoardScreen — squad na barra (A3-13)', () => {
  test('escolher um squad mostra só os cards de responsáveis membros dele', async () => {
    renderBoard()
    await boardMontado()
    expect(cardPorId('task-2')).not.toBeNull()
    const select = barra().getByRole('combobox', { name: t('filterSquad') })

    fireEvent.change(select, { target: { value: 'squad-a' } })
    await waitFor(() => expect(cardPorId('task-2')).toBeNull())
    expect(cardPorId('task-1')).not.toBeNull()

    fireEvent.change(select, { target: { value: 'squad-b' } })
    await waitFor(() => expect(cardPorId('task-1')).toBeNull())
    expect(cardPorId('task-2')).not.toBeNull()
  })
})

describe('BoardScreen — limiar do arraste com ponteiro real (A1-05)', () => {
  // As coordenadas ficam longe das colunas (retângulos zerados no jsdom): o
  // arraste, quando inicia, termina fora e é cancelado sem mutação.
  const arrastando = () => document.querySelector('.kanban-card--dragging[data-card-id="task-1"]')

  test('na alça, mover menos de 5 px não inicia o arraste; passar de 5 px inicia', async () => {
    renderBoard()
    const card = await boardMontado()
    const alca = card.querySelector('.kanban-card-grip') as HTMLElement

    act(() => { fireEvent.pointerDown(alca, { button: 0, isPrimary: true, pointerId: 1, clientX: 5000, clientY: 5000 }) })
    act(() => { fireEvent.pointerMove(document, { pointerId: 1, clientX: 5003, clientY: 5000 }) })
    act(() => { fireEvent.pointerMove(document, { pointerId: 1, clientX: 5003, clientY: 5003 }) })
    await act(() => new Promise(resolve => setTimeout(resolve, 30)))
    expect(arrastando()).toBeNull()

    act(() => { fireEvent.pointerMove(document, { pointerId: 1, clientX: 5010, clientY: 5000 }) })
    await waitFor(() => expect(arrastando()).not.toBeNull())
    act(() => { fireEvent.pointerUp(document, { pointerId: 1, clientX: 5010, clientY: 5000 }) })
    await waitFor(() => expect(toasts).toEqual([[t('dragDropCanceled'), undefined]]))
    expect(mutacoes()).toEqual([])
    // Após a soltura o dnd-kit mantém por 50 ms um filtro de clique no documento.
    await act(() => new Promise(resolve => setTimeout(resolve, 120)))
  })

  test('na alça, pointerdown e pointerup sem mover não inicia o arraste', async () => {
    renderBoard()
    const card = await boardMontado()
    const alca = card.querySelector('.kanban-card-grip') as HTMLElement

    act(() => { fireEvent.pointerDown(alca, { button: 0, isPrimary: true, pointerId: 1, clientX: 5000, clientY: 5000 }) })
    await act(() => new Promise(resolve => setTimeout(resolve, 30)))
    expect(arrastando()).toBeNull()
    act(() => { fireEvent.pointerUp(document, { pointerId: 1, clientX: 5000, clientY: 5000 }) })
    await act(() => new Promise(resolve => setTimeout(resolve, 30)))
    expect(toasts).toEqual([])
    expect(arrastando()).toBeNull()
  })

  test('no corpo do card, pointerdown + pointerup sem mover abre o detalhe e não arrasta', async () => {
    renderBoard()
    const card = await boardMontado()
    const corpo = card.querySelector('.kanban-card-footer .priority') as HTMLElement

    act(() => { fireEvent.pointerDown(corpo, { button: 0, isPrimary: true, pointerId: 1, clientX: 5000, clientY: 5000 }) })
    act(() => { fireEvent.pointerUp(corpo, { pointerId: 1, clientX: 5000, clientY: 5000 }) })
    fireEvent.click(corpo)

    const dialogo = await waitFor(() => {
      const encontrado = document.querySelector('[role="dialog"]') as HTMLElement | null
      expect(encontrado).not.toBeNull()
      return encontrado!
    })
    expect(dialogo.querySelector('#item-modal-title')).toHaveTextContent('Tarefa da Ana')
    expect(arrastando()).toBeNull()
    expect(toasts).toEqual([])
  })

  test('no corpo do card, pointerdown e mover 40 px não inicia o arraste (só a alça arrasta)', async () => {
    renderBoard()
    const card = await boardMontado()
    const corpo = card.querySelector('.kanban-card-footer .priority') as HTMLElement

    act(() => { fireEvent.pointerDown(corpo, { button: 0, isPrimary: true, pointerId: 1, clientX: 5000, clientY: 5000 }) })
    act(() => { fireEvent.pointerMove(document, { pointerId: 1, clientX: 5040, clientY: 5040 }) })
    await act(() => new Promise(resolve => setTimeout(resolve, 30)))
    expect(arrastando()).toBeNull()
    act(() => { fireEvent.pointerUp(document, { pointerId: 1, clientX: 5040, clientY: 5040 }) })
    await act(() => new Promise(resolve => setTimeout(resolve, 120)))
    expect(toasts).toEqual([])
  })
})
