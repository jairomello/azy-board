import { describe, expect, test } from 'bun:test'
import { addTreeProgress } from './treeProgress'

describe('progresso da árvore', () => {
  test('calcula folhas TASK/BUG', () => {
    const [task] = addTreeProgress([{ type: 'TASK', status: 'DONE', isLeaf: true, children: [] }])
    const [bug] = addTreeProgress([{ type: 'BUG', status: 'IN_PROGRESS', isLeaf: true, children: [] }])
    expect(task?.progress).toBe(100)
    expect(bug?.progress).toBe(0)
  })

  test('agrega folhas em qualquer profundidade e retorna zero sem folhas', () => {
    const [story] = addTreeProgress([{
      type: 'STORY', isLeaf: false, children: [
        { type: 'TASK', status: 'DONE', isLeaf: true, children: [] },
        { type: 'TASK', status: 'NOT_STARTED', isLeaf: true, children: [] },
        { type: 'TASK', isLeaf: false, children: [{ type: 'BUG', status: 'DONE', isLeaf: true, children: [] }] },
      ],
    }])
    expect(story?.progress).toBe(67)
    const [empty] = addTreeProgress([{ type: 'EPIC', isLeaf: false, children: [] }])
    expect(empty?.progress).toBe(0)
  })
})
