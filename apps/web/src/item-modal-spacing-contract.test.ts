import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('contrato estrutural do layout da ItemModal', () => {
  test('organiza conteúdo e propriedades em modal amplo responsivo', async () => {
    const text = await source('./components/ItemModal.tsx')
    const modal = text.indexOf('max-w-[1120px]')
    const tabs = text.indexOf('role="tablist"')
    const panel = text.indexOf('<aside')
    const details = text.indexOf("activeArea === 'details'")

    expect(modal > -1).toBe(true)
    expect(tabs > modal).toBe(true)
    expect(panel > tabs).toBe(true)
    expect(details > -1).toBe(true)
    expect(text.includes('lg:grid-cols-[minmax(0,1fr)_320px]')).toBe(true)
    expect(text.includes('overflow-x-auto')).toBe(true)
  })

  test('título editável ocupa a largura disponível e herda o tamanho do cabeçalho', async () => {
    const item = await source('./components/ItemModal.tsx')
    const header = await source('./components/ItemDetailHeader.tsx')
    const inline = await source('./components/InlineEdit.tsx')
    const card = await source('./components/KanbanCard.tsx')

    // A coluna do título cresce (flex-1) em vez de encolher para o conteúdo.
    expect(item.includes('min-w-0 flex-1 items-start gap-2')).toBe(true)
    expect(item.includes('min-w-0 flex-1"><h2 id="item-modal-title"')).toBe(true)
    expect(header.includes('min-w-0 flex-1 items-start gap-2')).toBe(true)
    // O InlineEdit não fixa mais o tamanho da fonte: herda o h2 (text-base sm:text-lg).
    expect(inline.includes('text-sm')).toBe(false)
    // O card do Kanban mantém o tamanho compacto explicitamente.
    expect(card.includes('className="text-sm"')).toBe(true)
  })

  test('preserva controles, payload e edição rica do item', async () => {
    const text = await source('./components/ItemModal.tsx')
    expect(text.includes('value={parentId}')).toBe(true)
    expect(text.includes('selectedTags.map(t => t.id)')).toBe(true)
    expect(text.includes('startDate: startDate || null')).toBe(true)
    expect(text.includes('dueDate: dueDate || null')).toBe(true)
    expect(text.includes('<RichTextEditor')).toBe(true)
    expect(text.includes('onClose()')).toBe(true)
  })
})
