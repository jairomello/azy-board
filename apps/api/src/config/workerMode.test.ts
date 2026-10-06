import { describe, expect, test } from 'bun:test'
import { resolveAgentWorkerMode, AgentWorkerModeError } from './workerMode'

describe('resolveAgentWorkerMode (T37)', () => {
  test('SIMPLE usa IN_PROCESS por padrão', () => {
    expect(resolveAgentWorkerMode('SIMPLE', {})).toBe('IN_PROCESS')
  })

  test('ADVANCED usa SEPARATE por padrão', () => {
    expect(resolveAgentWorkerMode('ADVANCED', {})).toBe('SEPARATE')
  })

  test('ADVANCED rejeita consumo in-process na API', () => {
    expect(() => resolveAgentWorkerMode('ADVANCED', { AZYBOARD_AGENT_WORKER_MODE: 'IN_PROCESS' })).toThrow(AgentWorkerModeError)
  })

  test('SIMPLE rejeita entrada separada', () => {
    expect(() => resolveAgentWorkerMode('SIMPLE', { AZYBOARD_AGENT_WORKER_MODE: 'SEPARATE' })).toThrow(AgentWorkerModeError)
  })

  test('valor inválido é recusado', () => {
    expect(() => resolveAgentWorkerMode('SIMPLE', { AZYBOARD_AGENT_WORKER_MODE: 'BOGUS' })).toThrow(AgentWorkerModeError)
  })

  test('DISABLED é aceito em ambos os perfis', () => {
    expect(resolveAgentWorkerMode('SIMPLE', { AZYBOARD_AGENT_WORKER_MODE: 'DISABLED' })).toBe('DISABLED')
    expect(resolveAgentWorkerMode('ADVANCED', { AZYBOARD_AGENT_WORKER_MODE: 'DISABLED' })).toBe('DISABLED')
  })
})
