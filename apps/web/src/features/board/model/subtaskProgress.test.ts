import { describe, expect, test } from 'bun:test'
import { subtasksProgressByParent } from './subtaskProgress'
import type { Column } from './types'

const columns: Column[] = [
  { id: 'fazer', name: 'A Fazer', baseStatus: 'NOT_STARTED', position: 0, progressWeight: 0, progressWeightOverride: null },
  { id: 'fazendo', name: 'Fazendo', baseStatus: 'IN_PROGRESS', position: 1, progressWeight: 50, progressWeightOverride: null },
  { id: 'testar', name: 'A Testar', baseStatus: 'IN_PROGRESS', position: 2, progressWeight: 90, progressWeightOverride: null },
  { id: 'done', name: 'Concluídas', baseStatus: 'DONE', position: 3, progressWeight: 100, progressWeightOverride: null },
]

describe('progresso das subtasks por pai', () => {
  test('calcula a média de avanço dos filhos diretos', () => {
    const progress = subtasksProgressByParent([
      { id: 'pai', status: 'IN_PROGRESS', columnId: 'fazendo' },
      { id: 's1', parentId: 'pai', status: 'DONE', columnId: 'done' },
      { id: 's2', parentId: 'pai', status: 'DONE', columnId: 'done' },
      { id: 's3', parentId: 'pai', status: 'IN_PROGRESS', columnId: 'fazendo' },
      { id: 's4', parentId: 'pai', status: 'NOT_STARTED', columnId: 'fazer' },
    ], columns)

    // 100, 100, 50 e 0 → 63%
    expect(progress.get('pai')).toEqual({ advance: 63, total: 4 })
  })

  test('ignora filhos cancelados e arquivados', () => {
    const progress = subtasksProgressByParent([
      { id: 's1', parentId: 'pai', status: 'DONE', columnId: 'done' },
      { id: 's2', parentId: 'pai', status: 'CANCELLED', columnId: 'fazer' },
      { id: 's3', parentId: 'pai', status: 'ARCHIVED', columnId: 'fazer' },
    ], columns)

    expect(progress.get('pai')).toEqual({ advance: 100, total: 1 })
  })

  test('não cria entrada para pai sem filhos ou só com filhos cancelados', () => {
    const progress = subtasksProgressByParent([
      { id: 'pai', status: 'IN_PROGRESS', columnId: 'fazendo' },
      { id: 's1', parentId: 'outro', status: 'CANCELLED', columnId: 'fazer' },
    ], columns)

    expect(progress.has('pai')).toBe(false)
    expect(progress.has('outro')).toBe(false)
  })

  test('resolve o card virtual de história pelo id real', () => {
    const progress = subtasksProgressByParent([
      { id: 'story-1', status: 'IN_PROGRESS', columnId: 'fazendo' },
      { id: 't1', parentId: 'story-1', status: 'DONE', columnId: 'done' },
      { id: 't2', parentId: 'story-1', status: 'NOT_STARTED', columnId: 'fazer' },
    ], columns)

    expect(progress.get('story-virtual-story-1')).toEqual({ advance: 50, total: 2 })
    expect(progress.get('story-1')).toEqual({ advance: 50, total: 2 })
    expect(progress.get('sem-filhos')).toBeUndefined()
  })

  test('recalcula quando o status de uma subtask muda em tempo real', () => {
    const children = [
      { id: 't1', parentId: 'pai', status: 'NOT_STARTED' as const, columnId: 'fazer' },
      { id: 't2', parentId: 'pai', status: 'NOT_STARTED' as const, columnId: 'fazer' },
    ]

    expect(subtasksProgressByParent(children, columns).get('pai')).toEqual({ advance: 0, total: 2 })

    const updated = children.map(child => child.id === 't1'
      ? { ...child, status: 'DONE' as const, columnId: 'done' }
      : child)
    expect(subtasksProgressByParent(updated, columns).get('pai')).toEqual({ advance: 50, total: 2 })
  })
})
