import { describe, expect, test } from 'bun:test'
import { makeApiCall, ApiError } from './index.js'

describe('MCP API adapter', () => {
  test('converte JSON inválido em ApiError sem expor parser ou corpo', async () => {
    const api = await makeApiCall('http://mcp-test.invalid', 'test-key')
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response('{invalid', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch
    try {
      await expect(api('/projects')).rejects.toBeInstanceOf(ApiError)
      await expect(api('/projects')).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE', retryable: true })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('converte timeout de rede em erro retryable', async () => {
    const api = await makeApiCall('http://mcp-test.invalid', 'test-key', { timeoutMs: 5 })
    const originalFetch = globalThis.fetch
    globalThis.fetch = ((_: string, init?: RequestInit) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })) as unknown as typeof fetch
    try {
      await expect(api('/projects')).rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
