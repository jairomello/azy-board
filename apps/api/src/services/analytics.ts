import { and, eq, desc, sql } from 'drizzle-orm'
import { db } from '../db/index'
import { itemEvents, items, projectAnalyticsCoverage, sprintCycleItems, sprintCycles, itemSprints, projects } from '../db/schema'
import { generateId } from '../utils/id'
import { applyEventToDailyRollup } from './dashboardMetrics'

export type AnalyticsDb = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]
export type AnalyticsEventType = 'ANALYTICS_BASELINE' | 'ITEM_CREATED' | 'STATUS_CHANGED' | 'POINTS_CHANGED' | 'TYPE_CHANGED' | 'SPRINT_CHANGED' | 'VERSION_CHANGED' | 'ITEM_REPARENTED' | 'MODULE_CHANGED' | 'LEAF_CHANGED' | 'ITEM_ARCHIVED' | 'ITEM_UNARCHIVED' | 'ITEM_DELETED'
export type ItemAnalyticsSnapshot = {
  parentId: string | null
  type: string
  isLeaf: boolean
  status: string
  points: number | null
  sprintIds: string[]
  versionId: string | null
  moduleId: string | null
}

export async function appendAnalyticsEvent(tx: AnalyticsDb, input: {
  tenantId: string
  projectId: string
  itemId?: string | null
  eventType: AnalyticsEventType
  occurredAt?: string
  actorId: string
  origin: string
  correlationId?: string
  before?: ItemAnalyticsSnapshot | null
  // Baseline carrega a população completa; demais eventos usam snapshot único.
  after?: ItemAnalyticsSnapshot | ItemAnalyticsSnapshot[] | null
}) {
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const correlationId = input.correlationId ?? generateId()
  const latest = await tx.select({ sequence: itemEvents.sequence }).from(itemEvents)
    .where(and(eq(itemEvents.tenantId, input.tenantId), eq(itemEvents.projectId, input.projectId)))
    .orderBy(desc(itemEvents.sequence)).limit(1)
  const sequence = (latest[0]?.sequence ?? -1) + 1
  try {
    await tx.insert(itemEvents).values({
      id: generateId(), tenantId: input.tenantId, projectId: input.projectId, itemId: input.itemId ?? null,
      eventType: input.eventType, occurredAt, sequence, actorId: input.actorId, origin: input.origin, correlationId,
      beforeSnapshot: input.before ? JSON.stringify(input.before) : null,
      afterSnapshot: input.after ? JSON.stringify(input.after) : null,
    })
    // [DB-SWAP] Em PostgreSQL, o mesmo update incremental vale; em múltiplas
    // instâncias, garantir ordenação por transaction/lock do projeto.
    // Rollup diário na MESMA transação do evento (Item 13 — sem worker, sem drift).
    await applyEventToDailyRollup(tx, {
      tenantId: input.tenantId,
      projectId: input.projectId,
      eventType: input.eventType,
      occurredAt,
      beforeSnapshot: input.before ? JSON.stringify(input.before) : null,
      afterSnapshot: input.after ? JSON.stringify(input.after) : null,
    })
  } catch (error) {
    // A repeated correlation is safe to replay; any other database error aborts the caller transaction.
    if (String(error).includes('UNIQUE')) return
    throw error
  }
}

export async function snapshotItem(tx: AnalyticsDb, tenantId: string, projectId: string, itemId: string): Promise<ItemAnalyticsSnapshot | null> {
  const item = await tx.query.items.findFirst({
    where: (i) => and(eq(i.id, itemId), eq(i.tenantId, tenantId), eq(i.projectId, projectId)),
    columns: { parentId: true, type: true, status: true, points: true, versionId: true, moduleId: true },
  })
  if (!item) return null
  const children = await tx.select({ id: items.id }).from(items).where(and(eq(items.parentId, itemId), eq(items.tenantId, tenantId), eq(items.projectId, projectId))).limit(1)
  const links = await tx.select({ sprintId: itemSprints.sprintId }).from(itemSprints).innerJoin(items, eq(items.id, itemSprints.itemId))
    .where(and(eq(itemSprints.itemId, itemId), eq(items.tenantId, tenantId), eq(items.projectId, projectId)))
  return { ...item, isLeaf: children.length === 0, sprintIds: links.map(link => link.sprintId) }
}

export async function ensureCoverage(tx: AnalyticsDb, tenantId: string, projectId: string, actorId = 'SYSTEM', origin = 'SYSTEM') {
  const now = new Date().toISOString()
  await tx.insert(projectAnalyticsCoverage).values({ projectId, tenantId, coverageStartedAt: now, createdAt: now }).onConflictDoNothing()
  return tx.query.projectAnalyticsCoverage.findFirst({ where: (c) => and(eq(c.projectId, projectId), eq(c.tenantId, tenantId)) })
}

export async function createSprintCycle(tx: AnalyticsDb, tenantId: string, projectId: string, sprintId: string, source: 'OPENED' | 'MIGRATION', startedAt = new Date().toISOString()) {
  const id = generateId()
  await tx.insert(sprintCycles).values({ id, tenantId, projectId, sprintId, source, startedAt, endedAt: null, endReason: null })
  const projectItems = await tx.query.items.findMany({ where: (i) => and(eq(i.tenantId, tenantId), eq(i.projectId, projectId)) })
  const leaves = [] as typeof sprintCycleItems.$inferInsert[]
  for (const item of projectItems) {
    const linked = await tx.query.itemSprints.findFirst({ where: (link) => and(eq(link.itemId, item.id), eq(link.sprintId, sprintId)) })
    if (!linked) continue
    const child = await tx.query.items.findFirst({ where: (candidate) => and(eq(candidate.parentId, item.id), eq(candidate.tenantId, tenantId), eq(candidate.projectId, projectId)), columns: { id: true } })
    if ((item.type === 'TASK' || item.type === 'BUG') && !child) leaves.push({ cycleId: id, tenantId, projectId, itemId: item.id, type: item.type, isLeaf: true, points: item.points, status: item.status, moduleId: item.moduleId, versionId: item.versionId })
  }
  if (leaves.length) await tx.insert(sprintCycleItems).values(leaves)
  return id
}

export async function closeSprintCycle(tx: AnalyticsDb, tenantId: string, projectId: string, sprintId: string, reason: 'SUSPENDED' | 'CLOSED') {
  await tx.update(sprintCycles).set({ endedAt: new Date().toISOString(), endReason: reason })
    .where(and(eq(sprintCycles.tenantId, tenantId), eq(sprintCycles.projectId, projectId), eq(sprintCycles.sprintId, sprintId), sql`${sprintCycles.endedAt} IS NULL`))
}

// [DB-SWAP] Em PostgreSQL, esta validação deve ocorrer sob o advisory lock do deploy.
// O processo só aceita writers quando a migration/baseline já cobriu todos os projetos.
export async function assertAnalyticsCutoverReady() {
  const projectRows = await db.select({ id: projects.id }).from(projects)
  const coverageRows = await db.select({ projectId: projectAnalyticsCoverage.projectId }).from(projectAnalyticsCoverage)
  const covered = new Set(coverageRows.map(row => row.projectId))
  const missing = projectRows.filter(row => !covered.has(row.id)).map(row => row.id)
  if (missing.length) throw new Error(`Analytics cutover incompleto: ${missing.length} projeto(s) sem cobertura`)
}
