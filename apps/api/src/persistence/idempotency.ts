import type { CommandIdempotency, IdempotencyStatus } from './models'

// [T38] Journal idempotente transacional. Namespaces versionados por comando:
// mudar a semântica do comando exige nova versão para não reutilizar resultados
// de intenção diferente. O escopo de projeto é explícito (id ou sentinela).
export const COMMAND_NAMESPACES = {
  createItem: 'create_item.v1',
  updateItems: 'update_items.v1',
  batch: 'batch.v1',
  moveItem: 'move_item.v1',
  createItemLog: 'create_item_log.v1',
  createItemLink: 'create_item_link.v1',
  createChecklist: 'create_checklist.v1',
  createChecklistItem: 'create_checklist_item.v1',
  // Card T25 — mutações de cadastros/composição de squad pela conversa.
  setMemberSquad: 'set_member_squad.v1',
  updateSquad: 'update_squad.v1',
  updateModule: 'update_module.v1',
  updateTag: 'update_tag.v1',
  updateCostCenter: 'update_cost_center.v1',
} as const

/** Sentinela para operações sem projeto (ex.: criação de projeto/tenant). */
export const GLOBAL_PROJECT_SCOPE = '__global__'

export class IdempotencyConflictError extends Error {
  readonly code = 'IDEMPOTENCY_CONFLICT'
  constructor() {
    super('IDEMPOTENCY_CONFLICT')
    this.name = 'IdempotencyConflictError'
  }
}

/**
 * Sinaliza que a chave já foi reservada/confirmada: o chamador deve devolver o
 * resultado armazenado (COMMITTED) ou reconstruí-lo a partir da referência
 * (PENDING) sem reaplicar efeitos.
 */
export class IdempotentReplaySignal extends Error {
  readonly code = 'IDEMPOTENT_REPLAY'
  constructor(readonly record: { responseJson: string; status: IdempotencyStatus }) {
    super('IDEMPOTENT_REPLAY')
    this.name = 'IdempotentReplaySignal'
  }
}

/** Envelope persistido no journal: status HTTP + corpo canônico da resposta. */
export interface IdempotencyResponseEnvelope {
  status: number
  body: unknown
}

export function isIdempotencyConflict(error: unknown): error is IdempotencyConflictError {
  return error instanceof IdempotencyConflictError || (error instanceof Error && error.message === 'IDEMPOTENCY_CONFLICT')
}

export function isIdempotentReplay(error: unknown): error is IdempotentReplaySignal {
  return error instanceof IdempotentReplaySignal
}

/** Corpo de reserva gravado no mesmo commit, antes do corpo final estar disponível. */
export interface PendingIdempotencyBody {
  __pendingOperationId: string
}

export function isPendingBody(body: unknown): body is PendingIdempotencyBody {
  return Boolean(body && typeof body === 'object' && '__pendingOperationId' in (body as Record<string, unknown>))
}

export function parseEnvelope(responseJson: string): IdempotencyResponseEnvelope | null {
  try {
    const parsed = JSON.parse(responseJson) as IdempotencyResponseEnvelope
    if (!parsed || typeof parsed !== 'object' || typeof parsed.status !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export type { CommandIdempotency }
