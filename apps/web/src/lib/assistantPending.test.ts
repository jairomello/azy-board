import { describe, expect, test } from 'bun:test'
import { shouldShowPendingReply } from './assistantPending'

const running = (over: Record<string, unknown> = {}) => ({ id: 'run-1', status: 'RUNNING', ...over })

describe('shouldShowPendingReply', () => {
  test('mostra imediatamente após o envio, antes de existir a run', () => {
    expect(shouldShowPendingReply({ sending: true, run: null, messages: [] })).toBe(true)
  })

  test('mantém o loader enquanto a run roda sem etapas nem texto', () => {
    expect(shouldShowPendingReply({ sending: false, run: running(), messages: [] })).toBe(true)
  })

  test('esconde quando o run expõe modelo ou etapas de ferramenta', () => {
    expect(shouldShowPendingReply({ sending: false, run: running({ model: 'gpt-4o-mini' }), messages: [] })).toBe(false)
    expect(shouldShowPendingReply({ sending: false, run: running({ tools: [{ toolName: 'list_tasks' }] }), messages: [] })).toBe(false)
  })

  test('esconde quando a resposta começa a ser transmitida', () => {
    expect(shouldShowPendingReply({ sending: false, run: running(), messages: [{ id: 'stream-run-1' }] })).toBe(false)
  })

  test('esconde em estado terminal, de espera ou ocioso', () => {
    expect(shouldShowPendingReply({ sending: false, run: running({ status: 'COMPLETED' }), messages: [] })).toBe(false)
    expect(shouldShowPendingReply({ sending: false, run: running({ status: 'WAITING_USER' }), messages: [] })).toBe(false)
    expect(shouldShowPendingReply({ sending: false, run: null, messages: [] })).toBe(false)
  })
})
