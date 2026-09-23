// [CONTRATO-ESTRUTURAL] layout CSS (altura/rolagem); o happy-dom não calcula layout.
// A cobertura comportamental equivalente deve migrar para testes de componente/E2E.
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('contrato de altura fixa das modais de item', () => {
  test('a classe de altura fixa usa viewport dinâmica com fallback', async () => {
    const css = await source('./styles/globals.css')
    const frame = css.indexOf('.item-modal-frame')
    expect(frame > -1).toBe(true)
    const block = css.slice(frame, css.indexOf('}', frame))
    expect(block.includes('height: 80vh')).toBe(true)
    expect(block.includes('height: 80dvh')).toBe(true)
  })

  test('ItemModal usa altura fixa e não o teto variável', async () => {
    const item = await source('./components/ItemModal.tsx')
    expect(item.includes('item-modal-frame')).toBe(true)
    expect(item.includes('max-h-[95vh]')).toBe(false)
    expect(item.includes('flex-1 overflow-y-auto')).toBe(true)
    expect(item.includes('shrink-0')).toBe(true)
  })

  test('ItemDetailModalShell usa altura fixa e rola apenas o conteúdo', async () => {
    const shell = await source('./components/ItemDetailModalShell.tsx')
    expect(shell.includes('item-modal-frame')).toBe(true)
    expect(shell.includes('max-h-[95vh]')).toBe(false)
    const content = shell.indexOf('min-h-0 flex-1 overflow-y-auto')
    const header = shell.indexOf('flex shrink-0 items-start')
    const tabs = shell.indexOf('flex shrink-0 gap-1 overflow-x-auto')
    const footer = shell.indexOf('flex shrink-0 flex-col-reverse')
    expect(content > -1).toBe(true)
    expect(header > -1).toBe(true)
    expect(tabs > -1).toBe(true)
    expect(footer > content).toBe(true)
  })
})
