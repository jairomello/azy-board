import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('contrato do botão copiar referência do card', () => {
  test('KanbanCard expõe o botão, o feedback e a cópia', async () => {
    const card = await source('./components/KanbanCard.tsx')
    for (const expected of [
      'copyItemReference',
      'copiedReference',
      '<Copy',
      '<Check',
      'formatCardReference',
      'copyTextToClipboard',
      'handleCopyReference',
      'stopPropagation',
    ]) {
      expect(card.includes(expected)).toBe(true)
    }
  })

  test('o tooltip deixa claro que copia para a área de transferência', async () => {
    for (const locale of ['pt-BR', 'en', 'es']) {
      const json = JSON.parse(await source(`./i18n/locales/${locale}/board.json`)) as Record<string, string>
      const label = (json.copyItemReference ?? '').toLowerCase()
      const mentionsClipboard = label.includes('clipboard') || label.includes('transferência') || label.includes('portapapeles')
      expect(`${locale}: ${mentionsClipboard}`).toBe(`${locale}: true`)
    }
  })

  test('o helper de clipboard usa navigator.clipboard e fallback', async () => {
    const clipboard = await source('./lib/clipboard.ts')
    expect(clipboard.includes('navigator.clipboard.writeText')).toBe(true)
    expect(clipboard.includes("execCommand('copy')")).toBe(true)
  })

  test('o texto copiado segue o formato [código - ]título [id=uuid]', async () => {
    const reference = await source('./lib/cardReference.ts')
    expect(reference.includes('[id=${card.id}]')).toBe(true)
    // Sem sequenceCode não deve haver código (nem o id curto) no texto.
    expect(reference.includes('slice(0, 8)')).toBe(false)
  })
})
