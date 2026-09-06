import { describe, expect, test } from 'bun:test'

const source = await fetch(new URL('./pages/BoardPage.tsx', import.meta.url)).then(response => response.text())

describe('board realtime item contract', () => {
  test('deduplica criações por id antes de atualizar a hierarquia', () => {
    expect(source.includes('allItems.filter(existing => existing.id !== item.id)')).toBe(true)
    expect((source.match(/upsertItem\(prev/g)?.length ?? 0) >= 3).toBe(true)
  })
})
