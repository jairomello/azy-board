import { describe, expect, test } from 'bun:test'
import { computeIsLeaf, getEpicIdFromPath, getStoryIdFromPath } from './model/types'

describe('composição hierárquica do board', () => {
  test('preserva somente cards folha quando a árvore é calculada', () => {
    const items = [
      { id: 'task-1', type: 'TASK', parentId: null, isLeaf: true },
      { id: 'task-2', type: 'TASK', parentId: 'task-1', isLeaf: true },
    ] as never[]
    const result = computeIsLeaf(items as never)
    expect(result.find(item => item.id === 'task-1')?.isLeaf).toBe(false)
    expect(result.find(item => item.id === 'task-2')?.isLeaf).toBe(true)
  })

  test('resolve épico e história da lane pelo ancestryPath', () => {
    const path = JSON.stringify([
      { id: 'epic-1', title: 'Épico', type: 'EPIC' },
      { id: 'story-1', title: 'Story', type: 'STORY' },
    ])
    expect(getEpicIdFromPath(path)).toBe('epic-1')
    expect(getStoryIdFromPath(path)).toBe('story-1')
  })
})
