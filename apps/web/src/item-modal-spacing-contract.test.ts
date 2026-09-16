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
