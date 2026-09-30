import type { Database } from 'bun:sqlite'
import type { MutationContext } from '../../persistence/models'
import { generateId } from '../../utils/id'

export interface SqliteItemSnapshot {
  parentId: string | null
  type: string
  isLeaf: boolean
  status: string
  points: number | null
  sprintIds: string[]
  versionId: string | null
  moduleId: string | null
}

interface SnapshotRow {
  parent_id: string | null
  type: string
  status: string
  points: number | null
  version_id: string | null
  module_id: string | null
}

interface MetricsRow { total: number; done: number; points: number; done_points: number }

function snapshotCounters(snapshot: SqliteItemSnapshot | null): MetricsRow {
  if (!snapshot || !snapshot.isLeaf || !['TASK', 'BUG'].includes(snapshot.type) || snapshot.status === 'ARCHIVED') {
    return { total: 0, done: 0, points: 0, done_points: 0 }
  }
  const points = snapshot.points ?? 0
  const done = snapshot.status === 'DONE'
  return { total: 1, done: done ? 1 : 0, points, done_points: done ? points : 0 }
}

function add(left: MetricsRow, right: MetricsRow): MetricsRow {
  return {
    total: left.total + right.total,
    done: left.done + right.done,
    points: left.points + right.points,
    done_points: left.done_points + right.done_points,
  }
}

function negate(value: MetricsRow): MetricsRow {
  return { total: -value.total, done: -value.done, points: -value.points, done_points: -value.done_points }
}

export function readItemSnapshot(database: Database, tenantId: string, projectId: string, itemId: string): SqliteItemSnapshot | null {
  const row = database.query<SnapshotRow, [string, string, string]>(
    'SELECT parent_id, type, status, points, version_id, module_id FROM items WHERE tenant_id = ? AND project_id = ? AND id = ?',
  ).get(tenantId, projectId, itemId)
  if (!row) return null
  const hasChildren = database.query<{ id: string }, [string, string, string]>(
    'SELECT id FROM items WHERE tenant_id = ? AND project_id = ? AND parent_id = ? LIMIT 1',
  ).get(tenantId, projectId, itemId) !== null
  const sprintIds = database.query<{ sprint_id: string }, [string, string]>(
    'SELECT sprint_id FROM item_sprints WHERE tenant_id = ? AND item_id = ? ORDER BY sprint_id',
  ).all(tenantId, itemId).map(link => link.sprint_id)
  return {
    parentId: row.parent_id,
    type: row.type,
    isLeaf: !hasChildren,
    status: row.status,
    points: row.points,
    sprintIds,
    versionId: row.version_id,
    moduleId: row.module_id,
  }
}

/** Carrega snapshots de vários itens com consultas por lote, nunca por item. */
export function readItemSnapshots(database: Database, tenantId: string, projectId: string, itemIds: string[]): Map<string, SqliteItemSnapshot> {
  const uniqueIds = [...new Set(itemIds)]
  const snapshots = new Map<string, SqliteItemSnapshot>()
  const batchSize = 300
  for (let offset = 0; offset < uniqueIds.length; offset += batchSize) {
    const ids = uniqueIds.slice(offset, offset + batchSize)
    if (!ids.length) continue
    const placeholders = ids.map(() => '?').join(', ')
    const params = [tenantId, projectId, ...ids]
    const rows = database.query<SnapshotRow & { id: string }, string[]>(
      `SELECT id, parent_id, type, status, points, version_id, module_id
       FROM items WHERE tenant_id = ? AND project_id = ? AND id IN (${placeholders})`,
    ).all(...params)
    const childRows = database.query<{ parent_id: string }, string[]>(
      `SELECT DISTINCT parent_id FROM items WHERE tenant_id = ? AND project_id = ? AND parent_id IN (${placeholders})`,
    ).all(tenantId, projectId, ...ids)
    const hasChildren = new Set(childRows.map(row => row.parent_id))
    const sprintRows = database.query<{ item_id: string; sprint_id: string }, string[]>(
      `SELECT link.item_id, link.sprint_id FROM item_sprints AS link
       INNER JOIN items AS item ON item.tenant_id = link.tenant_id AND item.id = link.item_id
       WHERE item.tenant_id = ? AND item.project_id = ? AND link.item_id IN (${placeholders})
       ORDER BY link.item_id, link.sprint_id`,
    ).all(tenantId, projectId, ...ids)
    const sprintIdsByItem = new Map<string, string[]>()
    for (const link of sprintRows) {
      const list = sprintIdsByItem.get(link.item_id) ?? []
      list.push(link.sprint_id)
      sprintIdsByItem.set(link.item_id, list)
    }
    for (const row of rows) {
      snapshots.set(row.id, {
        parentId: row.parent_id,
        type: row.type,
        isLeaf: !hasChildren.has(row.id),
        status: row.status,
        points: row.points,
        sprintIds: sprintIdsByItem.get(row.id) ?? [],
        versionId: row.version_id,
        moduleId: row.module_id,
      })
    }
  }
  return snapshots
}

function applyDailyDelta(database: Database, input: {
  tenantId: string
  projectId: string
  occurredAt: string
  eventType: string
  before: SqliteItemSnapshot | null
  after: SqliteItemSnapshot | null
}) {
  const day = input.occurredAt.slice(0, 10)
  const before = snapshotCounters(input.before)
  const after = snapshotCounters(input.after)
  const delta = input.eventType === 'ITEM_DELETED' ? negate(before) : add(after, negate(before))
  applyDailyDeltaValue(database, input.tenantId, input.projectId, day, delta)
}

function applyDailyDeltaValue(database: Database, tenantId: string, projectId: string, day: string, delta: MetricsRow) {
  const exists = database.query<{ total: number }, [string, string, string]>(
    'SELECT total FROM project_metrics_daily WHERE tenant_id = ? AND project_id = ? AND metric_date = ?',
  ).get(tenantId, projectId, day)

  let value = delta
  if (!exists) {
    const carry = database.query<MetricsRow, [string, string, string]>(
      'SELECT total, done, points, done_points FROM project_metrics_daily WHERE tenant_id = ? AND project_id = ? AND metric_date < ? ORDER BY metric_date DESC LIMIT 1',
    ).get(tenantId, projectId, day)
    value = add(carry ?? { total: 0, done: 0, points: 0, done_points: 0 }, delta)
  }

  database.query(`INSERT INTO project_metrics_daily (tenant_id, project_id, metric_date, total, done, points, done_points)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (tenant_id, project_id, metric_date) DO UPDATE SET
      total = ${exists ? 'project_metrics_daily.total + excluded.total' : 'excluded.total'},
      done = ${exists ? 'project_metrics_daily.done + excluded.done' : 'excluded.done'},
      points = ${exists ? 'project_metrics_daily.points + excluded.points' : 'excluded.points'},
      done_points = ${exists ? 'project_metrics_daily.done_points + excluded.done_points' : 'excluded.done_points'}`)
    .run(tenantId, projectId, day, value.total, value.done, value.points, value.done_points)
}

// Exclusão de uma subárvore gera um evento por item, mas reserva a sequência e
// atualiza o rollup diário em lote para não reintroduzir leituras N+1 via analytics.
export function recordDeletedItemEventsBatch(database: Database, context: MutationContext, projectId: string, snapshots: Map<string, SqliteItemSnapshot>) {
  const entries = [...snapshots.entries()]
  if (!entries.length) return
  const occurredAt = new Date().toISOString()
  const day = occurredAt.slice(0, 10)
  const lastSequence = database.query<{ sequence: number }, [string, string]>(
    'SELECT sequence FROM item_events WHERE tenant_id = ? AND project_id = ? ORDER BY sequence DESC LIMIT 1',
  ).get(context.tenantId, projectId)?.sequence ?? -1
  const batchSize = 50 // 12 parâmetros por evento; mantém-se abaixo do limite SQLite legado.
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const batch = entries.slice(offset, offset + batchSize)
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
    const params: Array<string | number | null> = []
    batch.forEach(([itemId, before], index) => params.push(
      generateId(), context.tenantId, projectId, itemId, 'ITEM_DELETED', occurredAt, lastSequence + offset + index + 1,
      context.actorUserId ?? 'SYSTEM', context.mutation.origin, generateId(), JSON.stringify(before), null,
    ))
    database.query(`INSERT INTO item_events
      (id, tenant_id, project_id, item_id, event_type, occurred_at, sequence, actor_id, origin, correlation_id, before_snapshot, after_snapshot)
      VALUES ${placeholders} ON CONFLICT DO NOTHING`).run(...params)
  }
  const totals = entries.reduce((sum, [, snapshot]) => add(sum, snapshotCounters(snapshot)), { total: 0, done: 0, points: 0, done_points: 0 })
  applyDailyDeltaValue(database, context.tenantId, projectId, day, negate(totals))
}

export function recordItemEvent(database: Database, context: MutationContext, input: {
  projectId: string
  itemId: string | null
  eventType: string
  before?: SqliteItemSnapshot | null
  after?: SqliteItemSnapshot | null
  occurredAt?: string
  correlationId?: string | null
}) {
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const correlationId = input.correlationId ?? context.mutation.correlationId ?? generateId()
  const sequence = database.query<{ sequence: number }, [string, string]>(
    'SELECT sequence FROM item_events WHERE tenant_id = ? AND project_id = ? ORDER BY sequence DESC LIMIT 1',
  ).get(context.tenantId, input.projectId)?.sequence ?? -1
  const inserted = database.query(`INSERT INTO item_events
    (id, tenant_id, project_id, item_id, event_type, occurred_at, sequence, actor_id, origin, correlation_id, before_snapshot, after_snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`)
    .run(
      generateId(), context.tenantId, input.projectId, input.itemId, input.eventType, occurredAt, sequence + 1,
      context.actorUserId ?? 'SYSTEM', context.mutation.origin, correlationId,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
    )

  if (inserted.changes > 0 && input.itemId !== null && input.eventType !== 'ANALYTICS_BASELINE') {
    applyDailyDelta(database, {
      tenantId: context.tenantId,
      projectId: input.projectId,
      occurredAt,
      eventType: input.eventType,
      before: input.before ?? null,
      after: input.after ?? null,
    })
  }
}
