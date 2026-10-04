import { describe, expect, test } from 'bun:test'
import { DEFAULT_GOVERNANCE, GOVERNANCE_BOUNDS } from '@azy-board/assistant-contracts'
import { sanitizedGovernance } from './governanceLimits'

describe('normalização dos parâmetros de governança (Card B6)', () => {
  test('campo vazio ou não numérico volta ao default', () => {
    const normalized = sanitizedGovernance({ ...DEFAULT_GOVERNANCE, maxInputTokens: 0, timeoutMs: Number(''), maxOutputTokens: Number.NaN })
    expect(normalized.maxInputTokens).toBe(DEFAULT_GOVERNANCE.maxInputTokens)
    expect(normalized.timeoutMs).toBe(DEFAULT_GOVERNANCE.timeoutMs)
    expect(normalized.maxOutputTokens).toBe(DEFAULT_GOVERNANCE.maxOutputTokens)
  })

  test('valores fora dos limites são grampeados para a faixa do contrato', () => {
    const normalized = sanitizedGovernance({ ...DEFAULT_GOVERNANCE, maxInputTokens: 999_999, timeoutMs: 100, maxSteps: 500 })
    expect(normalized.maxInputTokens).toBe(GOVERNANCE_BOUNDS.maxInputTokens[1])
    expect(normalized.timeoutMs).toBe(GOVERNANCE_BOUNDS.timeoutMs[0])
    expect(normalized.maxSteps).toBe(GOVERNANCE_BOUNDS.maxSteps[1])
  })

  test('o resultado sempre cabe na faixa segura definida no contrato', () => {
    const normalized = sanitizedGovernance({ ...DEFAULT_GOVERNANCE, maxOutputTokens: 1, dailyBudgetMicros: 1 })
    for (const key of Object.keys(DEFAULT_GOVERNANCE) as Array<keyof typeof DEFAULT_GOVERNANCE>) {
      const [min, max] = GOVERNANCE_BOUNDS[key]
      expect(normalized[key]).toBeGreaterThanOrEqual(min)
      expect(normalized[key]).toBeLessThanOrEqual(max)
    }
  })
})
