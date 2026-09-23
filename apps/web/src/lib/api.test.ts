import { describe, expect, test } from 'bun:test'
import { ApiError, api, isAbortError } from './api'

async function withFetch(mock: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch
  globalThis.fetch = mock
  try {
    await run()
  } finally {
    globalThis.fetch = original
  }
}

describe('cancelamento no cliente api', () => {
  test('repassa o AbortSignal e propaga AbortError sem virar ApiError', async () => {
    const mock = ((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    }) as typeof fetch

    await withFetch(mock, async () => {
      const controller = new AbortController()
      const pending = api.get('/projects/p/items', { signal: controller.signal })
      controller.abort()
      let caught: unknown
      try {
        await pending
      } catch (error) {
        caught = error
      }
      expect(isAbortError(caught)).toBe(true)
      expect(caught instanceof ApiError).toBe(false)
    })
  })
})

describe('transporte do cliente api', () => {
  test('envia corpo JSON em DELETE com cookie de sessão', async () => {
    let captured: RequestInit | undefined
    const mock = ((_input: RequestInfo | URL, init?: RequestInit) => {
      captured = init
      return Promise.resolve(new Response(null, { status: 204 }))
    }) as typeof fetch

    await withFetch(mock, async () => {
      await api.delete('/projects/p/columns/c', { moveToColumnId: 'dest' })
    })

    expect(captured?.method).toBe('DELETE')
    expect(captured?.body).toBe(JSON.stringify({ moveToColumnId: 'dest' }))
    const capturedHeaders = (captured?.headers ?? {}) as Record<string, string>
    expect(capturedHeaders['Content-Type']).toBe('application/json')
    expect(captured?.credentials).toBe('include')
  })

  test('DELETE sem corpo não envia body', async () => {
    let captured: RequestInit | undefined
    const mock = ((_input: RequestInfo | URL, init?: RequestInit) => {
      captured = init
      return Promise.resolve(new Response(null, { status: 204 }))
    }) as typeof fetch

    await withFetch(mock, async () => {
      await api.delete('/projects/p/modules/m')
    })

    expect(captured?.method).toBe('DELETE')
    expect(captured?.body).toBe(undefined)
  })
})

describe('erros e retry do cliente api', () => {
  test('preserva code, details e retryable do envelope em ApiError', async () => {
    const mock = (() => Promise.resolve(new Response(
      JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'devagar', retryable: true, details: { retryAfter: 1 } } }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    ))) as typeof fetch

    await withFetch(mock, async () => {
      let caught: unknown
      try {
        await api.post('/x', {})
      } catch (error) {
        caught = error
      }
      expect(caught instanceof ApiError).toBe(true)
      const apiError = caught as ApiError
      expect(apiError.status).toBe(429)
      expect(apiError.code).toBe('RATE_LIMITED')
      expect(apiError.retryable).toBe(true)
      expect(apiError.details).toEqual({ retryAfter: 1 })
    })
  })

  test('aborta por timeout e lança ApiError identificável como TIMEOUT', async () => {
    const mock = ((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new DOMException('Aborted', 'AbortError')))
      })
    }) as typeof fetch

    await withFetch(mock, async () => {
      let caught: unknown
      try {
        await api.post('/x', {}, { timeoutMs: 10 })
      } catch (error) {
        caught = error
      }
      expect(caught instanceof ApiError).toBe(true)
      expect((caught as ApiError).code).toBe('TIMEOUT')
      expect((caught as ApiError).retryable).toBe(true)
    })
  })

  test('repete GET idempotente com retryable e para no primeiro sucesso', async () => {
    let calls = 0
    const mock = (() => {
      calls += 1
      if (calls === 1) {
        return Promise.resolve(new Response(
          JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'x', retryable: true, details: null } }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        ))
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    }) as typeof fetch

    await withFetch(mock, async () => {
      const result = await api.get<{ ok: boolean }>('/x')
      expect(calls).toBe(2)
      expect(result.ok).toBe(true)
    })
  })

  test('não repete POST mesmo com retryable', async () => {
    let calls = 0
    const mock = (() => {
      calls += 1
      return Promise.resolve(new Response(
        JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'x', retryable: true, details: null } }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ))
    }) as typeof fetch

    await withFetch(mock, async () => {
      let caught: unknown
      try {
        await api.post('/x', {})
      } catch (error) {
        caught = error
      }
      expect(calls).toBe(1)
      expect(caught instanceof ApiError).toBe(true)
    })
  })

  test('não repete GET com retryable falso', async () => {
    let calls = 0
    const mock = (() => {
      calls += 1
      return Promise.resolve(new Response(
        JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'x', retryable: false, details: null } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ))
    }) as typeof fetch

    await withFetch(mock, async () => {
      let caught: unknown
      try {
        await api.get('/x')
      } catch (error) {
        caught = error
      }
      expect(calls).toBe(1)
      expect(caught instanceof ApiError).toBe(true)
    })
  })
})
