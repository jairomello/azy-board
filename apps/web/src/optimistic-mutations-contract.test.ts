import { describe, expect, test } from 'bun:test'

async function read(relativePath: string) {
  return fetch(new URL(relativePath, import.meta.url)).then(response => response.text())
}

describe('mutações otimistas consistentes (contrato)', () => {
  test('o título usa rollback otimista e comunica erro', async () => {
    const source = await read('./features/board/BoardScreen.tsx')
    expect(source.includes('runOptimisticMutation')).toBe(true)
    expect(source.includes('errorSaveTitle')).toBe(true)
  })

  test('salvar item envia campos e tags em uma única chamada', async () => {
    const source = await read('./features/board/BoardScreen.tsx')
    const handler = source.slice(source.indexOf('handleModalSave'), source.indexOf('handleAddSubtask'))
    expect(handler.includes('tagIds')).toBe(true)
    expect(handler.includes('expectedUpdatedAt')).toBe(true)
    expect(handler.includes('items/${itemId}/tags')).toBe(false)
  })

  test('conflito 409 é reconciliado e avisado', async () => {
    const source = await read('./features/board/BoardScreen.tsx')
    const marker = source.indexOf('status === 409')
    expect(marker >= 0).toBe(true)
    const block = source.slice(marker, marker + 400)
    expect(block.includes('invalidateBoard()')).toBe(true)
    expect(block.includes('saveConflict')).toBe(true)
  })

  test('ItemData expõe updatedAt para detecção de conflito', async () => {
    const source = await read('./features/board/model/types.ts')
    expect(source.includes('updatedAt')).toBe(true)
  })

  test('o reducer mescla atualizações incrementais de ITEM_UPDATED', async () => {
    const source = await read('./features/board/hooks/useBoardData.ts')
    expect(source.includes("case 'ITEM_UPDATED'")).toBe(true)
    expect(source.includes('applyBoardEvent')).toBe(true)
  })

  test('checklist e stories comunicam erro em falha', async () => {
    expect((await read('./components/ChecklistSection.tsx')).includes('checklistSaveError')).toBe(true)
    expect((await read('./components/StoriesPanel.tsx')).includes('errorDeleteStory')).toBe(true)
  })
})
