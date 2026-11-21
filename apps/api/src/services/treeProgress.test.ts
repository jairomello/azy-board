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

  test('checklist não altera o progresso da folha', () => {
    const withChecklist = addTreeProgress(
      [leaf({ id: 't2', type: 'TASK', status: 'IN_PROGRESS', columnId: 'fazendo' })],
      context,
    )
    // "Fazendo" vale 50; o checklist tem barra própria e não refina a árvore.
    expect(withChecklist[0]?.progress).toBe(50)
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

  test('item sem coluna conhecida usa o status (B19)', () => {
    const [done] = addTreeProgress([leaf({ id: 'n1', type: 'TASK', status: 'DONE' })], context)
    const [doing] = addTreeProgress([leaf({ id: 'n2', type: 'TASK', status: 'IN_PROGRESS' })], context)
    const [todo] = addTreeProgress([leaf({ id: 'n3', type: 'TASK', status: 'NOT_STARTED' })], context)
    expect(done?.progress).toBe(100)
    // Sem coluna: a faixa da primeira coluna em andamento ("Fazendo" = 50).
    expect(doing?.progress).toBe(50)
    expect(todo?.progress).toBe(0)
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

  // B19 — o status manda, cancelado fica fora e qualquer item sem filhos conta.
  describe('regra por status (B19)', () => {
    test('concluído parado no Backlog vale 100, e não 0', () => {
      const [task] = addTreeProgress([leaf({ id: 'd1', type: 'TASK', status: 'DONE', columnId: 'backlog' })], context)
      expect(task?.progress).toBe(100)
    })

    test('cancelado exibe "—" e não entra no denominador do pai', () => {
      const [story] = addTreeProgress<TreeProgressNode>([{
        type: 'STORY', isLeaf: false, children: [
          leaf({ id: 'c1', type: 'TASK', status: 'DONE', columnId: 'done' }),
          leaf({ id: 'c2', type: 'TASK', status: 'CANCELLED', columnId: 'backlog' }),
        ],
      }], context)
      expect(story?.progress).toBe(100)
      expect(story?.children?.[1]?.progress).toBeNull()
    })

    test('agrupador só com cancelados exibe "—"', () => {
      const [story] = addTreeProgress<TreeProgressNode>([{
        type: 'STORY', isLeaf: false, children: [leaf({ id: 'x', type: 'TASK', status: 'CANCELLED', columnId: 'backlog' })],
      }], context)
      expect(story?.progress).toBeNull()
    })

    test('story e epic sem filhos contam pelo próprio status', () => {
      const [epic] = addTreeProgress<TreeProgressNode>([{
        id: 'e1', type: 'EPIC', isLeaf: false, status: 'IN_PROGRESS', children: [
          { id: 's1', type: 'STORY', isLeaf: true, status: 'DONE', columnId: 'backlog', children: [] },
          { id: 's2', type: 'STORY', isLeaf: false, children: [leaf({ id: 't1', type: 'TASK', status: 'NOT_STARTED', columnId: 'backlog' })] },
        ],
      }], context)
      expect(epic?.children?.[0]?.progress).toBe(100)
      // 100 (story sem filhos) e 0 (task) → 50%
      expect(epic?.progress).toBe(50)
    })

    test('dependência externa exibe "—" e não pesa no pai', () => {
      const [story] = addTreeProgress<TreeProgressNode>([{
        type: 'STORY', isLeaf: false, children: [
          leaf({ id: 'k1', type: 'TASK', status: 'NOT_STARTED', columnId: 'backlog' }),
          { id: 'x1', type: 'EXTERNAL', isLeaf: true, status: 'DONE', columnId: 'done', children: [] },
        ],
      }], context)
      expect(story?.children?.[1]?.progress).toBeNull()
      expect(story?.progress).toBe(0)
    })

    test('a STORY fixa do modo SIMPLE é contêiner mesmo vazia', () => {
      const [fixed] = addTreeProgress<TreeProgressNode>([{ id: 'fixa', type: 'STORY', isLeaf: false, status: 'DONE', children: [] }], {
        ...context, containerIds: new Set(['fixa']),
      })
      expect(fixed?.progress).toBe(0)
    })

    test('o pai é a média ponderada pelo número de itens das filhas', () => {
      // Filha A: 1 item com 100. Filha B: 3 itens com 0. Ponderado = 25 (simples daria 50).
      const [epic] = addTreeProgress<TreeProgressNode>([{
        type: 'EPIC', isLeaf: false, children: [
          { type: 'STORY', isLeaf: false, children: [leaf({ id: 'a1', type: 'TASK', status: 'DONE', columnId: 'done' })] },
          { type: 'STORY', isLeaf: false, children: [
            leaf({ id: 'b1', type: 'TASK', status: 'NOT_STARTED', columnId: 'backlog' }),
            leaf({ id: 'b2', type: 'TASK', status: 'NOT_STARTED', columnId: 'backlog' }),
            leaf({ id: 'b3', type: 'TASK', status: 'NOT_STARTED', columnId: 'backlog' }),
          ] },
        ],
      }], context)
      expect(epic?.progress).toBe(25)
    })

    test('pontos do agrupador ignoram cancelados', () => {
      const [story] = addTreeProgress<TreeProgressNode>([{
        type: 'STORY', isLeaf: false, children: [
          leaf({ id: 'p1', type: 'TASK', status: 'DONE', columnId: 'done', points: 3 }),
          leaf({ id: 'p2', type: 'TASK', status: 'CANCELLED', columnId: 'backlog', points: 5 }),
        ],
      }], context)
      expect(story?.points).toBe(3)
    })
  })
})
