import { createHash } from 'node:crypto'

export interface DashboardDimensionSnapshot {
  parentId: string | null
  type: string
  isLeaf: boolean
  status: string
  points: number | null
  sprintIds: string[]
  versionId: string | null
  moduleId: string | null
}

export interface DashboardDimensionTuple {
  moduleKey: string
  versionKey: string
  sprintIdsJson: string
  sprintSetHash: string
  type: string
}

export interface DashboardDimensionMetrics {
  total: number
  done: number
  points: number
  donePoints: number
}

export interface DashboardDimensionDelta {
  tuple: DashboardDimensionTuple
  metrics: DashboardDimensionMetrics
}

const zero = (): DashboardDimensionMetrics => ({ total: 0, done: 0, points: 0, donePoints: 0 })

export function dashboardDimensionTuple(snapshot: DashboardDimensionSnapshot): DashboardDimensionTuple {
  const sprintIds = [...new Set(snapshot.sprintIds)].sort()
  const sprintIdsJson = JSON.stringify(sprintIds)
  return {
    moduleKey: snapshot.moduleId ?? '',
    versionKey: snapshot.versionId ?? '',
    sprintIdsJson,
    sprintSetHash: createHash('sha256').update(sprintIdsJson).digest('hex'),
    type: snapshot.type,
  }
}

export function dashboardDimensionMetrics(snapshot: DashboardDimensionSnapshot | null): DashboardDimensionMetrics {
  if (!snapshot || !snapshot.isLeaf || !['TASK', 'BUG', 'EXTERNAL'].includes(snapshot.type) || snapshot.status === 'ARCHIVED') return zero()
  const points = snapshot.points ?? 0
  return { total: 1, done: snapshot.status === 'DONE' ? 1 : 0, points, donePoints: snapshot.status === 'DONE' ? points : 0 }
}

function difference(after: DashboardDimensionMetrics, before: DashboardDimensionMetrics): DashboardDimensionMetrics {
  return {
    total: after.total - before.total,
    done: after.done - before.done,
    points: after.points - before.points,
    donePoints: after.donePoints - before.donePoints,
  }
}

function hasDelta(metrics: DashboardDimensionMetrics): boolean {
  return metrics.total !== 0 || metrics.done !== 0 || metrics.points !== 0 || metrics.donePoints !== 0
}

function tupleIdentity(tuple: DashboardDimensionTuple): string {
  return JSON.stringify([tuple.moduleKey, tuple.versionKey, tuple.sprintSetHash, tuple.sprintIdsJson, tuple.type])
}

/** Gera deltas por tupla histórica sem expandir sprintIds em cópias por sprint. */
export function dashboardDimensionDeltas(before: DashboardDimensionSnapshot | null, after: DashboardDimensionSnapshot | null): DashboardDimensionDelta[] {
  const beforeMetrics = dashboardDimensionMetrics(before)
  const afterMetrics = dashboardDimensionMetrics(after)
  const beforeTuple = before ? dashboardDimensionTuple(before) : null
  const afterTuple = after ? dashboardDimensionTuple(after) : null

  if (beforeTuple && afterTuple && tupleIdentity(beforeTuple) === tupleIdentity(afterTuple)) {
    const delta = difference(afterMetrics, beforeMetrics)
    return hasDelta(delta) ? [{ tuple: afterTuple, metrics: delta }] : []
  }

  const deltas: DashboardDimensionDelta[] = []
  if (beforeTuple && hasDelta(beforeMetrics)) deltas.push({ tuple: beforeTuple, metrics: difference(zero(), beforeMetrics) })
  if (afterTuple && hasDelta(afterMetrics)) deltas.push({ tuple: afterTuple, metrics: difference(afterMetrics, zero()) })
  return deltas
}
