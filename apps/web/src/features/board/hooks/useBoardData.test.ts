import { describe, expect, test } from 'bun:test'
import { normalizeBoardItemsResponse } from './useBoardData'
import type { ItemData } from '../model/types'

const items = [{ id: 'item-1', title: 'Item' }] as ItemData[]

describe('normalização da resposta de itens do board', () => {
  test('aceita a resposta paginada da API', () => {
    expect(normalizeBoardItemsResponse({ data: items })).toBe(items)
  })

  test('mantém compatibilidade com respostas em array', () => {
    expect(normalizeBoardItemsResponse(items)).toBe(items)
  })
})
