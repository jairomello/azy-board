import { describe, expect, test } from 'bun:test'
import { normalizeErrorPayload } from './errorResponse'

describe('contrato único de erro', () => {
  test('normaliza resposta legada dentro do envelope', () => {
    expect(normalizeErrorPayload({ error: 'Falha', code: 'INVALID_REQUEST', retryable: false }, 400)).toEqual({
      error: { code: 'INVALID_REQUEST', message: 'Falha', retryable: false, details: null },
    })
  })

  test('usa mensagem genérica e remove dados internos em erro 500', () => {
    const payload = normalizeErrorPayload({ error: new Error('SQL password=secret at /app/src/file.ts'), stack: 'stack' }, 500)
    expect(payload).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Não foi possível processar a solicitação', retryable: false, details: null } })
    expect(JSON.stringify(payload)).not.toContain('SQL')
    expect(JSON.stringify(payload)).not.toContain('secret')
  })

  test('preserva detalhes de validação serializáveis', () => {
    expect(normalizeErrorPayload({ error: 'Dados inválidos', code: 'INVALID_REQUEST', details: { field: 'title', token: 'remove' } }, 422).error.details).toEqual({ field: 'title' })
  })
})
