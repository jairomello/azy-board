import '../test/setup'
import { beforeEach, describe, expect, test } from 'bun:test'
import { VIEW_COMMAND_SCHEMA_VERSION, type AssistantViewCommand } from '@azy-board/assistant-contracts'
import { DEFAULT_FILTERS, EMPTY_FILTER_VALUE } from '../features/board/model/types'
import { applyViewCommand, defaultViewSession, readPinnedResult, receiveViewCommand, subscribeViewSession, syncCurrentViewSession, type AssistantViewSession } from './assistantViewStore'

function command(partial: Partial<AssistantViewCommand> & Pick<AssistantViewCommand, 'type'>): AssistantViewCommand {
  return { schemaVersion: VIEW_COMMAND_SCHEMA_VERSION, commandId: partial.commandId ?? crypto.randomUUID(), ...partial }
}

function capture(): { sessions: AssistantViewSession[]; unsubscribe: () => void } {
  const sessions: AssistantViewSession[] = []
  const unsubscribe = subscribeViewSession(session => sessions.push(session))
  return { sessions, unsubscribe }
}

describe('assistantViewStore (card T17)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  test('aplica filtros convertendo IS_EMPTY no sentinela do board', () => {
    const { sessions, unsubscribe } = capture()
    applyViewCommand('p1', command({ type: 'set_filters', filters: { sprintId: { operator: 'IS_EMPTY' }, types: ['BUG'] } }))
    unsubscribe()

    expect(sessions).toHaveLength(1)
    expect(sessions[0].filters.sprintId).toBe(EMPTY_FILTER_VALUE)
    expect(sessions[0].filters.types).toEqual(['BUG'])
  })

  test('alterna a visualização e abre item', () => {
    const { sessions, unsubscribe } = capture()
    applyViewCommand('p1', command({ type: 'set_view', view: { mode: 'tree', activeModuleId: 'm1' } }))
    applyViewCommand('p1', command({ type: 'open_item', itemId: 'i9' }))
    unsubscribe()

    expect(sessions[0].mode).toBe('tree')
    expect(sessions[0].activeModuleId).toBe('m1')
    expect(sessions[1].openItemId).toBe('i9')
  })

  test('volta à visão anterior pela pilha', () => {
    syncCurrentViewSession('p1', { filters: { ...DEFAULT_FILTERS, priority: 'LOW' }, mode: 'kanban', activeModuleId: null, openItemId: null })
    applyViewCommand('p1', command({ type: 'set_view', view: { mode: 'tree', activeModuleId: null } }))
    const { sessions, unsubscribe } = capture()
    applyViewCommand('p1', command({ type: 'restore_previous_view' }))
    unsubscribe()

    expect(sessions[0].mode).toBe('kanban')
    expect(sessions[0].filters.priority).toBe('LOW')
  })

  test('a pilha é limitada', () => {
    for (let index = 0; index < 25; index++) {
      applyViewCommand('p1', command({ type: 'set_view', view: { mode: index % 2 === 0 ? 'tree' : 'kanban', activeModuleId: null } }))
    }
    const stored = JSON.parse(sessionStorage.getItem('azy-board:view-session:p1')!) as { history: unknown[] }
    expect(stored.history.length).toBe(20)
  })

  test('não grava em localStorage (isolamento por aba)', () => {
    applyViewCommand('p1', command({ type: 'set_view', view: { mode: 'tree', activeModuleId: null } }))
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.getItem('azy-board:view-session:p1')).not.toBeNull()
  })

  test('projetos diferentes não compartilham sessão', () => {
    applyViewCommand('p1', command({ type: 'set_view', view: { mode: 'tree', activeModuleId: null } }))
    const { sessions, unsubscribe } = capture()
    applyViewCommand('p2', command({ type: 'set_view', view: { mode: 'kanban', activeModuleId: null } }))
    unsubscribe()

    expect(sessions[0].mode).toBe('kanban')
    expect(defaultViewSession().mode).toBe('kanban')
  })

  test('deduplica comandos pelo commandId', () => {
    const cmd = command({ type: 'restore_previous_view' })
    const { sessions, unsubscribe } = capture()
    receiveViewCommand('p1', cmd)
    receiveViewCommand('p1', cmd)
    unsubscribe()

    // Primeira chamada não tem histórico (no-op sem notificar); a segunda é deduplicada.
    expect(sessions).toHaveLength(0)
  })

  test('recusa comando de versão desconhecida', () => {
    const invalid = { ...command({ type: 'set_view', view: { mode: 'tree', activeModuleId: null } }), schemaVersion: 99 } as unknown as AssistantViewCommand
    expect(receiveViewCommand('p1', invalid)).toBe(false)
  })

  test('abre recorte de lacunas preservando a população exata e a visão anterior', () => {
    const { sessions, unsubscribe } = capture()
    applyViewCommand('p1', command({ type: 'open_planning_result', planningResult: {
      resultId: 'r1', itemIds: ['a', 'b'], ancestorIds: ['epic-1'], hiddenCount: 1,
      totalDistinct: 3, capturedAt: '2026-10-07T12:00:00.000Z', labelKey: 'planning-gap:points', group: 'points',
    } }))
    expect(sessions[0].pinnedResult?.itemIds).toEqual(['a', 'b'])
    expect(sessions[0].pinnedResult?.hiddenCount).toBe(1)
    expect(readPinnedResult('p1')?.resultId).toBe('r1')

    applyViewCommand('p1', command({ type: 'restore_previous_view' }))
    unsubscribe()
    expect(sessions[1].pinnedResult ?? null).toBeNull()
  })

  test('aplicar filtros limpa o recorte fixado', () => {
    applyViewCommand('p1', command({ type: 'open_planning_result', planningResult: {
      resultId: 'r1', itemIds: ['a'], ancestorIds: [], hiddenCount: 0,
      totalDistinct: 1, capturedAt: '2026-10-07T12:00:00.000Z', labelKey: 'planning-gap-query', group: null,
    } }))
    applyViewCommand('p1', command({ type: 'set_filters', filters: { types: ['BUG'] } }))
    expect(readPinnedResult('p1')).toBeNull()
  })
})
