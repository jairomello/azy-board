import type { PoolClient } from 'pg'
import type { MutationContext } from '../../persistence/models'
import { dashboardDimensionDeltas, dashboardDimensionMetrics, dashboardDimensionTuple, type DashboardDimensionDelta, type DashboardDimensionSnapshot, type DashboardDimensionTuple } from '../../services/dashboardDimensionProjection'
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
  if (!snapshot || !snapshot.isLeaf || !['TASK', 'BUG', 'EXTERNAL'].includes(snapshot.type) || snapshot.status === 'ARCHIVED') {
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

type DimensionProjectionOptions = { allowBuilding?: boolean; metaLocked?: boolean; writeSequence?: boolean }

async function applyDimensionProjectionDeltas(client: PoolClient, tenantId: string, projectId: string, occurredAt: string, sequence: number, deltas: DashboardDimensionDelta[], options: DimensionProjectionOptions = {}) {
  if (!options.metaLocked) {
    const meta = await client.query(
      'SELECT status, projection_version FROM project_analytics_dimension_meta WHERE tenant_id = $1 AND project_id = $2 FOR UPDATE',
      [tenantId, projectId],
    )
    if (!meta.rows[0] || Number(meta.rows[0].projection_version) !== 1 || (!options.allowBuilding && meta.rows[0].status !== 'READY')) return
  }

  const grouped = new Map<string, { tuple: DashboardDimensionTuple; total: number; done: number; points: number; donePoints: number }>()
  for (const delta of deltas) {
    const key = JSON.stringify(delta.tuple)
    const current = grouped.get(key) ?? { tuple: delta.tuple, total: 0, done: 0, points: 0, donePoints: 0 }
    current.total += delta.metrics.total
    current.done += delta.metrics.done
    current.points += delta.metrics.points
    current.donePoints += delta.metrics.donePoints
    grouped.set(key, current)
  }

  const day = occurredAt.slice(0, 10)
  for (const delta of grouped.values()) {
    const tuple = delta.tuple
    const state = await client.query(
      `INSERT INTO project_analytics_dimension_state
        (tenant_id, project_id, module_key, version_key, sprint_set_hash, sprint_ids_json, type, total, done, points, done_points)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (tenant_id, project_id, module_key, version_key, sprint_set_hash, sprint_ids_json, type) DO UPDATE SET
         total = project_analytics_dimension_state.total + EXCLUDED.total,
         done = project_analytics_dimension_state.done + EXCLUDED.done,
         points = project_analytics_dimension_state.points + EXCLUDED.points,
         done_points = project_analytics_dimension_state.done_points + EXCLUDED.done_points
       RETURNING total, done, points, done_points`,
      [tenantId, projectId, tuple.moduleKey, tuple.versionKey, tuple.sprintSetHash, tuple.sprintIdsJson, tuple.type, delta.total, delta.done, delta.points, delta.donePoints],
    )
    const totals = state.rows[0] as { total: number; done: number; points: number; done_points: number }
    await client.query(
      `INSERT INTO project_analytics_dimension_snapshots
        (tenant_id, project_id, metric_date, module_key, version_key, sprint_set_hash, sprint_ids_json, type, total, done, points, done_points)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (tenant_id, project_id, metric_date, module_key, version_key, sprint_set_hash, sprint_ids_json, type) DO UPDATE SET
         total = EXCLUDED.total, done = EXCLUDED.done, points = EXCLUDED.points, done_points = EXCLUDED.done_points`,
      [tenantId, projectId, day, tuple.moduleKey, tuple.versionKey, tuple.sprintSetHash, tuple.sprintIdsJson, tuple.type, totals.total, totals.done, totals.points, totals.done_points],
    )
  }
  if (options.writeSequence !== false) {
    await client.query(
      'UPDATE project_analytics_dimension_meta SET last_sequence = GREATEST(last_sequence, $1), updated_at = $2 WHERE tenant_id = $3 AND project_id = $4',
      [sequence, occurredAt, tenantId, projectId],
    )
  }
}

async function applyDimensionProjection(client: PoolClient, tenantId: string, projectId: string, itemId: string, occurredAt: string, sequence: number, before: PgItemSnapshot | null, after: PgItemSnapshot | null, options: DimensionProjectionOptions = {}) {
  if (!options.metaLocked) {
    const ready = await client.query(
      'SELECT status, projection_version FROM project_analytics_dimension_meta WHERE tenant_id = $1 AND project_id = $2 FOR UPDATE',
      [tenantId, projectId],
    )
    if (!ready.rows[0] || Number(ready.rows[0].projection_version) !== 1 || (!options.allowBuilding && ready.rows[0].status !== 'READY')) return
  }
  const stored = await client.query(
    'SELECT snapshot_json FROM project_analytics_dimension_items WHERE tenant_id = $1 AND project_id = $2 AND item_id = $3',
    [tenantId, projectId, itemId],
  )
  const previous = stored.rows[0] ? JSON.parse(String(stored.rows[0].snapshot_json)) as PgItemSnapshot : before
  await applyDimensionProjectionDeltas(client, tenantId, projectId, occurredAt, sequence, dashboardDimensionDeltas(previous, after), options)
  if (after) {
    await client.query(`INSERT INTO project_analytics_dimension_items (tenant_id, project_id, item_id, snapshot_json)
      VALUES ($1, $2, $3, $4) ON CONFLICT (tenant_id, project_id, item_id) DO UPDATE SET snapshot_json = EXCLUDED.snapshot_json`,
    [tenantId, projectId, itemId, JSON.stringify(after)])
  } else {
    await client.query('DELETE FROM project_analytics_dimension_items WHERE tenant_id = $1 AND project_id = $2 AND item_id = $3', [tenantId, projectId, itemId])
  }
}

export async function applyDimensionProjectionBackfill(client: PoolClient, tenantId: string, projectId: string, itemId: string, occurredAt: string, sequence: number, before: PgItemSnapshot | null, after: PgItemSnapshot | null) {
  await applyDimensionProjection(client, tenantId, projectId, itemId, occurredAt, sequence, before, after, { allowBuilding: true, metaLocked: true, writeSequence: false })
}

export async function applyDimensionProjectionBaselineBackfill(client: PoolClient, tenantId: string, projectId: string, occurredAt: string, sequence: number, rows: Array<{ itemId: string } & DashboardDimensionSnapshot>) {
  const day = occurredAt.slice(0, 10)
  const totalsByTuple = new Map<string, { tuple: DashboardDimensionTuple; total: number; done: number; points: number; donePoints: number }>()
  for (const row of rows) {
    const tuple = dashboardDimensionTuple(row)
    const contribution = dashboardDimensionMetrics(row)
    if (contribution.total === 0 && contribution.done === 0 && contribution.points === 0 && contribution.donePoints === 0) continue
    const key = JSON.stringify(tuple)
    const totals = totalsByTuple.get(key) ?? { tuple, total: 0, done: 0, points: 0, donePoints: 0 }
    totals.total += contribution.total
    totals.done += contribution.done
    totals.points += contribution.points
    totals.donePoints += contribution.donePoints
    totalsByTuple.set(key, totals)
  }

  const itemBatchSize = 500
  for (let offset = 0; offset < rows.length; offset += itemBatchSize) {
    const batch = rows.slice(offset, offset + itemBatchSize)
    const values: string[] = []
    const params: unknown[] = []
    batch.forEach(row => {
      const base = params.length
      values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4})`)
      params.push(tenantId, projectId, row.itemId, JSON.stringify(row))
    })
    await client.query(`INSERT INTO project_analytics_dimension_items (tenant_id,project_id,item_id,snapshot_json)
      VALUES ${values.join(',')} ON CONFLICT (tenant_id,project_id,item_id) DO UPDATE SET snapshot_json=EXCLUDED.snapshot_json`, params)
  }

  const dimensionRows = [...totalsByTuple.values()]
  const dimensionBatchSize = 500
  for (let offset = 0; offset < dimensionRows.length; offset += dimensionBatchSize) {
    const batch = dimensionRows.slice(offset, offset + dimensionBatchSize)
    const values: string[] = []
    const params: unknown[] = []
    batch.forEach(row => {
      const base = params.length
      values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11})`)
      params.push(tenantId, projectId, row.tuple.moduleKey, row.tuple.versionKey, row.tuple.sprintSetHash, row.tuple.sprintIdsJson, row.tuple.type, row.total, row.done, row.points, row.donePoints)
    })
    await client.query(`INSERT INTO project_analytics_dimension_state
      (tenant_id,project_id,module_key,version_key,sprint_set_hash,sprint_ids_json,type,total,done,points,done_points)
      VALUES ${values.join(',')} ON CONFLICT (tenant_id,project_id,module_key,version_key,sprint_set_hash,sprint_ids_json,type) DO UPDATE SET
      total=EXCLUDED.total,done=EXCLUDED.done,points=EXCLUDED.points,done_points=EXCLUDED.done_points`, params)

    const snapshotValues: string[] = []
    const snapshotParams: unknown[] = []
    batch.forEach(row => {
      const base = snapshotParams.length
      snapshotValues.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12})`)
      snapshotParams.push(tenantId, projectId, day, row.tuple.moduleKey, row.tuple.versionKey, row.tuple.sprintSetHash, row.tuple.sprintIdsJson, row.tuple.type, row.total, row.done, row.points, row.donePoints)
    })
    await client.query(`INSERT INTO project_analytics_dimension_snapshots
      (tenant_id,project_id,metric_date,module_key,version_key,sprint_set_hash,sprint_ids_json,type,total,done,points,done_points)
      VALUES ${snapshotValues.join(',')} ON CONFLICT (tenant_id,project_id,metric_date,module_key,version_key,sprint_set_hash,sprint_ids_json,type) DO UPDATE SET
      total=EXCLUDED.total,done=EXCLUDED.done,points=EXCLUDED.points,done_points=EXCLUDED.done_points`, snapshotParams)
  }
  await client.query('UPDATE project_analytics_dimension_meta SET last_sequence = GREATEST(last_sequence,$1), updated_at=$2 WHERE tenant_id=$3 AND project_id=$4', [sequence, occurredAt, tenantId, projectId])
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
  const ready = await client.query('SELECT status, projection_version FROM project_analytics_dimension_meta WHERE tenant_id = $1 AND project_id = $2 FOR UPDATE', [context.tenantId, projectId])
  if (ready.rows[0]?.status === 'READY' && Number(ready.rows[0].projection_version) === 1) {
    const itemIds = entries.map(([id]) => id)
    const storedSnapshots = new Map<string, PgItemSnapshot>()
    const batchSize = 500
    for (let offset = 0; offset < itemIds.length; offset += batchSize) {
      const batch = itemIds.slice(offset, offset + batchSize)
      const rows = await client.query('SELECT item_id, snapshot_json FROM project_analytics_dimension_items WHERE tenant_id = $1 AND project_id = $2 AND item_id = ANY($3::text[])', [context.tenantId, projectId, batch])
      for (const row of rows.rows as Array<{ item_id: string; snapshot_json: string }>) storedSnapshots.set(row.item_id, JSON.parse(row.snapshot_json) as PgItemSnapshot)
    }
    const dimensionDeltas = entries.flatMap(([id, before]) => dashboardDimensionDeltas(storedSnapshots.get(id) ?? before, null))
    await applyDimensionProjectionDeltas(client, context.tenantId, projectId, occurredAt, baseSequence + entries.length - 1, dimensionDeltas)
    for (let offset = 0; offset < itemIds.length; offset += batchSize) {
      const batch = itemIds.slice(offset, offset + batchSize)
      await client.query('DELETE FROM project_analytics_dimension_items WHERE tenant_id = $1 AND project_id = $2 AND item_id = ANY($3::text[])', [context.tenantId, projectId, batch])
    }
  }
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
    await applyDimensionProjection(client, context.tenantId, input.projectId, input.itemId, occurredAt, sequence, input.before ?? null, input.after ?? null)
  }
}
