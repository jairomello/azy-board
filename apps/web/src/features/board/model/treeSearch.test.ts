import { describe, expect, test } from 'bun:test'
import { filterTreeBySearch, type TreeSearchNode } from './treeSearch'

function task(id: string, title: string, overrides: Partial<TreeSearchNode> = {}): TreeSearchNode {
  return { id, title, type: 'TASK', sequenceCode: id.toUpperCase(), children: [], ...overrides }
}

function story(id: string, title: string, children: TreeSearchNode[]): TreeSearchNode {
  return { id, title, type: 'STORY', children }
}

function epic(id: string, title: string, children: TreeSearchNode[]): TreeSearchNode {
  return { id, title, type: 'EPIC', children }
}

describe('filterTreeBySearch', () => {
  const tree = [
    epic('e1', 'Fase 1', [
      story('s1', 'Fluxo contínuo', [
        task('t1', 'Busca de cards no board', { sequenceCode: 'T92', assignee: { name: 'Jairo Silva' } }),
        task('t2', 'Ajuste de layout', { sequenceCode: 'T93' }),
      ]),
      story('s2', 'Outra história', [
        task('t3', 'Correção de bug', { sequenceCode: 'B1' }),
      ]),
    ]),
  ]

  test('consulta vazia preserva a árvore', () => {
    expect(filterTreeBySearch(tree, '   ')).toBe(tree)
  })

  test('mantém ancestrais do card encontrado e remove ramos sem match', () => {
    const result = filterTreeBySearch(tree, 'busca')
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('e1')
    expect(result[0]!.children).toHaveLength(1)
    expect(result[0]!.children![0]!.id).toBe('s1')
    expect(result[0]!.children![0]!.children!.map(node => node.id)).toEqual(['t1'])
  })

  test('casa por código e por responsável', () => {
    expect(filterTreeBySearch(tree, 'B1')[0]!.children![0]!.children!.map(node => node.id)).toEqual(['t3'])
    expect(filterTreeBySearch(tree, 'jairo')[0]!.children![0]!.children!.map(node => node.id)).toEqual(['t1'])
  })

  test('não casa pelo título de história/épico, só por cards', () => {
    expect(filterTreeBySearch(tree, 'Fluxo contínuo')).toEqual([])
  })

  test('quando o card casa, preserva o ramo abaixo dele', () => {
    const parent = task('t4', 'Busca pai', {
      children: [task('t5', 'Filho sem termo'), task('t6', 'Outro filho')],
    })
    const result = filterTreeBySearch([epic('e2', 'Fase 2', [story('s3', 'História', [parent])])], 'busca pai')
    const kept = result[0]!.children![0]!.children![0]!
    expect(kept.id).toBe('t4')
    expect(kept.children!.map(node => node.id)).toEqual(['t5', 't6'])
  })

  test('não muta a árvore original', () => {
    const before = JSON.stringify(tree)
    filterTreeBySearch(tree, 'busca')
    expect(JSON.stringify(tree)).toBe(before)
  })
})
