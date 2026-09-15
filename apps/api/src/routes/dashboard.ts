import { Hono } from 'hono'
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { db } from '../db/index'
import { authMiddleware, requireRole } from '../middleware/auth'
import { items, itemEvents, itemLogs, itemSprints, projectAnalyticsCoverage, sprintCycleItems, sprintCycles, memberships, squads, users, sprints } from '../db/schema'
import { readDailyRollupSeries } from '../services/dashboardMetrics'
import type { HonoEnv } from '../types/hono'
import type { RequestContext } from '@azy-board/types'

export const dashboardRouter = new Hono<HonoEnv>()
dashboardRouter.use('*', authMiddleware)
dashboardRouter.use('*', async (c, next) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!
  const project = await db.query.projects.findFirst({ where: row => and(eq(row.id, projectId), eq(row.tenantId, ctx.tenantId)), columns: { id: true } })
  if (!project) return c.json({ error: 'Projeto não encontrado', code: 'RESOURCE_NOT_FOUND', retryable: false }, 404)
  await next()
})

const activeStatuses = new Set(['IN_PROGRESS', 'BLOCKED'])
export const isEligibleLeaf = (item: { type: string; status: string }, leaf: boolean) => leaf && (item.type === 'TASK' || item.type === 'BUG') && item.status !== 'ARCHIVED'
export const completionPercent = (done: number, total: number) => total === 0 ? null : done / total * 100
export const distributionByStatus = (rows: Array<{ status: string; points: number | null }>) => Object.fromEntries(['DONE', 'IN_PROGRESS', 'BLOCKED', 'NOT_STARTED'].map(status => [status, { count: rows.filter(row => row.status === status).length, points: rows.filter(row => row.status === status).reduce((sum, row) => sum + (row.points ?? 0), 0) }]))
export const topTenOldest = <T extends { age: number }>(items: T[]) => [...items].sort((a, b) => b.age - a.age).slice(0, 10)
export const overdueGroups = <T extends { status: string; dueDate: string | null }>(rows: T[], today: string) => {
  const overdue = rows.filter(row => !['DONE', 'CANCELLED'].includes(row.status) && Boolean(row.dueDate && row.dueDate < today))
  return { overdue, remaining: rows.filter(row => !overdue.includes(row)) }
}
export function fillDailySeries<T extends object>(values: Map<string, T>, start: string, end: string, initial: T): Array<T & { date: string }> {
  const cursor = new Date(`${start}T00:00:00.000Z`); const endDate = new Date(`${end}T00:00:00.000Z`); let last = initial
  const result: Array<T & { date: string }> = []
  while (cursor <= endDate) { const date = cursor.toISOString().slice(0, 10); last = values.get(date) ?? last; result.push({ date, ...last }); cursor.setUTCDate(cursor.getUTCDate() + 1) }
  return result
}
function csv(value?: string) { return value?.split(',').filter(Boolean) ?? [] }
const MAX_PERIOD_DAYS = 366
const HOURS_ROW_LIMIT_DEFAULT = 500
const HOURS_ROW_LIMIT_MAX = 2000
export function period(from?: string, to?: string) {
  if (!from && !to) return null
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return 'from e to devem ser datas UTC no formato AAAA-MM-DD'
  const start = Date.parse(`${from}T00:00:00.000Z`); const end = Date.parse(`${to}T23:59:59.999Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return 'Período inválido'
  if (end - start > MAX_PERIOD_DAYS * 86400000) return `O período máximo é de ${MAX_PERIOD_DAYS} dias`
  return null
}

// Item 13: população de folhas elegíveis resolvida no banco (NOT EXISTS ao filho),
// evitando carregar a hierarquia inteira para filtrar em memória.
// [TENANT] tenant + projeto presentes em toda consulta.
// [DB-SWAP] Em PostgreSQL, o NOT EXISTS vale com o índice composto equivalente.
const LEAF_POPULATION = sql`NOT EXISTS (SELECT 1 FROM items child WHERE child.parent_id = ${items.id})`

export type DashboardLeafRow = typeof items.$inferSelect

// Item 13: filtros de população aplicados como consulta dirigida (ids de sprint
// e squads via índices), com fallback em memória apenas para listas pequenas.
// [TENANT] sprint/squad/sprintJoin escopados por tenant + projeto.
async function filterPopulation(ctx: RequestContext, projectId: string, rows: Awaited<ReturnType<typeof population>>, query: (name: string) => string | undefined) {
  const modules = csv(query('moduleId')); const versions = csv(query('versionId')); const assignees = csv(query('assigneeId')); const types = csv(query('type'))
  const sprintIds = csv(query('sprintId')); const squadIds = csv(query('squadId'))
  const sprintRows = sprintIds.length ? await db.select({ itemId: itemSprints.itemId }).from(itemSprints).innerJoin(items, eq(items.id, itemSprints.itemId)).where(and(eq(items.tenantId, ctx.tenantId), eq(items.projectId, projectId), sql`${itemSprints.sprintId} IN (${sql.join(sprintIds.map(id => sql`${id}`), sql`, `)})`)) : []
  const sprintItems = new Set(sprintRows.map(row => row.itemId))
  const squadRows = squadIds.length ? await db.select({ userId: memberships.userId }).from(memberships).where(and(eq(memberships.tenantId, ctx.tenantId), eq(memberships.projectId, projectId), sql`${memberships.squadId} IN (${sql.join(squadIds.map(id => sql`${id}`), sql`, `)})`)) : []
  const squadUsers = new Set(squadRows.map(row => row.userId))
  return rows.filter(row => (!modules.length || modules.includes(row.moduleId ?? '')) && (!versions.length || versions.includes(row.versionId ?? '')) && (!assignees.length || assignees.includes(row.assigneeId ?? '')) && (!types.length || types.includes(row.type)) && (!sprintIds.length || sprintItems.has(row.id)) && (!squadIds.length || squadUsers.has(row.assigneeId ?? '')))
}

async function population(ctx: RequestContext, projectId: string) {
  return db.select().from(items).where(and(
    eq(items.tenantId, ctx.tenantId),
    eq(items.projectId, projectId),
    LEAF_POPULATION,
    sql`${items.type} IN ('TASK','BUG')`,
    sql`${items.status} <> 'ARCHIVED'`,
  ))
}

type TransitionRow = { id: string; itemId: string | null; occurredAt: string; afterSnapshot: string | null; beforeSnapshot: string | null }

// Item 13: transições consultadas apenas pelos itens alvo (índice por item),
// nunca varrendo todos os eventos; um JSON.parse por linha retornada.
// [TENANT] sempre escopado por tenant + projeto.
async function transitionsForItems(ctx: RequestContext, projectId: string, itemIds: string[]): Promise<TransitionRow[]> {
  if (itemIds.length === 0) return []
  const rows = await db.select({ id: itemEvents.id, itemId: itemEvents.itemId, occurredAt: itemEvents.occurredAt, afterSnapshot: itemEvents.afterSnapshot, beforeSnapshot: itemEvents.beforeSnapshot })
    .from(itemEvents)
    .where(and(
      eq(itemEvents.tenantId, ctx.tenantId),
      eq(itemEvents.projectId, projectId),
      inArray(itemEvents.itemId, itemIds),
    ))
    .orderBy(asc(itemEvents.occurredAt), asc(itemEvents.sequence), asc(itemEvents.id))
  return rows
}

function snapshotStatus(raw: string | null): string | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { status?: string } | null
    return typeof parsed?.status === 'string' ? parsed.status : null
  } catch { return null }
}

dashboardRouter.get('/snapshot', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!
  const all = await population(ctx, projectId); const rows = await filterPopulation(ctx, projectId, all, name => c.req.query(name))
  const totalPoints = rows.reduce((sum, row) => sum + (row.points ?? 0), 0); const estimated = rows.filter(row => row.points !== null)
  const done = rows.filter(row => row.status === 'DONE'); const wip = rows.filter(row => activeStatuses.has(row.status)); const blocked = rows.filter(row => row.status === 'BLOCKED')
  const distribution = distributionByStatus(rows)
  const byStatus = Object.fromEntries(Object.entries(distribution).map(([status, value]) => [status, value.count]))
  const byStatusPoints = Object.fromEntries(Object.entries(distribution).map(([status, value]) => [status, value.points]))
  const today = new Date().toISOString().slice(0, 10)
  const { overdue, remaining } = overdueGroups(rows, today)
  const detail = (row: typeof rows[number]) => ({ id: row.id, title: row.title, type: row.type, status: row.status, points: row.points, assigneeId: row.assigneeId, dueDate: row.dueDate })
  const memberRows = await db.select({ userId: memberships.userId, squadId: memberships.squadId, userName: users.name, squadName: squads.name }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).leftJoin(squads, and(eq(squads.id, memberships.squadId), eq(squads.tenantId, ctx.tenantId), eq(squads.projectId, projectId))).where(and(eq(memberships.tenantId, ctx.tenantId), eq(memberships.projectId, projectId)))
  const teamRows = wip.filter(row => row.status !== 'BLOCKED')
  const team = memberRows.map(member => { const mine = teamRows.filter(row => row.assigneeId === member.userId); const estimatedMine = mine.filter(row => row.points !== null); return { userId: member.userId, userName: member.userName, squadId: member.squadId, squadName: member.squadName, wipTotal: mine.length, wipPoints: estimatedMine.length ? estimatedMine.reduce((sum, row) => sum + (row.points ?? 0), 0) : null, pointsCoverage: completionPercent(estimatedMine.length, mine.length) } })
  const unassignedRows = teamRows.filter(row => !row.assigneeId); const unassignedEstimated = unassignedRows.filter(row => row.points !== null)
  const unassigned = unassignedRows.length; const teamTotal = teamRows.length; const teamEstimated = teamRows.filter(row => row.points !== null)
  const coverage = await db.query.projectAnalyticsCoverage.findFirst({ where: (row) => and(eq(row.tenantId, ctx.tenantId), eq(row.projectId, projectId)) })
  // Item 13: transições de bloqueio apenas dos itens bloqueados atuais —
  // a consulta por índice substitui a varredura completa por item.
  const transitionByItem = new Map<string, string>()
  for (const event of await transitionsForItems(ctx, projectId, blocked.map(row => row.id))) {
    if (!event.itemId) continue
    if (snapshotStatus(event.afterSnapshot) === 'BLOCKED' && snapshotStatus(event.beforeSnapshot) !== 'BLOCKED') transitionByItem.set(event.itemId, event.occurredAt)
  }
  const now = Date.now()
  const blockedDetails = blocked.map(row => {
    const observedAt = transitionByItem.get(row.id) ?? coverage?.coverageStartedAt ?? null
    const minimumKnown = !transitionByItem.has(row.id)
    return { id: row.id, title: row.title, type: row.type, status: row.status, blockedReason: row.blockedReason, assigneeId: row.assigneeId, dueDate: row.dueDate, blockedAgeDays: observedAt ? Math.max(0, (now - Date.parse(observedAt)) / 86400000) : null, minimumKnown }
  }).sort((a, b) => (b.blockedAgeDays ?? 0) - (a.blockedAgeDays ?? 0))
  return c.json({ coverage: coverage ? { startedAt: coverage.coverageStartedAt, partial: true } : { startedAt: null, partial: true }, filters: { applied: ['moduleId', 'sprintId', 'versionId', 'squadId', 'assigneeId', 'type'], inapplicable: ['from', 'to'] }, boxes: {
    progressScope: { total: rows.length, done: done.length, completionPercent: completionPercent(done.length, rows.length), points: totalPoints, donePoints: done.reduce((sum, row) => sum + (row.points ?? 0), 0), estimationCoverage: completionPercent(estimated.length, rows.length) },
    wip: { total: wip.length, byStatus, byStatusPoints, pointsCoverage: completionPercent(estimated.length, rows.length), items: wip },
    blocked: { total: blocked.length, items: blockedDetails.slice(0, 10) },
    overdue: { total: overdue.length, items: overdue.map(detail), remainingItems: remaining.map(detail) },
    teamLoad: { members: team, unassignedWip: unassigned, unassignedWipPoints: unassignedEstimated.length ? unassignedEstimated.reduce((sum, row) => sum + (row.points ?? 0), 0) : null, pointsCoverage: completionPercent(teamEstimated.length, teamTotal) },
  } })
})

dashboardRouter.get('/hours', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!; const from = c.req.query('from'); const to = c.req.query('to')
  const periodError = period(from, to); if (periodError) return c.json({ error: periodError }, 422)
  const sprintId = c.req.query('sprintId');
  if (sprintId) { const sprint = await db.query.sprints.findFirst({ where: row => and(eq(row.id, sprintId), eq(row.tenantId, ctx.tenantId), eq(row.projectId, projectId)) }); if (!sprint) return c.json({ error: 'Sprint não encontrada neste projeto' }, 404) }
  const sprintExists = sprintId ? sql`EXISTS (SELECT 1 FROM item_sprints dashboard_sprint WHERE dashboard_sprint.item_id = ${items.id} AND dashboard_sprint.sprint_id = ${sprintId})` : undefined
  const author = c.req.query('authorId'); const squadId = c.req.query('squadId'); const moduleIds = csv(c.req.query('moduleId')); const versionIds = csv(c.req.query('versionId')); const types = csv(c.req.query('type'))
  // Item 13: filtros aplicados em SQL (inArray parametrizado), total por
  // agregação e linhas paginadas com ordenação determinística.
  // [TENANT] Escopo aplicado na consulta, não em memória.
  const where = and(
    eq(itemLogs.tenantId, ctx.tenantId),
    eq(itemLogs.type, 'manual'),
    sql`${itemLogs.durationMin} > 0`,
    ...(from ? [gte(itemLogs.createdAt, from)] : []),
    ...(to ? [lte(itemLogs.createdAt, `${to}T23:59:59.999Z`)] : []),
    ...(sprintExists ? [sprintExists] : []),
    ...(author ? [eq(itemLogs.authorId, author)] : []),
    ...(squadId ? [eq(memberships.squadId, squadId)] : []),
    ...(!moduleIds.length ? [] : [sql`${items.moduleId} IN (${sql.join(moduleIds.map(id => sql`${id}`), sql`, `)})`]),
    ...(!versionIds.length ? [] : [sql`${items.versionId} IN (${sql.join(versionIds.map(id => sql`${id}`), sql`, `)})`]),
    ...(!types.length ? [] : [sql`${items.type} IN (${sql.join(types.map(id => sql`${id}`), sql`, `)})`]),
  )
  // Item 13: total por agregação SQL na MESMA cadeia de joins (filtros de
  // sprint/módulo/versão/tipo exigem o join) e linhas paginadas com ordenação
  // determinística. [TENANT] Escopo e filtros aplicados na consulta.
  const totalQuery = () => db.select({ totalMinutes: sql<number>`COALESCE(SUM(${itemLogs.durationMin}), 0)` }).from(itemLogs).innerJoin(items, and(eq(items.id, itemLogs.itemId), eq(items.tenantId, ctx.tenantId), eq(items.projectId, projectId))).leftJoin(users, and(eq(users.id, itemLogs.authorId), eq(users.tenantId, ctx.tenantId))).leftJoin(memberships, and(eq(memberships.userId, itemLogs.authorId), eq(memberships.tenantId, ctx.tenantId), eq(memberships.projectId, projectId))).leftJoin(squads, and(eq(squads.id, memberships.squadId), eq(squads.tenantId, ctx.tenantId), eq(squads.projectId, projectId)))
  const totals = await totalQuery().where(where)
  const totalMinutes = totals[0]?.totalMinutes ?? 0
  const limitRaw = Number.parseInt(c.req.query('limit') ?? String(HOURS_ROW_LIMIT_DEFAULT), 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), HOURS_ROW_LIMIT_MAX) : HOURS_ROW_LIMIT_DEFAULT
  const logs = await db.select({ log: itemLogs, item: items, membership: memberships, squadName: squads.name, authorName: users.name }).from(itemLogs).innerJoin(items, and(eq(items.id, itemLogs.itemId), eq(items.tenantId, ctx.tenantId), eq(items.projectId, projectId))).leftJoin(users, and(eq(users.id, itemLogs.authorId), eq(users.tenantId, ctx.tenantId))).leftJoin(memberships, and(eq(memberships.userId, itemLogs.authorId), eq(memberships.tenantId, ctx.tenantId), eq(memberships.projectId, projectId))).leftJoin(squads, and(eq(squads.id, memberships.squadId), eq(squads.tenantId, ctx.tenantId), eq(squads.projectId, projectId))).where(where).orderBy(asc(itemLogs.createdAt), asc(itemLogs.id)).limit(limit)
  return c.json({ semantics: 'manual durationMin, grouped by log author and current author squad; createdAt is the registration date', totalMinutes, limit, rows: logs.map(row => ({ authorId: row.log.authorId, authorName: row.authorName, squadName: row.squadName, itemId: row.item.id, versionId: row.item.versionId, moduleId: row.item.moduleId, durationMin: row.log.durationMin, createdAt: row.log.createdAt })) })
})

dashboardRouter.get('/burnup', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!; const from = c.req.query('from'); const to = c.req.query('to'); const periodError = period(from, to); if (periodError) return c.json({ error: periodError }, 422)
  const coverage = await db.query.projectAnalyticsCoverage.findFirst({ where: (row) => and(eq(row.tenantId, ctx.tenantId), eq(row.projectId, projectId)) }); if (!coverage) return c.json({ partial: true, series: [] })
  const requestedStart = from && from > coverage.coverageStartedAt.slice(0, 10) ? from : coverage.coverageStartedAt.slice(0, 10); const requestedEnd = to ?? new Date().toISOString().slice(0, 10)
  const modules = csv(c.req.query('moduleId')); const versions = csv(c.req.query('versionId')); const types = csv(c.req.query('type')); const sprintIds = csv(c.req.query('sprintId'))
  if (!modules.length && !versions.length && !types.length && !sprintIds.length) {
    // Item 13: caminho padrão — leitura direta do rollup diário.
    const rollup = await readDailyRollupSeries(db, ctx.tenantId, projectId, coverage.coverageStartedAt.slice(0, 10), requestedEnd)
    const series = fillDailySeries(rollup, requestedStart, requestedEnd, { total: 0, done: 0, points: 0, donePoints: 0 })
    return c.json({ partial: true, coverageStartedAt: coverage.coverageStartedAt, filters: { applied: ['from', 'to', 'moduleId', 'sprintId', 'versionId', 'type'], inapplicable: ['squadId', 'assigneeId'] }, series })
  }
  const events = await db.select().from(itemEvents).where(and(eq(itemEvents.tenantId, ctx.tenantId), eq(itemEvents.projectId, projectId), gte(itemEvents.occurredAt, coverage.coverageStartedAt), lte(itemEvents.occurredAt, `${requestedEnd}T23:59:59.999Z`))).orderBy(asc(itemEvents.occurredAt), asc(itemEvents.sequence), asc(itemEvents.id))
  // Item 13: replay com estado persistente e acumuladores incrementais —
  // cada evento aplica um delta, nenhum array completo é recriado por evento.
  type BurnState = { status: string; type: string; isLeaf: boolean; points: number | null; moduleId?: string | null; versionId?: string | null; sprintIds?: string[] }
  const state = new Map<string, BurnState>()
  const baseline = events.find(event => event.eventType === 'ANALYTICS_BASELINE')
  if (baseline?.afterSnapshot) for (const row of JSON.parse(baseline.afterSnapshot) as Array<{ itemId: string } & BurnState>) state.set(row.itemId, row)
  const matches = (row: BurnState) => (!modules.length || modules.includes(row.moduleId ?? '')) && (!versions.length || versions.includes(row.versionId ?? '')) && (!types.length || types.includes(row.type)) && (!sprintIds.length || sprintIds.some(id => row.sprintIds?.includes(id)))
  const countersOf = (row: BurnState | null) => {
    if (!row || !isEligibleLeaf(row, row.isLeaf) || !matches(row)) return { total: 0, done: 0, points: 0, donePoints: 0 }
    const points = row.points ?? 0
    return row.status === 'DONE'
      ? { total: 1, done: 1, points, donePoints: points }
      : { total: 1, done: 0, points, donePoints: 0 }
  }
  const cur = { total: 0, done: 0, points: 0, donePoints: 0 }
  let curInitialized = false
  const byDay = new Map<string, { total: number; done: number; points: number; donePoints: number }>()
  for (const event of events) {
    const key = event.occurredAt.slice(0, 10)
    const prevState = event.itemId ? (state.get(event.itemId) ?? null) : null
    if (event.itemId && (event.eventType === 'ITEM_DELETED' || event.eventType === 'ITEM_ARCHIVED')) state.delete(event.itemId); else if (event.itemId && event.afterSnapshot) state.set(event.itemId, JSON.parse(event.afterSnapshot) as BurnState)
    if (!(key >= requestedStart)) continue
    if (!curInitialized) {
      // Primeiro evento do período pedido: semeia contadores com o estado atual
      curInitialized = true
      const values = [...state.values()].filter(row => isEligibleLeaf(row, row.isLeaf) && matches(row))
      cur.total = values.length
      cur.done = values.filter(row => row.status === 'DONE').length
      cur.points = values.reduce((sum, row) => sum + (row.points ?? 0), 0)
      cur.donePoints = values.filter(row => row.status === 'DONE').reduce((sum, row) => sum + (row.points ?? 0), 0)
    } else {
      const before = countersOf(prevState)
      const after = countersOf(event.itemId ? (state.get(event.itemId) ?? null) : null)
      cur.total += after.total - before.total
      cur.done += after.done - before.done
      cur.points += after.points - before.points
      cur.donePoints += after.donePoints - before.donePoints
    }
    byDay.set(key, { ...cur })
  }
  const series = fillDailySeries(byDay, requestedStart, requestedEnd, { total: 0, done: 0, points: 0, donePoints: 0 })
  return c.json({ partial: true, coverageStartedAt: coverage.coverageStartedAt, filters: { applied: ['from', 'to', 'moduleId', 'sprintId', 'versionId', 'type'], inapplicable: ['squadId', 'assigneeId'] }, series })
})

dashboardRouter.get('/aging', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!; const rows = await filterPopulation(ctx, projectId, await population(ctx, projectId), name => c.req.query(name)); const coverage = await db.query.projectAnalyticsCoverage.findFirst({ where: (row) => and(eq(row.tenantId, ctx.tenantId), eq(row.projectId, projectId)) })
  const wipRows = rows.filter(row => activeStatuses.has(row.status))
  // Item 13: eventos limitados aos itens WIP; o ÚLTIMO evento iniciador
  // (after ativo e before inativo/orfão) determina o início do ciclo.
  const startedAtByItem = new Map<string, string>()
  for (const event of await transitionsForItems(ctx, projectId, wipRows.map(row => row.id))) {
    if (!event.itemId) continue
    const nextActive = activeStatuses.has(snapshotStatus(event.afterSnapshot) ?? '')
    const beforeActive = activeStatuses.has(snapshotStatus(event.beforeSnapshot) ?? '')
    if (nextActive && !beforeActive) startedAtByItem.set(event.itemId, event.occurredAt)
  }
  const now = Date.now(); const result = wipRows.map(row => { const startedAt = startedAtByItem.get(row.id) ?? coverage?.coverageStartedAt ?? row.createdAt; return { id: row.id, title: row.title, type: row.type, status: row.status, blockedReason: row.blockedReason, assigneeId: row.assigneeId, startedAt, ageHours: Math.max(0, (now - Date.parse(startedAt)) / 3600000), minimumKnown: !startedAtByItem.has(row.id) } })
  return c.json({ coverageStartedAt: coverage?.coverageStartedAt ?? null, items: result })
})

dashboardRouter.get('/sprints/:cycleId', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!; const cycleId = c.req.param('cycleId')!; const cycle = await db.query.sprintCycles.findFirst({ where: (row) => and(eq(row.id, cycleId), eq(row.tenantId, ctx.tenantId), eq(row.projectId, projectId)) }); if (!cycle) return c.json({ error: 'Ciclo não encontrado' }, 404)
  const committed = await db.select().from(sprintCycleItems).where(and(eq(sprintCycleItems.cycleId, cycleId), eq(sprintCycleItems.tenantId, ctx.tenantId), eq(sprintCycleItems.projectId, projectId), eq(sprintCycleItems.isLeaf, true)))
  const cutoff = cycle.endedAt && Date.parse(cycle.endedAt) < Date.now() ? cycle.endedAt : new Date().toISOString()
  // Item 13: baseline isolada (1 consulta) + replay somente dos eventos do ciclo
  const baseline = await db.query.itemEvents.findFirst({ where: (row) => and(eq(row.tenantId, ctx.tenantId), eq(row.projectId, projectId), eq(row.eventType, 'ANALYTICS_BASELINE')), orderBy: (row, helpers) => [helpers.asc(row.occurredAt), helpers.asc(row.sequence)] })
  const events = await db.select().from(itemEvents).where(and(eq(itemEvents.tenantId, ctx.tenantId), eq(itemEvents.projectId, projectId), gte(itemEvents.occurredAt, cycle.startedAt), lte(itemEvents.occurredAt, cutoff))).orderBy(asc(itemEvents.occurredAt), asc(itemEvents.sequence), asc(itemEvents.id))
  const state = new Map<string, { status: string; isLeaf: boolean; sprintIds: string[] }>()
  if (baseline?.afterSnapshot) for (const row of JSON.parse(baseline.afterSnapshot) as Array<{ itemId: string; status: string; isLeaf: boolean; sprintIds?: string[] }>) state.set(row.itemId, { status: row.status, isLeaf: row.isLeaf, sprintIds: row.sprintIds ?? [] })
  for (const row of committed) state.set(row.itemId, { status: row.status, isLeaf: row.isLeaf, sprintIds: [cycle.sprintId] })
  for (const event of events) if (event.itemId && event.eventType === 'ITEM_DELETED') state.delete(event.itemId); else if (event.itemId && event.afterSnapshot) { const next = JSON.parse(event.afterSnapshot) as { status: string; isLeaf: boolean; sprintIds?: string[] }; state.set(event.itemId, { status: next.status, isLeaf: next.isLeaf, sprintIds: next.sprintIds ?? [] }) }
  const current = [...state.values()].filter(row => row.isLeaf && row.sprintIds.includes(cycle.sprintId) && row.status !== 'ARCHIVED')
  return c.json({ cycle, commitment: committed.length, committedDone: committed.filter(row => row.status === 'DONE').length, currentScope: current.length, currentDone: current.filter(row => row.status === 'DONE').length, uncompletedCommitment: committed.filter(row => !['DONE', 'CANCELLED'].includes(row.status)).length })
})

dashboardRouter.get('/sprints', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!
  const cycles = await db.select().from(sprintCycles).where(and(eq(sprintCycles.tenantId, ctx.tenantId), eq(sprintCycles.projectId, projectId))).orderBy(asc(sprintCycles.startedAt), asc(sprintCycles.id))
  return c.json({ cycles })
})
