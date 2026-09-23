import { describe, expect, test } from 'bun:test'
import { queryClient, queryDefaults } from './queryClient'
import { ApiError, isAbortError } from './api'

describe('política da camada de cache', () => {
  test('não reexecuta consultas canceladas e limita retentativas', () => {
    const abort = new DOMException('Aborted', 'AbortError')
    expect(queryDefaults.retry(0, abort)).toBe(false)
    expect(queryDefaults.retry(0, new Error('falha'))).toBe(true)
    expect(queryDefaults.retry(1, new Error('falha'))).toBe(false)
  })

  test('expõe validade e revalidação explícitas', () => {
    expect(queryDefaults.staleTime).toBe(30_000)
    expect(queryDefaults.gcTime).toBe(5 * 60_000)
    expect(queryDefaults.refetchOnWindowFocus).toBe(false)
  })

  test('reconhece cancelamento sem confundir com erro de domínio', () => {
    expect(isAbortError(new DOMException('Aborted', 'AbortError'))).toBe(true)
    expect(isAbortError(new ApiError('falha', 500))).toBe(false)
    expect(isAbortError(undefined)).toBe(false)
  })

  test('rollback restaura o snapshot do cache', () => {
    const key = ['rollback-test'] as const
    const original = { value: 'servidor' }
    queryClient.setQueryData(key, original)
    const snapshot = queryClient.getQueryData(key)
    // Atualização otimista
    queryClient.setQueryData(key, { value: 'otimista' })
    expect(queryClient.getQueryData(key)).toEqual({ value: 'otimista' })
    // Rollback
    queryClient.setQueryData(key, snapshot)
    expect(queryClient.getQueryData(key)).toEqual(original)
    queryClient.removeQueries({ queryKey: key })
  })
})
