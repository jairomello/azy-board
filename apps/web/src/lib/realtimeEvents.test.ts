import { describe, expect, test } from 'bun:test'
import { BOARD_INCREMENTAL_EVENT_TYPES, DASHBOARD_INVALIDATE_EVENT_TYPES, buildDashboardHandlers } from './realtimeEvents'

describe('mapeamento de eventos para a camada de cache', () => {
  test('board aplica patches incrementais nos eventos esperados', () => {
    for (const type of ['CARD_MOVED', 'ITEM_CREATED', 'ITEM_UPDATED', 'ITEM_DELETED', 'SUBTASK_CREATED', 'CHECKLIST_UPDATED'] as const) {
      expect(BOARD_INCREMENTAL_EVENT_TYPES).toContain(type)
    }
  })

  test('dashboard invalida nos eventos de métrica', () => {
    expect(DASHBOARD_INVALIDATE_EVENT_TYPES).toEqual(['ITEM_CREATED', 'ITEM_UPDATED', 'ITEM_DELETED', 'SPRINT_CHANGED', 'PROGRESS_UPDATED'])
  })

  test('handlers do dashboard invalidam a consulta para cada tipo', () => {
    let calls = 0
    const handlers = buildDashboardHandlers(() => { calls += 1 })
    for (const type of DASHBOARD_INVALIDATE_EVENT_TYPES) {
      expect(typeof handlers[type]).toBe('function')
      handlers[type]?.({ type, projectId: 'p', payload: {} })
    }
    expect(calls).toBe(DASHBOARD_INVALIDATE_EVENT_TYPES.length)
  })
})
