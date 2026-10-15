import { describe, expect, test } from 'bun:test'
import { api } from './api'

async function withFetch(mock: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch
  globalThis.fetch = mock
  try {
    await run()
  } finally {
    globalThis.fetch = original
  }
}

describe('métodos de ajuda no cliente api', () => {
  test('busca o índice de tópicos com cookie de sessão', async () => {
    let capturedUrl = ''
    let capturedInit: RequestInit | undefined
    const mock = ((input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedInit = init
      return Promise.resolve(new Response(JSON.stringify({ version: 'v', home: null, modules: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    }) as typeof fetch

    await withFetch(mock, async () => {
      const index = await api.help.index()
      expect(index.version).toBe('v')
    })
    expect(capturedUrl).toContain('/help/index')
    expect(capturedInit?.credentials).toBe('include')
  })

  test('busca a página codificando o slug', async () => {
    let capturedUrl = ''
    const mock = ((input: RequestInfo | URL) => {
      capturedUrl = String(input)
      return Promise.resolve(new Response(JSON.stringify({ slug: 'home', markdown: '# Azy Board' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    }) as typeof fetch

    await withFetch(mock, async () => {
      const page = await api.help.page('04-conhecer-o-board')
      expect(page.markdown).toContain('Azy Board')
    })
    expect(capturedUrl).toContain('/help/pages/04-conhecer-o-board')
  })

  test('propaga erro da API como ApiError', async () => {
    const mock = (() => Promise.resolve(new Response(JSON.stringify({
      error: { code: 'HELP_PAGE_NOT_FOUND', message: 'Página de ajuda não encontrada', retryable: false, details: null },
    }), { status: 404, headers: { 'Content-Type': 'application/json' } }))) as typeof fetch

    await withFetch(mock, async () => {
      let caught: unknown
      try {
        await api.help.page('inexistente')
      } catch (error) {
        caught = error
      }
      expect((caught as { code?: string })?.code).toBe('HELP_PAGE_NOT_FOUND')
    })
  })
})
