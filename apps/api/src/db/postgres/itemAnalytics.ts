import type { Pool, PoolClient } from 'pg'
import type { MutationContext } from '../../persistence/models'
import { generateId } from '../../utils/id'

export interface PgItemSnapshot {
  parentId: string | null
  type: string
  isLeaf: boolean
  status: string
  points: number | null
  sprintIds: string[]
  versionId: string | null
  moduleId: string | null
}

interface MetricsRow { total: number; done: number; points: number; done_points: number }

function snapshotCounters(snapshot: PgItemSnapshot | null): MetricsRow {
  if (!snapshot || !snapshot.isLeaf || !['TASK', 'BUG'].includes(snapshot.type) || snapshot.status === 'ARCHIVED') {
    return { total: 0, done: 0, points: 0, done_points: 0 }
  }
  const points = snapshot.points ?? 0
  const done = snapshot.status === 'DONE'
  return { total: 1, done: done ? 1 : 0, points, done_points: done ? points : 0 }
}

function add(left: MetricsRow, right: MetricsRow): MetricsRow {
  return { total: left.total + right.total, done: left.done + right.done, points: left.points + right.points, done_points: left.done_points + right.done_points }
}

function negate(value: MetricsRow): MetricsRow {
  return { total: -value.total, done: -value.done, points: -value.points, done_points: -value.done_points }
}

export async function readItemSnapshot(client: PoolClient, tenantId: string, projectId: string, itemId: string): Promise<PgItemSnapshot | null> {
  const row = await client.query('SELECT parent_id, type, status, points, version_id, module_id FROM items WHERE tenant_id = $1 AND project_id = $2 AND id = $3',
    [tenantId, projectId, itemId])
  if (!row.rows[0]) return null
  const r = row.rows[0] as Record<string, unknown>
  const hasChildren = await client.query('SELECT id FROM items WHERE tenant_id = $1 AND project_id = $2 AND parent_id = $3 LIMIT 1',
    [tenantId, projectId, itemId])
  const sprintRows = await client.query('SELECT sprint_id FROM item_sprints WHERE tenant_id = $1 AND item_id = $2 ORDER BY sprint_id',
    [tenantId, itemId])
  return {
    parentId: r.parent_id as string | null,
    type: r.type as string,
    isLeaf: hasChildren.rows.length === 0,
    status: r.status as string,
    points: r.points as number | null,
    sprintIds: sprintRows.rows.map(s => (s as Record<string, unknown>).sprint_id as string),
    versionId: r.version_id as string | null,
    moduleId: r.module_id as string | null,
  }
}

/** Lê snapshots de vários itens com quantidade de SELECTs limitada por lote. */
export async function readItemSnapshots(client: PoolClient, tenantId: string, projectId: string, itemIds: string[]): Promise<Map<string, PgItemSnapshot>> {
  const ids = [...new Set(itemIds)]
  const result = new Map<string, PgItemSnapshot>()
  const batchSize = 500
  for (let offset = 0; offset < ids.length; offset += batchSize) {
    const batch = ids.slice(offset, offset + batchSize)
    if (!batch.length) continue
    const items = await client.query(
      'SELECT id, parent_id, type, status, points, version_id, module_id FROM items WHERE tenant_id = $1 AND project_id = $2 AND id = ANY($3::text[])',
      [tenantId, projectId, batch],
    )
    const children = await client.query(
      'SELECT DISTINCT parent_id FROM items WHERE tenant_id = $1 AND project_id = $2 AND parent_id = ANY($3::text[])',
      [tenantId, projectId, batch],
    )
    const sprints = await client.query(
      `SELECT link.item_id, link.sprint_id FROM item_sprints AS link
       INNER JOIN items AS item ON item.tenant_id = link.tenant_id AND item.id = link.item_id
       WHERE item.tenant_id = $1 AND item.project_id = $2 AND link.item_id = ANY($3::text[])
       ORDER BY link.item_id, link.sprint_id`,
      [tenantId, projectId, batch],
    )
    const hasChildren = new Set(children.rows.map(row => String((row as Record<string, unknown>).parent_id)))
    const sprintIdsByItem = new Map<string, string[]>()
    for (const row of sprints.rows as Array<{ item_id: string; sprint_id: string }>) {
      const values = sprintIdsByItem.get(row.item_id) ?? []
      values.push(row.sprint_id)
      sprintIdsByItem.set(row.item_id, values)
    }
    for (const raw of items.rows as Array<Record<string, unknown>>) {
      const id = String(raw.id)
      result.set(id, {
        parentId: raw.parent_id as string | null,
        type: String(raw.type),
        isLeaf: !hasChildren.has(id),
        status: String(raw.status),
        points: raw.points as number | null,
        sprintIds: sprintIdsByItem.get(id) ?? [],
        versionId: raw.version_id as string | null,
        moduleId: raw.module_id as string | null,
      })
    }
  }
  return result
}

async function applyDailyDelta(client: PoolClient, input: {
  tenantId: string; projectId: string; occurredAt: string; eventType: string
  before: PgItemSnapshot | null; after: PgItemSnapshot | null
}) {
  const day = input.occurredAt.slice(0, 10)
  const before = snapshotCounters(input.before)
  const after = snapshotCounters(input.after)
  const delta = input.eventType === 'ITEM_DELETED' ? negate(before) : add(after, negate(before))
  await applyDailyDeltaValue(client, input.tenantId, input.projectId, day, delta)
}

async function applyDailyDeltaValue(client: PoolClient, tenantId: string, projectId: string, day: string, delta: MetricsRow) {
  const exists = await client.query('SELECT total FROM project_metrics_daily WHERE tenant_id = $1 AND project_id = $2 AND metric_date = $3',
    [tenantId, projectId, day])

  let value = delta
  if (exists.rows.length === 0) {
    const carry = await client.query(
      'SELECT total, done, points, done_points FROM project_metrics_daily WHERE tenant_id = $1 AND project_id = $2 AND metric_date < $3 ORDER BY metric_date DESC LIMIT 1',
      [tenantId, projectId, day],
    )
    const c = carry.rows[0] as Record<string, unknown> | undefined
    value = add(c ? { total: c.total as number, done: c.done as number, points: c.points as number, done_points: c.done_points as number } : { total: 0, done: 0, points: 0, done_points: 0 }, delta)
  }

  const op = exists.rows.length > 0 ? 'project_metrics_daily.total + $4' : '$4'
  await client.query(
    `INSERT INTO project_metrics_daily (tenant_id, project_id, metric_date, total, done, points, done_points)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (tenant_id, project_id, metric_date) DO UPDATE SET
       total = ${exists.rows.length > 0 ? 'project_metrics_daily.total + $4' : '$4'},
       done = ${exists.rows.length > 0 ? 'project_metrics_daily.done + $5' : '$5'},
       points = ${exists.rows.length > 0 ? 'project_metrics_daily.points + $6' : '$6'},
       done_points = ${exists.rows.length > 0 ? 'project_metrics_daily.done_points + $7' : '$7'}`,
    [tenantId, projectId, day, value.total, value.done, value.points, value.done_points],
  )
}

// Registra eventos individuais de exclusão, reservando a sequência e
// atualizando o rollup em lote para que a exclusão da subárvore não faça SELECT
// auxiliar por item.
export async function recordDeletedItemEventsBatch(client: PoolClient, context: MutationContext, projectId: string, snapshots: Map<string, PgItemSnapshot>) {
  const entries = [...snapshots.entries()]
  if (!entries.length) return
  const occurredAt = new Date().toISOString()
  const lastSeq = await client.query('SELECT sequence FROM item_events WHERE tenant_id = $1 AND project_id = $2 ORDER BY sequence DESC LIMIT 1',
    [context.tenantId, projectId])
  const baseSequence = (((lastSeq.rows[0] as Record<string, unknown> | undefined)?.sequence as number) ?? -1) + 1
  const batchSize = 100
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const batch = entries.slice(offset, offset + batchSize)
    const values: string[] = []
    const params: unknown[] = []
    batch.forEach(([itemId, before], index) => {
      const base = params.length
      values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, 'ITEM_DELETED', $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, NULL)`)
      params.push(generateId(), context.tenantId, projectId, itemId, occurredAt, baseSequence + offset + index,
        context.actorUserId ?? 'SYSTEM', context.mutation.origin, generateId(), JSON.stringify(before))
    })
    await client.query(
      `INSERT INTO item_events (id, tenant_id, project_id, item_id, event_type, occurred_at, sequence, actor_id, origin, correlation_id, before_snapshot, after_snapshot)
       VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`,
      params,
    )
  }
  const totals = entries.reduce((sum, [, snapshot]) => add(sum, snapshotCounters(snapshot)), { total: 0, done: 0, points: 0, done_points: 0 })
  await applyDailyDeltaValue(client, context.tenantId, projectId, occurredAt.slice(0, 10), negate(totals))
}

export async function recordItemEvent(client: PoolClient, context: MutationContext, input: {
  projectId: string; itemId: string | null; eventType: string
  before?: PgItemSnapshot | null; after?: PgItemSnapshot | null
  occurredAt?: string; correlationId?: string | null
}) {
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const correlationId = input.correlationId ?? context.mutation.correlationId ?? generateId()
  const lastSeq = await client.query('SELECT sequence FROM item_events WHERE tenant_id = $1 AND project_id = $2 ORDER BY sequence DESC LIMIT 1',
    [context.tenantId, input.projectId])
  const sequence = (((lastSeq.rows[0] as Record<string, unknown> | undefined)?.sequence as number) ?? -1) + 1
  const inserted = await client.query(
    `INSERT INTO item_events (id, tenant_id, project_id, item_id, event_type, occurred_at, sequence, actor_id, origin, correlation_id, before_snapshot, after_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT DO NOTHING`,
    [generateId(), context.tenantId, input.projectId, input.itemId, input.eventType, occurredAt, sequence,
     context.actorUserId ?? 'SYSTEM', context.mutation.origin, correlationId,
     input.before ? JSON.stringify(input.before) : null,
     input.after ? JSON.stringify(input.after) : null],
  )

  if ((inserted.rowCount ?? 0) > 0 && input.itemId !== null && input.eventType !== 'ANALYTICS_BASELINE') {
    await applyDailyDelta(client, {
      tenantId: context.tenantId, projectId: input.projectId, occurredAt,
      eventType: input.eventType, before: input.before ?? null, after: input.after ?? null,
    })
  }
}
