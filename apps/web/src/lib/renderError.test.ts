import { describe, expect, test } from 'bun:test'
import { createErrorReference, describeRenderError, reportRenderError, shortErrorReference } from './renderError'

describe('referência de erro de renderização', () => {
  test('usa o provedor de uuid quando disponível', () => {
    expect(createErrorReference(() => 'abc12345-6789')).toBe('abc12345-6789')
  })

  test('gera fallback sem espaços quando não há uuid', () => {
    const reference = createErrorReference(null)
    expect(typeof reference).toBe('string')
    expect(reference.includes(' ')).toBe(false)
    expect(reference.startsWith('ref-')).toBe(true)
  })

  test('cai no fallback quando o provedor lança', () => {
    const reference = createErrorReference(() => { throw new Error('sem uuid') })
    expect(reference.startsWith('ref-')).toBe(true)
  })

  test('forma curta é alfanumérica em maiúsculas com no máximo 8 caracteres', () => {
    expect(shortErrorReference('3f9a1b2c-4d5e-6f70-8192-a3b4c5d6e7f8')).toBe('3F9A1B2C')
    expect(/^[A-Z0-9]{1,8}$/.test(shortErrorReference('ref-m1abc-def'))).toBe(true)
  })
})

describe('descrição do erro conforme o ambiente', () => {
  test('em produção não expõe mensagem nem stack', () => {
    const details = describeRenderError(new Error('segredo interno'), true)
    expect(details.showDetails).toBe(false)
    expect(details.message).toBe(null)
    expect(details.stack).toBe(null)
  })

  test('em desenvolvimento expõe mensagem e stack', () => {
    const details = describeRenderError(new Error('falha local'), false)
    expect(details.showDetails).toBe(true)
    expect(details.message).toBe('falha local')
    expect(typeof details.stack).toBe('string')
  })

  test('normaliza valores que não são Error', () => {
    expect(describeRenderError('algo quebrou', false).message).toBe('algo quebrou')
  })
})

describe('registro para observabilidade', () => {
  test('registra referência, mensagem, stack e componentStack no console', () => {
    const calls: unknown[][] = []
    const original = console.error
    console.error = (...args: unknown[]) => { calls.push(args) }
    try {
      reportRenderError({ reference: 'ref-1', error: new Error('boom'), componentStack: 'em <App />' })
    } finally {
      console.error = original
    }
    expect(calls.length).toBe(1)
    expect(calls[0]?.[0]).toBe('[ErrorBoundary]')
    const payload = calls[0]?.[1] as Record<string, unknown>
    expect(payload.reference).toBe('ref-1')
    expect(payload.message).toBe('boom')
    expect(payload.componentStack).toBe('em <App />')
    expect(typeof payload.stack).toBe('string')
  })
})
