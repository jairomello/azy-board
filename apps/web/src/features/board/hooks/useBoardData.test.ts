import { describe, expect, test } from 'bun:test'
import { loadAllBoardItems, normalizeBoardItemsResponse } from './useBoardData'
import type { ItemData } from '../model/types'

const items = [{ id: 'item-1', title: 'Item' }] as ItemData[]

describe('normalização da resposta de itens do board', () => {
  test('aceita a resposta paginada da API', () => {
    expect(normalizeBoardItemsResponse({ data: items })).toBe(items)
  })

  test('mantém compatibilidade com respostas em array', () => {
    expect(normalizeBoardItemsResponse(items)).toBe(items)
  })

  test('carrega e concatena todas as páginas mantendo a ordem da API', async () => {
    const secondPage = [{ id: 'item-2', title: 'Segundo' }] as ItemData[]
    const cursors: Array<string | undefined> = []
    const allItems = await loadAllBoardItems(async (cursor) => {
      cursors.push(cursor)
      if (!cursor) return { data: items, hasMore: true, nextCursor: 'cursor/2' }
      return { data: secondPage, hasMore: false, nextCursor: null }
    })

    expect(cursors).toEqual([undefined, 'cursor/2'])
    expect(allItems).toEqual([...items, ...secondPage])
  })

  test('rejeita uma página que declara continuação sem cursor', async () => {
    await expect(loadAllBoardItems(async () => ({ data: items, hasMore: true })))
      .rejects.toThrow('não retornou o próximo cursor')
  })
})
