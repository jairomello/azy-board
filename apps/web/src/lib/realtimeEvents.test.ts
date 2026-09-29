import { describe, expect, test } from 'bun:test'
import { BOARD_PATCH_EVENT_TYPES, DASHBOARD_INVALIDATE_EVENT_TYPES, buildDashboardHandlers, buildSettingsHandlers, settingsSectionOf } from './realtimeEvents'

describe('mapeamento de eventos para a camada de cache', () => {
  test('board aplica patches incrementais nos eventos esperados', () => {
    for (const type of ['CARD_MOVED', 'ITEM_CREATED', 'ITEM_UPDATED', 'ITEM_DELETED', 'SUBTASK_CREATED', 'CHECKLIST_UPDATED'] as const) {
      expect(BOARD_PATCH_EVENT_TYPES).toContain(type)
    }
  })

  test('tipos legados não aparecem nos mapas de eventos', () => {
    const legacy = ['CARD_CREATED', 'CARD_DELETED', 'PROGRESS_UPDATED'] as const
    for (const type of legacy) {
      expect(BOARD_PATCH_EVENT_TYPES).not.toContain(type)
      expect(DASHBOARD_INVALIDATE_EVENT_TYPES).not.toContain(type)
    }
  })

  test('dashboard invalida nos eventos de métrica e metadados', () => {
    expect(DASHBOARD_INVALIDATE_EVENT_TYPES).toEqual(['ITEM_CREATED', 'ITEM_UPDATED', 'ITEM_DELETED', 'SPRINT_CHANGED', 'PROJECT_METADATA_CHANGED'])
  })

  test('handlers do dashboard invalidam a consulta para cada tipo', () => {
    let calls = 0
    const handlers = buildDashboardHandlers(() => { calls += 1 })
    for (const type of DASHBOARD_INVALIDATE_EVENT_TYPES) {
      expect(typeof handlers[type]).toBe('function')
      handlers[type]?.({ type, projectId: 'p', payload: {}, sequence: 1 })
    }
    expect(calls).toBe(DASHBOARD_INVALIDATE_EVENT_TYPES.length)
  })

  test('metadados invalidam a seção de Settings correspondente', () => {
    const sections: string[] = []
    const handlers = buildSettingsHandlers(section => { sections.push(section) })
    handlers.PROJECT_METADATA_CHANGED?.({ type: 'PROJECT_METADATA_CHANGED', projectId: 'p', payload: { section: 'members' }, sequence: 1 })
    handlers.PROJECT_METADATA_CHANGED?.({ type: 'PROJECT_METADATA_CHANGED', projectId: 'p', payload: { section: 'costCenters' }, sequence: 2 })
    handlers.MODULE_CREATED?.({ type: 'MODULE_CREATED', projectId: 'p', payload: {}, sequence: 3 })
    expect(sections).toEqual(['members', 'costCenters', 'modules'])
  })

  test('seção desconhecida não dispara invalidação', () => {
    expect(settingsSectionOf({ type: 'PROJECT_METADATA_CHANGED', projectId: 'p', payload: { section: 'nao-existe' }, sequence: 1 })).toBeNull()
  })
})
