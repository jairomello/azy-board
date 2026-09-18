import { describe, expect, test } from 'bun:test'
import { getDropColumnId } from './model/interaction'

describe('interação do board', () => {
  test('resolve colunas e áreas de drop sem conhecer a tela', () => {
    const columns = [{ id: 'doing', name: 'Fazendo', baseStatus: 'IN_PROGRESS', position: 0 }]
    expect(getDropColumnId({ active: { id: 'item' }, over: { id: 'lane:drop:doing' } } as never, columns, [])).toBe('doing')
    expect(getDropColumnId({ active: { id: 'item' }, over: { id: 'item-2' } } as never, columns, [{ id: 'item-2', columnId: 'doing' }] as never)).toBe('doing')
  })
})
