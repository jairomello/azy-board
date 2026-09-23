// Fonte única dos limites do Azy Agent e do harness.
//
// Consumido pela API (governança e harness), pelo frontend (formulário de
// governança do Root e drawer do chat) e pelos geradores de documentação.
// Não duplique estes valores em outros módulos nem na documentação: a tabela de
// limites é gerada a partir daqui (ver `scripts/generate-assistant-limits.ts`).

export interface Governance {
  requestsPerMinute: number
  maxActivePerUser: number
  maxActivePerTenant: number
  dailyBudgetMicros: number
  tenantDailyBudgetMicros: number
  maxSteps: number
  maxToolCalls: number
  maxInputTokens: number
  maxOutputTokens: number
  maxPayloadBytes: number
  timeoutMs: number
}

export const GOVERNANCE_KEYS = [
  'requestsPerMinute',
  'maxActivePerUser',
  'maxActivePerTenant',
  'dailyBudgetMicros',
  'tenantDailyBudgetMicros',
  'maxSteps',
  'maxToolCalls',
  'maxInputTokens',
  'maxOutputTokens',
  'maxPayloadBytes',
  'timeoutMs',
] as const satisfies readonly (keyof Governance)[]

export const DEFAULT_GOVERNANCE: Governance = {
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
}

export const GOVERNANCE_BOUNDS: { [K in keyof Governance]: readonly [number, number] } = {
  requestsPerMinute: [1, 1_000],
  maxActivePerUser: [1, 20],
  maxActivePerTenant: [1, 100],
  dailyBudgetMicros: [1_000, 100_000_000],
  tenantDailyBudgetMicros: [1_000, 1_000_000_000],
  maxSteps: [1, 32],
  maxToolCalls: [1, 100],
  maxInputTokens: [1_000, 128_000],
  maxOutputTokens: [256, 32_000],
  maxPayloadBytes: [1_000, 1_000_000],
  timeoutMs: [5_000, 300_000],
}

export const HARNESS_LIMITS = {
  steps: 16,
  toolCalls: 40,
  inputTokens: 16_000,
  outputTokens: 8_000,
  payloadBytes: 100_000,
  timeoutMs: 60_000,
  costMicros: 2_000_000,
} as const

export const MAX_MESSAGE_BYTES = 30_000
export const MAX_ASSISTANT_ACTIONS = 40
