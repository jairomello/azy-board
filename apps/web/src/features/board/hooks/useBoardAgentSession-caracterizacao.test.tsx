// Teste de caracterização (P0 do redesenho da barra do board).
// A4-06 — a sessão do agente força a visão: cada notificação de comando faz
// `setView(session.mode)`, e o modo só pode ser `kanban` ou `tree`. Como o
// baseline publica o Unificado como `kanban`, qualquer comando da conversa tira
// o usuário do Unificado. É o comportamento ATUAL; se o redesenho corrigir isso
// de propósito, este teste muda junto com a change do OpenSpec correspondente.
// A4-07 (parcial) — o mesmo comando aplica os filtros no estado do board.
import '../../../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { VIEW_COMMAND_SCHEMA_VERSION, type AssistantViewCommand } from '@azy-board/assistant-contracts'
import type { BoardFilterState } from '../../../components/BoardFilters'
import { applyViewCommand } from '../../../lib/assistantViewStore'
import { DEFAULT_FILTERS, type BoardView } from '../model/types'
import { useBoardAgentSession } from './useBoardAgentSession'

function comando(partial: Partial<AssistantViewCommand> & Pick<AssistantViewCommand, 'type'>): AssistantViewCommand {
  return { schemaVersion: VIEW_COMMAND_SCHEMA_VERSION, commandId: crypto.randomUUID(), ...partial }
}

// Monta o hook com estado real de visão e filtros, como o BoardScreen faz.
function useCenario(projectId: string, viewInicial: BoardView) {
  const [view, setView] = useState<BoardView>(viewInicial)
  const [filters, setFilters] = useState<BoardFilterState>(DEFAULT_FILTERS)
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null)
  const [itemModalId, setItemModalId] = useState<string | null>(null)
  const [collapsedEpics, setCollapsedEpics] = useState<Set<string>>(new Set())
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set())
  const [collapsedStories, setCollapsedStories] = useState<Set<string>>(new Set())
  useBoardAgentSession({
    projectId, projectName: 'Projeto', route: `/projects/${projectId}/board`,
    filters, setFilters, view, setView,
    activeModuleId, setActiveModuleId, itemModalId, setItemModalId,
    collapsedEpics, collapsedModules, collapsedStories,
    setCollapsedEpics, setCollapsedModules, setCollapsedStories,
    allItems: [], allDisplayed: [],
  })
  return { view, setView, filters }
}

// Projeto novo a cada teste: o baseline do store é um mapa em memória por projeto.
let projeto = ''
let contador = 0

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  projeto = `projeto-sessao-${++contador}`
})

describe('caracterização A4-06 — a sessão do agente força a visão', () => {
  test('no Unificado, um comando de filtros leva a visão para Board (kanban) — comportamento atual', () => {
    const { result } = renderHook(() => useCenario(projeto, 'unified'))
    expect(result.current.view).toBe('unified')

    act(() => applyViewCommand(projeto, comando({ type: 'set_filters', filters: { priority: 'HIGH' } })))

    expect(result.current.filters.priority).toBe('HIGH')
    expect(result.current.view).toBe('kanban')
  })

  test('usuário troca para Unificado depois de montar: o próximo comando ainda volta para Board', () => {
    const { result } = renderHook(() => useCenario(projeto, 'kanban'))
    act(() => result.current.setView('unified'))
    expect(result.current.view).toBe('unified')

    act(() => applyViewCommand(projeto, comando({ type: 'open_item', itemId: 'item-1' })))
    expect(result.current.view).toBe('kanban')
  })

  test('na Árvore, um comando de filtros mantém a Árvore (o baseline publica tree)', () => {
    const { result } = renderHook(() => useCenario(projeto, 'tree'))

    act(() => applyViewCommand(projeto, comando({ type: 'set_filters', filters: { priority: 'LOW' } })))

    expect(result.current.filters.priority).toBe('LOW')
    expect(result.current.view).toBe('tree')
  })

  test('set_view troca a visão para a Árvore', () => {
    const { result } = renderHook(() => useCenario(projeto, 'unified'))

    act(() => applyViewCommand(projeto, comando({ type: 'set_view', view: { mode: 'tree', activeModuleId: null } })))

    expect(result.current.view).toBe('tree')
  })

  test('comando de outro projeto é ignorado e a visão fica como está', () => {
    const { result } = renderHook(() => useCenario(projeto, 'unified'))

    act(() => applyViewCommand(`${projeto}-outro`, comando({ type: 'set_filters', filters: { priority: 'HIGH' } })))

    expect(result.current.view).toBe('unified')
    expect(result.current.filters.priority).toBe('')
  })
})

// A3-30 — `set_filters` da conversa SUBSTITUI o estado inteiro de filtros: o que
// o comando não traz volta ao padrão, inclusive as preferências de exibição
// (subtarefas, histórias como cards, módulos em abas, ocultar vazios) e o squad,
// que não é um filtro aceito pelo comando. É o comportamento ATUAL.
const FILTROS_DO_USUARIO: BoardFilterState = {
  ...DEFAULT_FILTERS,
  status: 'IN_PROGRESS', squadId: 'squad-a', assigneeId: 'u1', types: ['BUG'], updatedWithin: '1w',
  showSubtasks: true, storyDisplay: 'cards', moduleViewMode: 'tabs', hideEmptyEpics: true, hideEmptyStories: true,
}

function useCenarioComFiltros(projectId: string, filtrosIniciais: BoardFilterState) {
  const [view, setView] = useState<BoardView>('kanban')
  const [filters, setFilters] = useState<BoardFilterState>(filtrosIniciais)
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null)
  const [itemModalId, setItemModalId] = useState<string | null>(null)
  const [collapsedEpics, setCollapsedEpics] = useState<Set<string>>(new Set())
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set())
  const [collapsedStories, setCollapsedStories] = useState<Set<string>>(new Set())
  useBoardAgentSession({
    projectId, projectName: 'Projeto', route: `/projects/${projectId}/board`,
    filters, setFilters, view, setView,
    activeModuleId, setActiveModuleId, itemModalId, setItemModalId,
    collapsedEpics, collapsedModules, collapsedStories,
    setCollapsedEpics, setCollapsedModules, setCollapsedStories,
    allItems: [], allDisplayed: [],
  })
  return { filters }
}

describe('caracterização A3-30 — set_filters substitui o estado inteiro de filtros', () => {
  test('com filtros e preferências não padrão, o comando deixa só o que trouxe; o resto volta ao padrão', () => {
    const { result } = renderHook(() => useCenarioComFiltros(projeto, FILTROS_DO_USUARIO))
    expect(result.current.filters).toEqual(FILTROS_DO_USUARIO)

    act(() => applyViewCommand(projeto, comando({ type: 'set_filters', filters: { priority: 'HIGH' } })))

    expect(result.current.filters).toEqual({ ...DEFAULT_FILTERS, priority: 'HIGH' })
  })

  test('o primeiro comando também descarta preferências de exibição definidas pelo usuário', () => {
    const { result } = renderHook(() => useCenarioComFiltros(projeto, FILTROS_DO_USUARIO))

    act(() => applyViewCommand(projeto, comando({ type: 'set_filters', filters: { status: ['DONE'] } })))

    expect(result.current.filters.status).toBe('DONE')
    expect(result.current.filters.showSubtasks).toBe(false)
    expect(result.current.filters.storyDisplay).toBe('lanes')
    expect(result.current.filters.moduleViewMode).toBe('hierarchy')
    expect(result.current.filters.hideEmptyEpics).toBe(false)
    expect(result.current.filters.hideEmptyStories).toBe(false)
    expect(result.current.filters.squadId).toBe('')
    expect(result.current.filters.updatedWithin).toBe('')
  })
})
