import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('contrato estrutural do espaçamento da ItemModal', () => {
  test('mantém os grupos após Datas em um fluxo vertical espaçado', async () => {
    const text = await source('./components/ItemModal.tsx')
    const fields = text.indexOf('<div className="space-y-4">')
    const dates = text.indexOf("t('startDate')")
    const parent = text.indexOf("t('parentStory')")
    const tags = text.indexOf("t('tagsLabel')")

    expect(fields > -1).toBe(true)
    expect(dates > fields).toBe(true)
    expect(parent > dates).toBe(true)
    expect(tags > parent).toBe(true)
    expect(text.slice(fields, tags).includes('<div className="grid grid-cols-2 gap-4">')).toBe(true)
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
