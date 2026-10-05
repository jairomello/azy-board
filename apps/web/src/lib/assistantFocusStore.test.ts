import { describe, expect, test } from 'bun:test'
import { clearFocusLevel, emptyFocusState, getFocusState, publishFocusLevel, subscribeFocus } from './assistantFocusStore'

describe('assistantFocusStore (card T19)', () => {
  test('sem níveis, foco vazio', () => {
    expect(getFocusState('proj-vazio')).toEqual(emptyFocusState())
  })

  test('item em primeiro plano é o de maior profundidade', () => {
    publishFocusLevel('p1', { depth: 0, itemId: 'pai', type: 'TASK', activeTab: 'details', activeEntity: null })
    publishFocusLevel('p1', { depth: 1, itemId: 'filho', type: 'BUG', activeTab: 'checklists', activeEntity: null })
    const state = getFocusState('p1')
    expect(state.modalStack).toBe(2)
    expect(state.activeItemId).toBe('filho')
    expect(state.activeTab).toBe('checklists')
    expect(state.modalPath).toEqual([{ itemId: 'pai', type: 'TASK' }, { itemId: 'filho', type: 'BUG' }])
  })

  test('fechar o filho restaura o pai', () => {
    publishFocusLevel('p2', { depth: 0, itemId: 'pai', type: 'TASK', activeTab: 'details', activeEntity: null })
    publishFocusLevel('p2', { depth: 1, itemId: 'filho', type: 'BUG', activeTab: 'links', activeEntity: null })
    clearFocusLevel('p2', 1)
    const state = getFocusState('p2')
    expect(state.modalStack).toBe(1)
    expect(state.activeItemId).toBe('pai')
    expect(state.activeTab).toBe('details')
  })

  test('limpar todos os níveis zera o foco', () => {
    publishFocusLevel('p3', { depth: 0, itemId: 'a', type: 'TASK', activeTab: 'details', activeEntity: null })
    clearFocusLevel('p3', 0)
    expect(getFocusState('p3')).toEqual(emptyFocusState())
  })

  test('objeto interno do topo é exposto', () => {
    publishFocusLevel('p4', { depth: 0, itemId: 'a', type: 'TASK', activeTab: 'activity', activeEntity: { kind: 'work_log', id: 'log-1' } })
    expect(getFocusState('p4').activeEntity).toEqual({ kind: 'work_log', id: 'log-1' })
  })

  test('isola projetos (abas) diferentes', () => {
    publishFocusLevel('proj-a', { depth: 0, itemId: 'a', type: 'TASK', activeTab: 'details', activeEntity: null })
    publishFocusLevel('proj-b', { depth: 0, itemId: 'b', type: 'BUG', activeTab: 'links', activeEntity: null })
    expect(getFocusState('proj-a').activeItemId).toBe('a')
    expect(getFocusState('proj-b').activeItemId).toBe('b')
  })

  test('notifica assinantes com o projeto', () => {
    let seen: string | null = null
    const unsubscribe = subscribeFocus((_state, projectId) => { seen = projectId })
    publishFocusLevel('proj-notify', { depth: 0, itemId: 'x', type: 'TASK', activeTab: 'details', activeEntity: null })
    expect(seen).toBe('proj-notify')
    unsubscribe()
  })
})
