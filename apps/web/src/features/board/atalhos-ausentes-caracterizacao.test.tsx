// Teste de caracterização da AUSÊNCIA de atalhos de teclado globais no board e
// na árvore. Hoje, tecla de uma letra/dígito/símbolo pressionada com o foco no
// body não faz nada: não abre modal, menu ou listbox, não expande nada, não troca
// a visão nem a densidade (nem as preferências gravadas delas), não navega, não
// move o foco, não dispara toast nem mutação.
//
// ATENÇÃO: este arquivo vai mudar DE PROPÓSITO no passo que introduzir os atalhos
// globais (por isso fica isolado dos demais testes de caracterização). Quando o
// atalho existir, troque a tecla correspondente daqui por um teste positivo.
//
// A montagem segue board-screen-caracterizacao.test.tsx: sessão, casca, toast e
// o cache remoto do board são substituídos; o resto (busca do header, command
// bar, lanes, árvore) é o real.
import { screen } from '../../test/setup'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as bunTest from 'bun:test'
import { act, configure, fireEvent, render, waitFor } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '../../i18n'
import type { Column, ItemData, Module } from './model/types'

configure({ asyncUtilTimeout: 5000 })
// Montagem pesada (editor rico, board/árvore inteiros): com a máquina ou o CI
// carregados, o teste passa dos 5 s padrão do bun:test sem estar errado.
;(bunTest as unknown as { setDefaultTimeout: (ms: number) => void }).setDefaultTimeout(20_000)

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

// A casca real (sidebar, header, assistente) fica de fora; os slots que o board
// preenche — busca do header e command bar — são renderizados como no shell.
mockModule('../../components/AppShell', () => ({
  AppShell: ({ children, headerSearch, commandBar }: { children: ReactNode; headerSearch?: ReactNode; commandBar?: ReactNode }) => (
    <div data-testid="casca">
      <header>{headerSearch}</header>
      {commandBar}
      <main>{children}</main>
    </div>
  ),
}))

const COLUNAS: Column[] = [
  { id: 'todo', name: 'A Fazer', baseStatus: 'NOT_STARTED', position: 0 },
  { id: 'doing', name: 'Fazendo', baseStatus: 'IN_PROGRESS', position: 1 },
] as Column[]

const MODULOS: Module[] = [{ id: 'mod-1', name: 'Módulo Um', position: 0 }]

function base(overrides: Partial<ItemData>): ItemData {
  return {
    id: 'x', title: 'x', type: 'TASK', status: 'NOT_STARTED', priority: 'MEDIUM', columnId: 'todo',
    isLeaf: true, ancestryPath: '[]', position: 0, parentId: null, ...overrides,
  } as ItemData
}

const caminho = (...nos: Array<[string, string, string]>) => JSON.stringify(nos.map(([id, type, title]) => ({ id, type, title })))

const ITENS: ItemData[] = [
  base({ id: 'epic-1', title: 'Épico Um', type: 'EPIC', isLeaf: false, columnId: null, moduleId: 'mod-1' }),
  base({ id: 'story-1', title: 'História Um', type: 'STORY', isLeaf: false, columnId: 'todo', parentId: 'epic-1', ancestryPath: caminho(['epic-1', 'EPIC', 'Épico Um']) }),
  base({ id: 'task-1', title: 'Tarefa Um', parentId: 'story-1', ancestryPath: caminho(['epic-1', 'EPIC', 'Épico Um'], ['story-1', 'STORY', 'História Um']) }),
]

const ARVORE = [
  {
    id: 'mod-1', name: 'Módulo Um', type: 'module', children: [
      { id: 'epic-1', title: 'Épico Um', type: 'EPIC', parentId: 'mod-1', moduleId: 'mod-1', updatedAt: '2026-11-01T10:00:00.000Z', children: [] },
    ],
  },
]

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
      cancelBoardReads: () => {},
    }
  },
}))

const { default: BoardPage } = await import('./BoardScreen')

const fetchOriginal = globalThis.fetch
const requisicoes: Array<[string, string]> = []

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function Localizacao() {
  const local = useLocation()
  return <output data-testid="local">{`${local.pathname}${local.search}`}</output>
}

function renderBoard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/p1/board']}>
        <Routes>
          <Route path="/projects/:projectId/board" element={<><BoardPage /><Localizacao /></>} />
          <Route path="*" element={<Localizacao />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  toasts.length = 0
  requisicoes.length = 0
  try { localStorage.clear() } catch { /* sem storage */ }
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    requisicoes.push([init?.method ?? 'GET', url])
    if (url.includes('/items/tree')) return json(structuredClone(ARVORE))
    return json({})
  }) as typeof fetch
})

afterEach(() => { globalThis.fetch = fetchOriginal })

/** Teclas de um caractere que um redesenho costuma usar como atalho global. */
const TECLAS = ['c', 'f', 'e', 'n', 't', 'b', 'k', 'g', 'j', 'x', '/', '1', '2', '3', '?'] as const

const botaoDeVisao = (nome: 'Board' | 'Unificado' | 'Árvore') =>
  screen.getAllByRole('button', { name: nome }).find((botao: HTMLElement) => botao.hasAttribute('aria-pressed'))!

/** Retrato do que um atalho poderia mudar na tela. */
function retrato() {
  const rotulo = (elemento: Element) => elemento.getAttribute('aria-label') ?? elemento.textContent?.trim() ?? ''
  return {
    sobreposicoes: document.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]').length,
    expandidos: Array.from(document.querySelectorAll('[aria-expanded="true"]')).map(rotulo),
    pressionados: Array.from(document.querySelectorAll('[aria-pressed="true"]')).map(rotulo),
    marcados: Array.from(document.querySelectorAll('[aria-checked="true"], [aria-selected="true"]')).map(rotulo),
    menuDeColunas: screen.queryByText('Colunas visíveis') !== null,
    focoNoBody: document.activeElement === document.body,
    local: screen.getByTestId('local').textContent,
    densidadeCompacta: document.querySelector('.density-compact') !== null,
    preferencias: preferenciasDeExibicao(),
  }
}

/** Preferências de exibição gravadas (densidade e visão por projeto). */
function preferenciasDeExibicao() {
  const gravadas: Record<string, string | null> = {}
  for (let indice = 0; indice < localStorage.length; indice += 1) {
    const chave = localStorage.key(indice)
    if (chave && (chave === 'board-density' || chave.startsWith('board-view:'))) gravadas[chave] = localStorage.getItem(chave)
  }
  return gravadas
}

async function pressionarNoBody(tecla: string) {
  await act(() => {
    fireEvent.keyDown(document.body, { key: tecla, shiftKey: tecla === '?' })
    fireEvent.keyUp(document.body, { key: tecla, shiftKey: tecla === '?' })
  })
}

async function conferirSemEfeito() {
  // Garante o foco no body, como numa tela recém-aberta sem nada focado.
  ;(document.activeElement as HTMLElement | null)?.blur?.()
  const antes = retrato()
  expect(antes.focoNoBody).toBe(true)
  expect(antes.sobreposicoes).toBe(0)
  for (const tecla of TECLAS) {
    await pressionarNoBody(tecla)
    expect({ tecla, ...retrato() }).toEqual({ tecla, ...antes })
  }
  await act(() => new Promise(resolve => setTimeout(resolve, 30)))
  expect(retrato()).toEqual(antes)
  expect(toasts).toEqual([])
  expect(requisicoes.filter(([metodo]) => metodo !== 'GET')).toEqual([])
}

describe('Atalhos globais ausentes — board', () => {
  test('na visão Board, teclas de um caractere com foco no body não fazem nada', async () => {
    renderBoard()
    await waitFor(() => expect(document.querySelector('.kanban-card[data-card-id="task-1"]')).not.toBeNull())
    expect(botaoDeVisao('Board')).toHaveAttribute('aria-pressed', 'true')

    await conferirSemEfeito()

    expect(botaoDeVisao('Board')).toHaveAttribute('aria-pressed', 'true')
    expect(botaoDeVisao('Árvore')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('local')).toHaveTextContent('/projects/p1/board')
  })
})

describe('Atalhos globais ausentes — árvore', () => {
  test('na visão Árvore, teclas de um caractere com foco no body não fazem nada', async () => {
    renderBoard()
    await waitFor(() => expect(document.querySelector('.kanban-card[data-card-id="task-1"]')).not.toBeNull())
    fireEvent.click(botaoDeVisao('Árvore'))
    await screen.findByRole('button', { name: 'Expandir tudo' })
    await screen.findByText('Épico Um')
    expect(botaoDeVisao('Árvore')).toHaveAttribute('aria-pressed', 'true')

    await conferirSemEfeito()

    expect(botaoDeVisao('Árvore')).toHaveAttribute('aria-pressed', 'true')
    expect(botaoDeVisao('Board')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText('Colunas visíveis')).toBeNull()
  })
})
