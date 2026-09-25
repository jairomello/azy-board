import { describe, expect, test } from 'bun:test'
import { DEFAULT_GOVERNANCE, GOVERNANCE_BOUNDS, GOVERNANCE_KEYS, HARNESS_LIMITS, MAX_ASSISTANT_ACTIONS, MAX_MESSAGE_BYTES } from './assistantLimits'

describe('fonte única dos limites do Azy Agent', () => {
  test('mantém os valores default efetivos de runtime', () => {
    expect(DEFAULT_GOVERNANCE).toEqual({
      requestsPerMinute: 10,
      maxActivePerUser: 1,
      maxActivePerTenant: 3,
      dailyBudgetMicros: 100_000,
      tenantDailyBudgetMicros: 1_000_000,
      maxSteps: 32,
      maxToolCalls: 40,
      maxInputTokens: 65_000,
      maxOutputTokens: 4_000,
      maxPayloadBytes: 100_000,
      timeoutMs: 90_000,
    })
  })

  test('as faixas cobrem todas as chaves e contêm os defaults', () => {
    expect(Object.keys(GOVERNANCE_BOUNDS).sort()).toEqual([...GOVERNANCE_KEYS].sort())
    for (const key of GOVERNANCE_KEYS) {
      const [min, max] = GOVERNANCE_BOUNDS[key]
      expect(DEFAULT_GOVERNANCE[key]).toBeGreaterThanOrEqual(min)
      expect(DEFAULT_GOVERNANCE[key]).toBeLessThanOrEqual(max)
    }
  })

  test('mantém os limites do harness e do chat', () => {
    expect(HARNESS_LIMITS).toEqual({ steps: 16, toolCalls: 40, inputTokens: 16_000, outputTokens: 8_000, payloadBytes: 100_000, timeoutMs: 60_000, costMicros: 2_000_000 })
    expect(MAX_MESSAGE_BYTES).toBe(30_000)
    expect(MAX_ASSISTANT_ACTIONS).toBe(40)
  })
})
