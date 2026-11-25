// Teste de caracterização do Exportar no BoardScreen montado com o ExportDialog
// REAL (A5-04). O arquivo board-screen-ligacoes-caracterizacao.test.tsx troca o
// diálogo por um dublê que registra as props; aqui o diálogo é o de verdade,
// carregado pelo lazy da tela, para prender a ligação de volta: fechar o
// diálogo (X, Cancelar, Esc ou clique no fundo) o remove da tela, e o ícone
// Exportar o abre de novo.
//
// Como nos demais testes da tela, só os módulos de borda são substituídos:
// sessão (AuthContext), casca (AppShell, que renderiza a barra de comando),
// toast e o cache remoto do board (useBoardData).
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

mockModule('../../components/Toast', () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => children,
  useToast: () => ({ toast: () => {} }),
}))

mockModule('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ user: { id: 'u1', name: 'Ana', email: 'ana@exemplo.test' }, loading: false }),
}))

mockModule('../../components/AppShell', () => ({
  AppShell: (props: { children: ReactNode; commandBar?: ReactNode }) => (
    <div>
      <div data-testid="barra">{props.commandBar}</div>
      <div data-testid="casca">{props.children}</div>
    </div>
  ),
}))

const COLUNAS: Column[] = [
  { id: 'todo', name: 'A Fazer', baseStatus: 'NOT_STARTED', position: 0 },
] as Column[]

const MODULOS: Module[] = [{ id: 'mod-1', name: 'Módulo Um', position: 0 }]

const caminho = (...nos: Array<[string, string, string]>) => JSON.stringify(nos.map(([id, type, title]) => ({ id, type, title })))

function base(overrides: Partial<ItemData>): ItemData {
  return {
    id: 'x', title: 'x', type: 'TASK', status: 'NOT_STARTED', priority: 'MEDIUM', columnId: 'todo',
    isLeaf: true, ancestryPath: '[]', position: 0, parentId: null, ...overrides,
  } as ItemData
}

const ITENS: ItemData[] = [
  base({ id: 'epic-1', title: 'Épico Um', type: 'EPIC', isLeaf: false, columnId: null, moduleId: 'mod-1' }),
  base({ id: 'story-1', title: 'História Um', type: 'STORY', isLeaf: false, columnId: 'todo', parentId: 'epic-1', ancestryPath: caminho(['epic-1', 'EPIC', 'Épico Um']) }),
  base({ id: 'task-1', title: 'Tarefa Um', parentId: 'story-1', ancestryPath: caminho(['epic-1', 'EPIC', 'Épico Um'], ['story-1', 'STORY', 'História Um']) }),
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

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
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

const t = (key: string) => i18n.t(key, { ns: 'board' })
const barra = () => within(document.body).getByTestId('barra')
const dialogoDeExportacao = () => document.querySelector('[role="dialog"][aria-labelledby="export-dialog-title"]') as HTMLElement | null

/** Abre o ExportDialog real pelo ícone da barra e espera o lazy carregar. */
async function abrirExportacao() {
  fireEvent.click(within(barra()).getByRole('button', { name: t('exportData') }))
  return waitFor(() => {
    const dialogo = dialogoDeExportacao()
    expect(dialogo).not.toBeNull()
    expect(dialogo).toHaveTextContent('Exportar dados')
    return dialogo!
  })
}

beforeEach(async () => {
  await i18n.changeLanguage('pt-BR')
  try { localStorage.clear() } catch { /* sem storage */ }
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.endsWith('/export-mappings')) return json([])
    return json({})
  }) as typeof fetch
})

afterEach(() => { globalThis.fetch = fetchOriginal })

describe('BoardScreen — fechar o ExportDialog real (A5-04)', () => {
  test('X, Cancelar, Esc e clique no fundo fecham o diálogo; o ícone Exportar reabre', async () => {
    renderBoard()
    await waitFor(() => expect(document.querySelector('.kanban-card[data-card-id="task-1"]')).not.toBeNull())
    expect(dialogoDeExportacao()).toBeNull()

    let dialogo = await abrirExportacao()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(dialogoDeExportacao()).toBeNull())

    dialogo = await abrirExportacao()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(dialogoDeExportacao()).toBeNull())

    await abrirExportacao()
    await act(() => { fireEvent.keyDown(document.body, { key: 'Escape' }) })
    await waitFor(() => expect(dialogoDeExportacao()).toBeNull())

    dialogo = await abrirExportacao()
    fireEvent.mouseDown(dialogo.parentElement as HTMLElement)
    await waitFor(() => expect(dialogoDeExportacao()).toBeNull())
  })
})
