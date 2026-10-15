import { describe, expect, test } from 'bun:test'
import { addTreeProgress, type TreeProgressContext, type TreeProgressNode } from './treeProgress'

// Colunas de um projeto com duas etapas em progresso: "Fazendo" 50 e "A Testar" 90.
const context: TreeProgressContext = {
  columns: [
    { id: 'backlog', baseStatus: 'NOT_STARTED', position: 0 },
    { id: 'fazendo', baseStatus: 'IN_PROGRESS', position: 1 },
    { id: 'testar', baseStatus: 'IN_PROGRESS', position: 2 },
    { id: 'done', baseStatus: 'DONE', position: 3 },
  ],
}

const leaf = (overrides: Partial<TreeProgressNode> & { type: string }): TreeProgressNode =>
  ({ id: `leaf-${Math.random()}`, isLeaf: true, children: [], ...overrides })

describe('progresso da árvore', () => {
  test('folha concluída exibe 100%', () => {
    const [task] = addTreeProgress([leaf({ id: 't1', type: 'TASK', status: 'DONE', columnId: 'done' })], context)
    expect(task?.progress).toBe(100)
  })

  test('bug em coluna de trabalho não iniciado exibe 0%', () => {
    const [bug] = addTreeProgress([leaf({ id: 'b1', type: 'BUG', status: 'NOT_STARTED', columnId: 'backlog' })], context)
    expect(bug?.progress).toBe(0)
  })

  test('bug em progresso exibe o avanço da coluna, e não 0%', () => {
    const [bug] = addTreeProgress([leaf({ id: 'b2', type: 'BUG', status: 'IN_PROGRESS', columnId: 'testar' })], context)
    expect(bug?.progress).toBe(90)
  })

  test('checklist afina dentro da faixa da coluna', () => {
    const withChecklist = addTreeProgress(
      [leaf({ id: 't2', type: 'TASK', status: 'IN_PROGRESS', columnId: 'fazendo' })],
      { ...context, progressByItem: new Map([['t2', { checked: 3, total: 6 }]]) },
    )
    // "Fazendo" tem faixa 0→50; metade do checklist → 25%.
    expect(withChecklist[0]?.progress).toBe(25)
  })

  test('agrega folhas em qualquer profundidade e calcula a média do avanço', () => {
    const [story] = addTreeProgress([{
      type: 'STORY', isLeaf: false, children: [
        leaf({ id: 's1', type: 'TASK', status: 'DONE', columnId: 'done' }),
        leaf({ id: 's2', type: 'TASK', status: 'NOT_STARTED', columnId: 'backlog' }),
        { id: 'parent', type: 'TASK', isLeaf: false, children: [leaf({ id: 's3', type: 'BUG', status: 'DONE', columnId: 'done' })] },
      ],
    }], context)
    // 100, 0 e 100 → 67%
    expect(story?.progress).toBe(67)
  })

  test('agrupador com duas folhas concluídas e duas em 50% exibe 75%', () => {
    const [story] = addTreeProgress([{
      type: 'STORY', isLeaf: false, children: [
        leaf({ id: 'a', type: 'TASK', status: 'DONE', columnId: 'done' }),
        leaf({ id: 'b', type: 'TASK', status: 'DONE', columnId: 'done' }),
        leaf({ id: 'c', type: 'TASK', status: 'IN_PROGRESS', columnId: 'fazendo' }),
        leaf({ id: 'd', type: 'TASK', status: 'IN_PROGRESS', columnId: 'fazendo' }),
      ],
    }], context)
    expect(story?.progress).toBe(75)
  })

  test('agrupador sem folhas exibe 0%', () => {
    const [empty] = addTreeProgress([{ type: 'EPIC', isLeaf: false, children: [] }], context)
    expect(empty?.progress).toBe(0)
  })

  test('item sem coluna conhecida cai na regra de conclusão', () => {
    const [done] = addTreeProgress([leaf({ id: 'n1', type: 'TASK', status: 'DONE' })], context)
    const [doing] = addTreeProgress([leaf({ id: 'n2', type: 'TASK', status: 'IN_PROGRESS' })], context)
    expect(done?.progress).toBe(100)
    expect(doing?.progress).toBe(0)
  })

  test('sem colunas informadas o cálculo continua válido', () => {
    const [task] = addTreeProgress([leaf({ id: 'x1', type: 'TASK', status: 'DONE' })])
    expect(task?.progress).toBe(100)
  })

  test('respeita o peso explícito da coluna', () => {
    const withOverride: TreeProgressContext = {
      columns: [
        { id: 'testar', baseStatus: 'IN_PROGRESS', position: 0, progressWeight: 80 },
        { id: 'done', baseStatus: 'DONE', position: 1 },
      ],
    }
    const [bug] = addTreeProgress([leaf({ id: 'o1', type: 'BUG', status: 'IN_PROGRESS', columnId: 'testar' })], withOverride)
    expect(bug?.progress).toBe(80)
  })
})
