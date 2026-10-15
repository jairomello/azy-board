// [CONTRATO-ESTRUTURAL] T77 — exibição e edição de tokens de IA no card e no modal.
// O happy-dom não cobre o fluxo completo de save; a cobertura de integração vive
// nos testes da API (POST /items/tokens e PATCH do item) e no formatters.test.ts.
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('contrato de exibição de tokens (T77)', () => {
  test('ItemModal oferece campos de entrada/saída, total derivado e leitura para VIEWER', async () => {
    const modal = await source('./components/ItemModal.tsx')
    expect(modal.includes("t('tokensInputLabel')")).toBe(true)
    expect(modal.includes("t('tokensOutputLabel')")).toBe(true)
    expect(modal.includes('tokensTotalPreview')).toBe(true)
    expect(modal.includes("disabled={currentUserRole === 'VIEWER'}")).toBe(true)
    expect(modal.includes('tokensInput: tokensInput ? parseInt(tokensInput, 10) : null')).toBe(true)
    expect(modal.includes('tokensOutput: tokensOutput ? parseInt(tokensOutput, 10) : null')).toBe(true)
  })

  test('o total derivado é nulo quando os dois campos estão vazios', async () => {
    const modal = await source('./components/ItemModal.tsx')
    expect(modal.includes("tokensInput.trim() === '' && tokensOutput.trim() === ''")).toBe(true)
  })
})
