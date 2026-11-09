import { describe, expect, test } from 'bun:test'
import { buildTreeParentMap, isTreeDescendant, resolveTreeMove, type TreeMoveNode } from './treeMoveRules'

const moduleNode: TreeMoveNode = { id: 'mod-1', type: 'module', children: [] }

const tree: TreeMoveNode[] = [
  {
    id: 'mod-1', type: 'module', children: [
      {
        id: 'epic-1', type: 'EPIC', moduleId: 'mod-1', children: [
          {
            id: 'story-1', type: 'STORY', parentId: 'epic-1', moduleId: 'mod-1', children: [
              { id: 'task-1', type: 'TASK', parentId: 'story-1', moduleId: 'mod-1', children: [] },
            ],
          },
          { id: 'story-2', type: 'STORY', parentId: 'epic-1', moduleId: 'mod-1', children: [] },
        ],
      },
      {
        id: 'epic-2', type: 'EPIC', moduleId: 'mod-1', children: [
          { id: 'story-3', type: 'STORY', parentId: 'epic-2', moduleId: 'mod-1', children: [] },
        ],
      },
    ],
  },
  { id: 'mod-2', type: 'module', children: [] },
]

const parentOf = buildTreeParentMap(tree)
const node = (id: string): TreeMoveNode => {
  const found: TreeMoveNode[] = []
  const visit = (list: TreeMoveNode[]) => {
    for (const candidate of list) {
      if (candidate.id === id) found.push(candidate)
      visit(candidate.children ?? [])
    }
  }
  visit(tree)
  if (!found[0]) throw new Error(`nó ${id} não encontrado`)
  return found[0]
}

describe('regras de movimento da árvore', () => {
  test('tarefa pode ir para outra história', () => {
    expect(resolveTreeMove(node('task-1'), node('story-2'), parentOf)).toEqual({ parentId: 'story-2', moduleId: 'mod-1' })
  })

  test('tarefa pode virar subtarefa de outra tarefa', () => {
    const task = node('task-1')
    const otherTask: TreeMoveNode = { id: 'task-2', type: 'TASK', parentId: 'story-2', moduleId: 'mod-1' }
    expect(resolveTreeMove(task, otherTask, parentOf)).toEqual({ parentId: 'task-2', moduleId: 'mod-1' })
  })

  test('história pode ir para outro épico', () => {
    expect(resolveTreeMove(node('story-2'), node('epic-2'), parentOf)).toEqual({ parentId: 'epic-2', moduleId: 'mod-1' })
  })

  test('épico pode ir para outro módulo', () => {
    expect(resolveTreeMove(node('epic-2'), node('mod-2'), parentOf)).toEqual({ moduleId: 'mod-2' })
  })

  test('história não pode virar filha de história', () => {
    expect(resolveTreeMove(node('story-2'), node('story-1'), parentOf)).toBeNull()
  })

  test('tarefa não pode ficar sob épico ou módulo', () => {
    expect(resolveTreeMove(node('task-1'), node('epic-2'), parentOf)).toBeNull()
    expect(resolveTreeMove(node('task-1'), node('mod-2'), parentOf)).toBeNull()
  })

  test('épico não pode virar filho de épico nem de história', () => {
    expect(resolveTreeMove(node('epic-2'), node('epic-1'), parentOf)).toBeNull()
    expect(resolveTreeMove(node('epic-2'), node('story-1'), parentOf)).toBeNull()
  })

  test('módulo não se move', () => {
    expect(resolveTreeMove(moduleNode, node('mod-2'), parentOf)).toBeNull()
    expect(resolveTreeMove(node('mod-2'), node('mod-1'), parentOf)).toBeNull()
  })

  test('recusa soltar no próprio descendente (ciclo)', () => {
    expect(resolveTreeMove(node('story-1'), node('task-1'), parentOf)).toBeNull()
    expect(isTreeDescendant('task-1', 'story-1', parentOf)).toBe(true)
  })

  test('soltar no mesmo pai é no-op', () => {
    expect(resolveTreeMove(node('task-1'), node('story-1'), parentOf)).toBeNull()
    expect(resolveTreeMove(node('epic-1'), node('mod-1'), parentOf)).toBeNull()
  })
})
