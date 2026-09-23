import { describe, expect, test } from 'bun:test'
import { ApiError, api, isAbortError } from './api'

describe('cancelamento no cliente api', () => {
  test('repassa o AbortSignal e propaga AbortError sem virar ApiError', async () => {
    const originalFetch = globalThis.fetch
    let capturedSignal: AbortSignal | null | undefined
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
      capturedSignal = init?.signal
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    }) as typeof fetch

    try {
      const controller = new AbortController()
      const pending = api.get('/projects/p/items', { signal: controller.signal })
      expect(capturedSignal).toBe(controller.signal)
      controller.abort()
      let caught: unknown
      try {
        await pending
      } catch (error) {
        caught = error
      }
      expect(isAbortError(caught)).toBe(true)
      expect(caught instanceof ApiError).toBe(false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
