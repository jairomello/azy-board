import { describe, expect, test } from 'bun:test'
import type { Tag } from '../../../components/TagSelector'
import type { ItemData } from './types'
import { hydrateItemTags } from './boardTags'

const tags: Tag[] = [
  { id: 'tag-1', name: 'frontend', color: '#3b82f6' },
  { id: 'tag-2', name: 'urgente', color: '#ef4444' },
]

function item(overrides: Record<string, unknown>): ItemData {
  return { id: 'item-1', type: 'TASK', title: 'T', ...overrides } as unknown as ItemData
}

describe('hydrateItemTags', () => {
  test('reconstrói itemTags a partir de tagIds usando o catálogo do projeto', () => {
    const [result] = hydrateItemTags([item({ tagIds: ['tag-1', 'tag-2'] })], tags)
    expect(result!.itemTags).toEqual([{ tag: tags[0] }, { tag: tags[1] }])
  })

  test('ignora ids desconhecidos e preserva o item sem tags', () => {
    const [result] = hydrateItemTags([item({ tagIds: ['desconhecida'] })], tags)
    expect(result!.itemTags).toBeUndefined()
  })

  test('sem catálogo retorna os itens inalterados', () => {
    const original = item({ tagIds: ['tag-1'] })
    expect(hydrateItemTags([original], [])[0]).toBe(original)
  })

  test('item sem tagIds permanece inalterado', () => {
    const original = item({})
    expect(hydrateItemTags([original], tags)[0]).toBe(original)
  })
})
