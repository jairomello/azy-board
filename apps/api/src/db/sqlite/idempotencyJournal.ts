import type { Database } from 'bun:sqlite'
import type { MutationContext } from '../../persistence/models'
import { IdempotencyConflictError, IdempotentReplaySignal } from '../../persistence/idempotency'
import { generateId } from '../../utils/id'

// [T38] Journal idempotente dentro da transação síncrona SQLite. Todas as
// funções rodam no callback de `runSqliteAtomic` — sem await, sem commit
// intermediário. PostgreSQL tem equivalente no adapter.

interface JournalRow {
  payload_hash: string
  response_json: string
  status: 'PENDING' | 'COMMITTED'
}

function readJournal(database: Database, context: MutationContext, command: NonNullable<MutationContext['idempotency']>): JournalRow | null {
  return (database.query(
    `SELECT payload_hash, response_json, status FROM idempotency_records
     WHERE tenant_id = ? AND owner_id = ? AND tool = ? AND project_scope = ? AND idempotency_key = ?`,
  ).get(context.tenantId, context.actorUserId ?? '', command.namespace, command.projectScope, command.key) as JournalRow | null) ?? null
}

/**
 * Verifica a chave na transação: inexistente segue; mesmo hash sinaliza replay
 * (sem reaplicar efeitos); hash divergente lança conflito.
 */
export function assertJournalAvailable(database: Database, context: MutationContext): void {
  const command = context.idempotency
  if (!command) return
  const existing = readJournal(database, context, command)
  if (!existing) return
  if (existing.payload_hash !== command.payloadHash) throw new IdempotencyConflictError()
  throw new IdempotentReplaySignal({ responseJson: existing.response_json, status: existing.status })
}

/**
 * Reserva a chave no mesmo commit, com referência para reconstrução (PENDING).
 * Retorna o id da reserva, que também é o `operationId` da operação.
 */
export function reserveJournal(database: Database, context: MutationContext, pendingResponseJson: string): string | null {
  const command = context.idempotency
  if (!command) return null
  const operationId = generateId()
  database.query(
    `INSERT INTO idempotency_records
       (id, tenant_id, owner_id, tool, idempotency_key, project_scope, payload_hash, response_json, status, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
  ).run(
    operationId, context.tenantId, context.actorUserId ?? '', command.namespace, command.key,
    command.projectScope, command.payloadHash, pendingResponseJson, new Date().toISOString(), command.expiresAt,
  )
  return operationId
}
