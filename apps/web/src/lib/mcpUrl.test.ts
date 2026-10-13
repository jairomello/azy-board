import { afterEach, describe, expect, test } from 'bun:test'
import { resolveMcpUrl } from './mcpUrl'

const globalWithWindow = globalThis as unknown as {
  window?: { location?: { origin?: string }; __BASE_PATH__?: string } | undefined
}

// Este arquivo é de lógica pura: não registra o DOM do happy-dom, então o caso
// "sem `window`" é o estado natural do processo. Cada teste define o `window`
// que precisa e o `afterEach` restaura o estado inicial.
const windowOriginal = globalWithWindow.window

afterEach(() => {
  globalWithWindow.window = windowOriginal
})

describe('resolveMcpUrl', () => {
  test('monta a URL do MCP na raiz da instalação', () => {
    globalWithWindow.window = { location: { origin: 'https://board.exemplo.com' } }
    expect(resolveMcpUrl()).toBe('https://board.exemplo.com/mcp')
  })

  test('inclui o base path sem duplicar a barra final', () => {
    globalWithWindow.window = { __BASE_PATH__: '/azyboard/', location: { origin: 'https://host' } }
    expect(resolveMcpUrl()).toBe('https://host/azyboard/mcp')

    globalWithWindow.window = { __BASE_PATH__: '/azyboard', location: { origin: 'https://host' } }
    expect(resolveMcpUrl()).toBe('https://host/azyboard/mcp')
  })

  test('tolera ambiente sem window (testes/SSR)', () => {
    globalWithWindow.window = undefined
    expect(resolveMcpUrl()).toBe('/mcp')
  })

  test('tolera window sem location', () => {
    globalWithWindow.window = {}
    expect(resolveMcpUrl()).toBe('/mcp')
  })
})
