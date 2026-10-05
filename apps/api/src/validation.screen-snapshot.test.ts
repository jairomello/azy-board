import { describe, expect, test } from 'bun:test'
import { assistantScreenSnapshotSchema } from './validation'

// Card T18 — regressão de drift: a fotografia da tela carrega o estado de
// apresentação opcional (view.presentation) e o schema strict o aceita.
const baseSnapshot = {
  schemaVersion: 1 as const,
  contextId: 'ctx-1',
  capturedAt: '2026-10-05T12:00:00.000Z',
  route: '/projects/p1/board',
  screen: 'project-board-kanban' as const,
  projectId: 'p1',
  projectName: 'Projeto',
  view: { mode: 'kanban' as const, activeModuleId: null, collapsedGroupIds: [] },
  filters: {},
  scope: { mode: 'ALL' as const },
  results: { displayedItemIds: [], displayedCount: 0, totalMatchingCount: null, isComplete: true, revisions: {} },
  focus: { modalStack: 0, activeItemId: null, activeTab: null, hasUnsavedChanges: false },
}

describe('assistantScreenSnapshotSchema — estado de apresentação (Card T18)', () => {
  test('aceita view.presentation opcional', () => {
    const parsed = assistantScreenSnapshotSchema.safeParse({
      ...baseSnapshot,
      view: {
        ...baseSnapshot.view,
        presentation: { showSubtasks: false, storyDisplay: 'lanes', moduleViewMode: 'hierarchy', hideEmptyEpics: false, hideEmptyStories: false },
      },
    })
    expect(parsed.success).toBe(true)
  })

  test('aceita fotografia sem presentation', () => {
    expect(assistantScreenSnapshotSchema.safeParse(baseSnapshot).success).toBe(true)
  })

  test('rejeita presentation inválido', () => {
    const parsed = assistantScreenSnapshotSchema.safeParse({
      ...baseSnapshot,
      view: { ...baseSnapshot.view, presentation: { showSubtasks: 'não' } },
    })
    expect(parsed.success).toBe(false)
  })

  test('continua rejeitando chave desconhecida no view', () => {
    const parsed = assistantScreenSnapshotSchema.safeParse({ ...baseSnapshot, view: { ...baseSnapshot.view, extra: true } })
    expect(parsed.success).toBe(false)
  })
})
