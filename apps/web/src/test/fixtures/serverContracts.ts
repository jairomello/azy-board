// Fixtures dos contratos de servidor consumidos pelo frontend, sem reimplementar
// mecanismos do servidor. T38 `garantir-mutacoes-idempotentes-transacionais`
// (revisão/erro) e T39 `sincronizar-eventos-entre-instancias` (resync/replay).
//
// Uso: testes de componente/jornada montam estas respostas para exercer a reação
// do cliente (refetch, feedback localizado, barreira) de forma determinística.
import {
  WS_PROTOCOL_VERSION,
  WS_SCHEMA_VERSION,
  type ResyncReason,
} from '@azy-board/realtime-contracts'
import { ApiError } from '../../lib/api'

export interface ItemRevision {
  id: string
  updatedAt: string
}

// ---- T38: revisão/erro transacional -----------------------------------------

// Corpo de sucesso do PATCH de item: a resposta reconcilia o cache com a nova
// revisão (`updatedAt`) devolvida pelo servidor.
export function itemUpdateSuccess(revision: ItemRevision, changes: Record<string, unknown> = {}) {
  return { item: { ...changes, id: revision.id, updatedAt: revision.updatedAt } }
}

// 409 de concorrência otimista do PATCH de item (routes/items.ts).
export function staleItemConflict(): ApiError {
  return new ApiError(
    'O item foi alterado por outra pessoa desde que você o abriu. Recarregue e tente novamente.',
    409,
    'CONFLICT',
    null,
    false,
  )
}

// 409 do /batch quando a prévia divergiu (routes/batch.ts).
export function concurrentWriteError(divergentIds: string[]): ApiError {
  return new ApiError(
    'O estado dos cards mudou desde a prévia. Recalcule a prévia com o mesmo conjunto.',
    409,
    'CONCURRENT_WRITE',
    { divergentIds },
    false,
  )
}

// 409 quando a mesma Idempotency-Key chega com payload divergente.
export function idempotencyConflict(): ApiError {
  return new ApiError('A chave já foi usada com outro payload', 409, 'IDEMPOTENCY_CONFLICT', null, false)
}

// ---- T39: resync/replay ------------------------------------------------------

export interface WsEventFixture {
  kind: 'event'
  eventId: string
  projectId: string
  sequence: number
  schemaVersion: number
  type: 'ITEM_UPDATED'
  payload?: unknown
}

export interface WsControlFixture {
  kind: 'control'
  type: 'REPLAY_COMPLETE' | 'RESYNC_REQUIRED' | 'REFETCH_COMPLETE' | 'HEARTBEAT'
  projectId: string
  schemaVersion: number
  sequence: number
  watermark?: number
  reason?: ResyncReason
  token?: string
}

const PROJECT_ID = 'project-1'

export function wsEvent(sequence: number, eventId = `evt-${sequence}`): WsEventFixture {
  return { kind: 'event', eventId, projectId: PROJECT_ID, sequence, schemaVersion: WS_SCHEMA_VERSION, type: 'ITEM_UPDATED' }
}

export function replayComplete(watermark: number, sequence = watermark): WsControlFixture {
  return { kind: 'control', type: 'REPLAY_COMPLETE', projectId: PROJECT_ID, schemaVersion: WS_SCHEMA_VERSION, sequence, watermark }
}

export function resyncRequired(reason: ResyncReason, token = 'token-1'): WsControlFixture {
  return { kind: 'control', type: 'RESYNC_REQUIRED', projectId: PROJECT_ID, schemaVersion: WS_SCHEMA_VERSION, sequence: 0, reason, token }
}

export function refetchComplete(token: string, watermark: number): WsControlFixture {
  return { kind: 'control', type: 'REFETCH_COMPLETE', projectId: PROJECT_ID, schemaVersion: WS_SCHEMA_VERSION, sequence: 0, token, watermark }
}

export const clientProtocolVersion = WS_PROTOCOL_VERSION
