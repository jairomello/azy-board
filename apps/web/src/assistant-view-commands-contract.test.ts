// [CONTRATO-ESTRUTURAL] wiring dos comandos de interface (card T17): drawer → store
// → BoardScreen e paridade i18n; a cobertura comportamental do store está em
// assistantViewStore.test.ts.
import { describe, expect, test } from 'bun:test'

async function source(path: string) {
  return fetch(new URL(path, import.meta.url)).then(response => response.text())
}

describe('contrato dos comandos de interface (card T17)', () => {
  test('o drawer aplica o comando recebido no evento do run', async () => {
    const drawer = await source('./components/AzyAgentDrawer.tsx')
    expect(drawer.includes('receiveViewCommand')).toBe(true)
    expect(drawer.includes('data.command')).toBe(true)
    expect(drawer.includes('viewCommandFailed')).toBe(true)
  })

  test('o BoardScreen assina as mudanças e publica o baseline da visão', async () => {
    const board = await source('./features/board/hooks/useBoardAgentSession.ts')
    expect(board.includes('subscribeViewSession')).toBe(true)
    expect(board.includes('syncCurrentViewSession')).toBe(true)
    expect(board.includes('setFilters(session.filters)')).toBe(true)
    expect(board.includes('setView(session.mode)')).toBe(true)
    expect(board.includes('setItemModalId(session.openItemId)')).toBe(true)
  })

  test('o store usa sessionStorage e nunca acessa localStorage', async () => {
    const store = await source('./lib/assistantViewStore.ts')
    expect(store.includes('sessionStorage')).toBe(true)
    expect(/localStorage\s*\./.test(store)).toBe(false)
  })

  test('o rótulo de falha do comando existe nos três locales', async () => {
    for (const locale of ['pt-BR', 'en', 'es']) {
      const json = JSON.parse(await source(`./i18n/locales/${locale}/assistant.json`)) as Record<string, string>
      expect(`${locale}: ${typeof json.viewCommandFailed === 'string'}`).toBe(`${locale}: true`)
    }
  })
})
