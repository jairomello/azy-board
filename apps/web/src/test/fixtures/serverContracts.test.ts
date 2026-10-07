import { describe, expect, test } from 'bun:test'
import { parseServerMessage } from '@azy-board/realtime-contracts'
import {
  concurrentWriteError,
  idempotencyConflict,
  itemUpdateSuccess,
  refetchComplete,
  replayComplete,
  resyncRequired,
  staleItemConflict,
  wsEvent,
} from './serverContracts'

describe('fixtures de contratos de servidor (T38/T39)', () => {
  test('T38: revisão de sucesso carrega id e updatedAt para reconciliar o cache', () => {
    const result = itemUpdateSuccess({ id: 'item-1', updatedAt: '2026-10-06T00:00:00.000Z' }, { title: 'Novo' })
    expect(result.item).toMatchObject({ id: 'item-1', title: 'Novo', updatedAt: '2026-10-06T00:00:00.000Z' })
  })

  test('T38: conflitos são 409 com código acionável', () => {
    for (const error of [staleItemConflict(), concurrentWriteError(['item-2']), idempotencyConflict()]) {
      expect(error.status).toBe(409)
      expect(error.code).toBeTruthy()
    }
    expect(concurrentWriteError(['item-2']).details).toEqual({ divergentIds: ['item-2'] })
  })

  test('T39: eventos e controles passam pelo parser do contrato', () => {
    const evento = parseServerMessage(wsEvent(3))
    expect(evento).toMatchObject({ kind: 'event', sequence: 3 })

    const replay = parseServerMessage(replayComplete(3))
    expect(replay).toMatchObject({ kind: 'control', type: 'REPLAY_COMPLETE', watermark: 3 })

    const resync = parseServerMessage(resyncRequired('gap'))
    expect(resync).toMatchObject({ kind: 'control', type: 'RESYNC_REQUIRED', reason: 'gap', token: 'token-1' })

    const confirmacao = parseServerMessage(refetchComplete('token-1', 4))
    expect(confirmacao).toMatchObject({ kind: 'control', type: 'REFETCH_COMPLETE', token: 'token-1', watermark: 4 })
  })
})
