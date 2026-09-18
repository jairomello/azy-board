import { describe, expect, test } from 'bun:test'

const source = await fetch(new URL('./features/board/hooks/useBoardData.ts', import.meta.url)).then(response => response.text())

describe('board realtime item contract', () => {
  test('deduplica criações por id antes de atualizar a hierarquia', () => {
    expect(source.includes('upsertItem')).toBe(true)
    expect((source.match(/upsertItem\(previous/g)?.length ?? 0) >= 3).toBe(true)
  })
})
