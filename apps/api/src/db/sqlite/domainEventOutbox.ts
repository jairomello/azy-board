import type { Database } from 'bun:sqlite'
import type { DomainEventInput, DomainEventPort, DomainEventRecord } from '../../persistence/ports'
import { generateId } from '../../utils/id'

// [T38] Outbox de eventos de domínio (SQLite). `appendDomainEventSync` roda
// dentro da transação da mutação (sem await); `createSqliteDomainEventPort`
// expõe replay/claim/ack para o dispatcher.

interface OutboxRow {
  id: string
  tenant_id: string
  project_id: string
  sequence: number
  type: string
  payload_json: string
  schema_version: number
  operation_id: string | null
  correlation_id: string | null
  status: 'PENDING' | 'PUBLISHED'
  attempts: number
  available_at: string
  created_at: string
  published_at: string | null
}

function mapRow(row: OutboxRow): DomainEventRecord {
  let payload: unknown = null
  try { payload = JSON.parse(row.payload_json) } catch { payload = null }
  return {
    id: row.id, tenantId: row.tenant_id, projectId: row.project_id, sequence: row.sequence,
    type: row.type, payload, schemaVersion: row.schema_version, operationId: row.operation_id,
    correlationId: row.correlation_id, status: row.status, attempts: row.attempts,
    availableAt: row.available_at, createdAt: row.created_at, publishedAt: row.published_at,
  }
}

function allocateSequence(database: Database, tenantId: string, projectId: string): number {
  const row = database.query(
    `INSERT INTO domain_event_counters (tenant_id, project_id, last_sequence)
     VALUES (?, ?, 1)
     ON CONFLICT(tenant_id, project_id) DO UPDATE SET last_sequence = last_sequence + 1
     RETURNING last_sequence`,
  ).get(tenantId, projectId) as { last_sequence: number }
  return row.last_sequence
}

/** Grava evento durável alocando a sequência; usar DENTRO da transação do comando. */
export function appendDomainEventSync(database: Database, input: DomainEventInput): DomainEventRecord {
  const now = input.createdAt ?? new Date().toISOString()
  const sequence = allocateSequence(database, input.tenantId, input.projectId)
  const id = generateId()
  database.query(
    `INSERT INTO domain_event_outbox
       (id, tenant_id, project_id, sequence, type, payload_json, schema_version, operation_id, correlation_id, status, attempts, available_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?, ?)`,
  ).run(id, input.tenantId, input.projectId, sequence, input.type, JSON.stringify(input.payload ?? null),
    input.schemaVersion ?? 1, input.operationId ?? null, input.correlationId ?? null, now, now)
  return mapRow({
    id, tenant_id: input.tenantId, project_id: input.projectId, sequence, type: input.type,
    payload_json: JSON.stringify(input.payload ?? null), schema_version: input.schemaVersion ?? 1,
    operation_id: input.operationId ?? null, correlation_id: input.correlationId ?? null,
    status: 'PENDING', attempts: 0, available_at: now, created_at: now, published_at: null,
  })
}

/** Anexa todos os eventos do comando na transação atual. */
export function appendCommandDomainEvents(database: Database, context: { domainEvents?: DomainEventInput[] | undefined }, base: Omit<DomainEventInput, 'type' | 'payload'>): void {
  for (const event of context.domainEvents ?? []) {
    appendDomainEventSync(database, { ...base, ...event })
  }
}

export function createSqliteDomainEventPort(database: Database): DomainEventPort {
  const selectAfter = (tenantId: string, projectId: string, cursor: number, limit: number) =>
    database.query(
      `SELECT * FROM domain_event_outbox WHERE tenant_id = ? AND project_id = ? AND sequence > ? ORDER BY sequence LIMIT ?`,
    ).all(tenantId, projectId, cursor, limit) as OutboxRow[]

  return {
    async append(input) { return appendDomainEventSync(database, input) },
    async listAfter({ tenantId, projectId, cursor, limit }) { return selectAfter(tenantId, projectId, cursor, limit).map(mapRow) },
    async watermark(tenantId, projectId) {
      const row = database.query('SELECT last_sequence FROM domain_event_counters WHERE tenant_id = ? AND project_id = ?')
        .get(tenantId, projectId) as { last_sequence: number } | null
      return row?.last_sequence ?? 0
    },
    async claimDue({ now, limit, workerId, leaseMs }) {
      const leaseExpiresAt = new Date(Date.parse(now) + leaseMs).toISOString()
      const rows = database.query(
        `SELECT * FROM domain_event_outbox
         WHERE status = 'PENDING' AND available_at <= ?
           AND (lease_expires_at IS NULL OR lease_expires_at < ?)
         ORDER BY sequence LIMIT ?`,
      ).all(now, now, limit) as OutboxRow[]
      const claimed: DomainEventRecord[] = []
      for (const row of rows) {
        const result = database.query(
          `UPDATE domain_event_outbox SET lease_owner = ?, lease_expires_at = ?
           WHERE id = ? AND status = 'PENDING' AND (lease_expires_at IS NULL OR lease_expires_at < ?)`,
        ).run(workerId, leaseExpiresAt, row.id, now)
        if ((result.changes ?? 0) > 0) claimed.push(mapRow({ ...row, status: 'PENDING' }))
      }
      return claimed
    },
    async markPublished(eventId, _tenantId, now) {
      database.query(`UPDATE domain_event_outbox SET status = 'PUBLISHED', published_at = ?, lease_owner = NULL, lease_expires_at = NULL WHERE id = ?`)
        .run(now, eventId)
    },
    async markRetry(eventId, _tenantId, { attempts, availableAt }) {
      database.query(`UPDATE domain_event_outbox SET attempts = ?, available_at = ?, lease_owner = NULL, lease_expires_at = NULL WHERE id = ?`)
        .run(attempts, availableAt, eventId)
    },
    async prunePublishedBefore(cutoff) {
      const result = database.query(`DELETE FROM domain_event_outbox WHERE status = 'PUBLISHED' AND published_at < ?`).run(cutoff)
      return result.changes ?? 0
    },
    async pendingStats() {
      const row = database.query(
        `SELECT count(*) AS pending, min(available_at) AS oldest, coalesce(max(attempts), 0) AS maxAttempts
         FROM domain_event_outbox WHERE status = 'PENDING'`,
      ).get() as { pending: number; oldest: string | null; maxAttempts: number }
      return { pending: row.pending, oldestAvailableAt: row.oldest, maxAttempts: row.maxAttempts }
    },
    async hasPendingForOperation(tenantId, operationId) {
      const row = database.query(
        `SELECT 1 AS present FROM domain_event_outbox WHERE tenant_id = ? AND operation_id = ? AND status = 'PENDING' LIMIT 1`,
      ).get(tenantId, operationId)
      return Boolean(row)
    },
  }
}
