import { Hono } from 'hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import type { HonoEnv } from '../types/hono'
import type { RequestContext } from '@azy-board/api-contracts'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'
import type { DashboardHoursFilter, DashboardPopulationFilter, } from '../persistence/models'
import { createDashboardCursor, parseDashboardPageSize, readDashboardCursor } from '../services/dashboardCursor'

export const dashboardRouter = new Hono<HonoEnv>()
dashboardRouter.use('*', authMiddleware)
dashboardRouter.use('*', async (c, next) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!
  const exists = await persistence.dashboard.projectExists(userPersistenceContext(ctx), projectId)
  if (!exists) return c.json({ error: 'Projeto não encontrado', code: 'RESOURCE_NOT_FOUND', retryable: false }, 404)
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
export function period(from?: string, to?: string) {
  if (!from && !to) return null
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return 'from e to devem ser datas UTC no formato AAAA-MM-DD'
  const start = Date.parse(`${from}T00:00:00.000Z`); const end = Date.parse(`${to}T23:59:59.999Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return 'Período inválido'
  if (end - start > MAX_PERIOD_DAYS * 86400000) return `O período máximo é de ${MAX_PERIOD_DAYS} dias`
  return null
}

function populationFilter(query: (name: string) => string | undefined): DashboardPopulationFilter {
  return {
    moduleIds: csv(query('moduleId')),
    versionIds: csv(query('versionId')),
    assigneeIds: csv(query('assigneeId')),
    types: csv(query('type')),
    sprintIds: csv(query('sprintId')),
    squadIds: csv(query('squadId')),
  }
}

dashboardRouter.get('/snapshot', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!
  const projectContext = userPersistenceContext(ctx)
  const filter = populationFilter(name => c.req.query(name))
  const limit = parseDashboardPageSize(c.req.query('limit'))
  if (limit === null) return c.json({ error: 'limit deve ser um inteiro entre 1 e 100' }, 422)
  const scope = (collection: string, order: string) => ({ tenantId: ctx.tenantId, projectId, collection, filters: filter, order })
  const readPosition = (name: string, collection: string, order: string, kind: 'id' | 'age') => {
    const token = c.req.query(name)
    if (token === undefined) return { position: null as { id: string; startedAt?: string } | null, invalid: false }
    const value = readDashboardCursor(scope(collection, order), token)
    if (!value || typeof value !== 'object' || Array.isArray(value) || typeof (value as Record<string, unknown>).id !== 'string'
      || (kind === 'age' && typeof (value as Record<string, unknown>).startedAt !== 'string')) return { position: null, invalid: true }
    return { position: value as { id: string; startedAt?: string }, invalid: false }
  }
  const wipCursor = readPosition('wipCursor', 'snapshot-wip', 'startedAt,id:asc', 'age')
  const blockedCursor = readPosition('blockedCursor', 'snapshot-blocked', 'startedAt,id:asc', 'age')
  const overdueCursor = readPosition('overdueCursor', 'snapshot-overdue', 'id:asc', 'id')
  const remainingCursor = readPosition('remainingCursor', 'snapshot-remaining', 'id:asc', 'id')
  if (wipCursor.invalid || blockedCursor.invalid || overdueCursor.invalid || remainingCursor.invalid) {
    return c.json({ error: 'Cursor inválido ou pertencente a outro escopo/filtro' }, 422)
  }
  const today = new Date().toISOString().slice(0, 10)
  const [aggregates, wipRowsExtra, blockedRowsExtra, overdueRowsExtra, remainingRowsExtra] = await Promise.all([
    persistence.dashboard.aggregateLeafItems(projectContext, projectId, filter, today),
    persistence.dashboard.listAgingDetailPage(projectContext, projectId, filter, 'WIP', limit + 1, wipCursor.position?.startedAt ? { startedAt: wipCursor.position.startedAt, id: wipCursor.position.id } : undefined),
    persistence.dashboard.listAgingDetailPage(projectContext, projectId, filter, 'BLOCKED', limit + 1, blockedCursor.position?.startedAt ? { startedAt: blockedCursor.position.startedAt, id: blockedCursor.position.id } : undefined),
    persistence.dashboard.listLeafItems(projectContext, projectId, filter, { limit: limit + 1, overdue: { asOf: today, match: true }, ...(overdueCursor.position ? { afterId: overdueCursor.position.id } : {}) }),
    persistence.dashboard.listLeafItems(projectContext, projectId, filter, { limit: limit + 1, overdue: { asOf: today, match: false }, ...(remainingCursor.position ? { afterId: remainingCursor.position.id } : {}) }),
  ])
  const sum = (groups: typeof aggregates, select: 'count' | 'estimatedCount' | 'points' | 'donePoints' | 'overdueCount' | 'overduePoints') => groups.reduce((total, group) => total + group[select], 0)
  const byStatus = Object.fromEntries(['DONE', 'IN_PROGRESS', 'BLOCKED', 'NOT_STARTED'].map(status => [status, sum(aggregates.filter(row => row.status === status), 'count')]))
  const byStatusPoints = Object.fromEntries(['DONE', 'IN_PROGRESS', 'BLOCKED', 'NOT_STARTED'].map(status => [status, sum(aggregates.filter(row => row.status === status), 'points')]))
  const total = sum(aggregates, 'count'); const done = sum(aggregates.filter(row => row.status === 'DONE'), 'count')
  const totalPoints = sum(aggregates, 'points'); const donePoints = sum(aggregates, 'donePoints'); const estimatedCount = sum(aggregates, 'estimatedCount')
  const activeAggregates = aggregates.filter(row => activeStatuses.has(row.status))
  const blockedTotal = sum(aggregates.filter(row => row.status === 'BLOCKED'), 'count')
  const wipTotal = sum(activeAggregates, 'count')
  const overdueTotal = sum(aggregates, 'overdueCount')
  const overduePoints = sum(aggregates, 'overduePoints')
  const wipHasMore = wipRowsExtra.length > limit; const wipRows = wipHasMore ? wipRowsExtra.slice(0, limit) : wipRowsExtra
  const blockedHasMore = blockedRowsExtra.length > limit; const blockedRows = blockedHasMore ? blockedRowsExtra.slice(0, limit) : blockedRowsExtra
  const overdueHasMore = overdueRowsExtra.length > limit; const overdueRows = overdueHasMore ? overdueRowsExtra.slice(0, limit) : overdueRowsExtra
  const remainingHasMore = remainingRowsExtra.length > limit; const remainingRows = remainingHasMore ? remainingRowsExtra.slice(0, limit) : remainingRowsExtra
  const wipLast = wipRows.at(-1); const blockedLast = blockedRows.at(-1); const overdueLast = overdueRows.at(-1); const remainingLast = remainingRows.at(-1)
  const detailsPagination = {
    wip: { limit, total: wipTotal, hasMore: wipHasMore, truncated: wipHasMore, nextCursor: wipHasMore && wipLast ? createDashboardCursor(scope('snapshot-wip', 'startedAt,id:asc'), { startedAt: wipLast.startedAt, id: wipLast.id }) : null },
    blocked: { limit, total: blockedTotal, hasMore: blockedHasMore, truncated: blockedHasMore, nextCursor: blockedHasMore && blockedLast ? createDashboardCursor(scope('snapshot-blocked', 'startedAt,id:asc'), { startedAt: blockedLast.startedAt, id: blockedLast.id }) : null },
    overdue: { limit, total: overdueTotal, hasMore: overdueHasMore, truncated: overdueHasMore, nextCursor: overdueHasMore && overdueLast ? createDashboardCursor(scope('snapshot-overdue', 'id:asc'), { id: overdueLast.id }) : null },
    remaining: { limit, total: total - overdueTotal, hasMore: remainingHasMore, truncated: remainingHasMore, nextCursor: remainingHasMore && remainingLast ? createDashboardCursor(scope('snapshot-remaining', 'id:asc'), { id: remainingLast.id }) : null },
  }
  const detail = (row: typeof overdueRows[number]) => ({ id: row.id, title: row.title, type: row.type, status: row.status, points: row.points, assigneeId: row.assigneeId, dueDate: row.dueDate })
  const memberRows = await persistence.dashboard.listMembersWithSquads(projectContext, projectId)
  // WIP inclui bloqueados; blockedSubset é informativo e não aditivo.
  const forAssignee = (assigneeId: string | null) => activeAggregates.filter(row => row.assigneeId === assigneeId)
  const team = memberRows.map(member => {
    const mine = forAssignee(member.userId); const blockedMine = mine.filter(row => row.status === 'BLOCKED')
    const mineCount = sum(mine, 'count'); const mineEstimated = sum(mine, 'estimatedCount'); const blockedEstimated = sum(blockedMine, 'estimatedCount')
    return { userId: member.userId, userName: member.userName, squadId: member.squadId, squadName: member.squadName, wipTotal: mineCount, blockedSubset: sum(blockedMine, 'count'), wipPoints: mineEstimated ? sum(mine, 'points') : null, blockedPoints: blockedEstimated ? sum(blockedMine, 'points') : null, pointsCoverage: completionPercent(mineEstimated, mineCount) }
  })
  const unassignedRows = forAssignee(null); const unassignedBlocked = unassignedRows.filter(row => row.status === 'BLOCKED')
  const unassignedEstimated = sum(unassignedRows, 'estimatedCount'); const unassignedBlockedEstimated = sum(unassignedBlocked, 'estimatedCount')
  const unassigned = sum(unassignedRows, 'count'); const teamTotal = wipTotal; const teamEstimated = sum(activeAggregates, 'estimatedCount')
  const coverage = await persistence.dashboard.getCoverage(projectContext, projectId)
  const now = Date.now()
  const wip = wipRows.map(row => ({
    id: row.id, title: row.title, type: row.type, status: row.status, points: row.points,
    assigneeId: row.assigneeId, dueDate: row.dueDate, startedAt: row.startedAt,
    ageHours: Math.max(0, (now - Date.parse(row.startedAt)) / 3600000), minimumKnown: row.minimumKnown,
  }))
  const blockedDetails = blockedRows.map(row => ({
    id: row.id, title: row.title, type: row.type, status: row.status, blockedReason: row.blockedReason,
    assigneeId: row.assigneeId, dueDate: row.dueDate,
    blockedAgeDays: Math.max(0, (now - Date.parse(row.startedAt)) / 86400000), minimumKnown: row.minimumKnown,
  }))
  return c.json({ coverage: coverage ? { startedAt: coverage.coverageStartedAt, partial: true } : { startedAt: null, partial: true }, filters: { applied: ['moduleId', 'sprintId', 'versionId', 'squadId', 'assigneeId', 'type'], inapplicable: ['from', 'to'] }, boxes: {
      progressScope: { total, done, completionPercent: completionPercent(done, total), points: totalPoints, donePoints, estimationCoverage: completionPercent(estimatedCount, total) },
      wip: { total: wipTotal, byStatus, byStatusPoints, pointsCoverage: completionPercent(estimatedCount, total), items: wip, pagination: detailsPagination.wip },
      blocked: { total: blockedTotal, items: blockedDetails, pagination: detailsPagination.blocked },
      overdue: { total: overdueTotal, points: overduePoints, items: overdueRows.map(detail), remainingItems: remainingRows.map(detail), pagination: detailsPagination.overdue, remainingPagination: detailsPagination.remaining },
     teamLoad: { members: team, unassignedWip: unassigned, blockedUnassignedSubset: sum(unassignedBlocked, 'count'), unassignedWipPoints: unassignedEstimated ? sum(unassignedRows, 'points') : null, blockedUnassignedPoints: unassignedBlockedEstimated ? sum(unassignedBlocked, 'points') : null, pointsCoverage: completionPercent(teamEstimated, teamTotal) },
  } })
})

dashboardRouter.get('/hours', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!; const from = c.req.query('from'); const to = c.req.query('to')
  const periodError = period(from, to); if (periodError) return c.json({ error: periodError }, 422)
  const sprintId = c.req.query('sprintId')
  const projectContext = userPersistenceContext(ctx)
  if (sprintId) { const sprint = await persistence.planning.getSprint(projectContext, projectId, sprintId); if (!sprint) return c.json({ error: 'Sprint não encontrada neste projeto' }, 404) }
  const filter: DashboardHoursFilter = {
    ...(from ? { from } : {}), ...(to ? { to } : {}), ...(sprintId ? { sprintId } : {}),
    ...(c.req.query('authorId') ? { authorId: c.req.query('authorId') } : {}),
    ...(c.req.query('squadId') ? { squadId: c.req.query('squadId') } : {}),
    moduleIds: csv(c.req.query('moduleId')), versionIds: csv(c.req.query('versionId')), types: csv(c.req.query('type')),
  }
   const limit = parseDashboardPageSize(c.req.query('limit'))
   if (limit === null) return c.json({ error: 'limit deve ser um inteiro entre 1 e 100' }, 422)
   const cursorToken = c.req.query('cursor')
   const cursorScope = { tenantId: ctx.tenantId, projectId, collection: 'hours', filters: filter, order: 'createdAt,id:asc' }
   const position = cursorToken === undefined ? null : readDashboardCursor(cursorScope, cursorToken)
   if (cursorToken !== undefined && (!position || typeof position !== 'object' || Array.isArray(position)
     || typeof (position as Record<string, unknown>).createdAt !== 'string' || typeof (position as Record<string, unknown>).id !== 'string')) {
     return c.json({ error: 'Cursor inválido ou pertencente a outro escopo/filtro' }, 422)
   }
   const after = position as { createdAt: string; id: string } | null
   const result = await persistence.dashboard.listHoursLogs(projectContext, projectId, filter, limit + 1, after ?? undefined)
   const hasMore = result.rows.length > limit
   const rows = hasMore ? result.rows.slice(0, limit) : result.rows
   const last = rows.at(-1)
   const nextCursor = hasMore && last ? createDashboardCursor(cursorScope, { createdAt: last.createdAt, id: last.id }) : null
   const pagination = { limit, total: result.totalRows, hasMore, truncated: hasMore, nextCursor }
   return c.json({ semantics: 'manual durationMin, grouped by log author and current author squad; createdAt is the registration date', totalMinutes: result.totalMinutes, totalRows: result.totalRows, limit, pagination, byAuthor: result.byAuthor, rows })
})

dashboardRouter.get('/burnup', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!; const from = c.req.query('from'); const to = c.req.query('to'); const periodError = period(from, to); if (periodError) return c.json({ error: periodError }, 422)
  const projectContext = userPersistenceContext(ctx)
  const coverage = await persistence.dashboard.getCoverage(projectContext, projectId); if (!coverage) return c.json({ partial: true, warnings: ['ANALYTICS_COVERAGE_MISSING'], series: [] })
  const requestedStart = from && from > coverage.coverageStartedAt.slice(0, 10) ? from : coverage.coverageStartedAt.slice(0, 10); const requestedEnd = to ?? new Date().toISOString().slice(0, 10)
  const modules = csv(c.req.query('moduleId')); const versions = csv(c.req.query('versionId')); const types = csv(c.req.query('type')); const sprintIds = csv(c.req.query('sprintId'))
  if (!modules.length && !versions.length && !types.length && !sprintIds.length) {
    // Item 13: caminho padrão — leitura direta do rollup diário.
    const rollupRows = await persistence.analytics.readProjectRollup(projectContext, projectId, coverage.coverageStartedAt.slice(0, 10), requestedEnd)
    const rollup = new Map(rollupRows.map(row => [row.date, { total: row.total, done: row.done, points: row.points, donePoints: row.donePoints }]))
    const series = fillDailySeries(rollup, requestedStart, requestedEnd, { total: 0, done: 0, points: 0, donePoints: 0 })
     return c.json({ partial: true, coverageStartedAt: coverage.coverageStartedAt, projection: { status: 'ROLLUP' }, warnings: [], filters: { applied: ['from', 'to', 'moduleId', 'sprintId', 'versionId', 'type'], inapplicable: ['squadId', 'assigneeId'] }, series })
  }
  const projection = await persistence.dashboard.getDimensionProjectionMeta(projectContext, projectId)
  if (projection?.status === 'READY' && projection.projectionVersion === 1) {
    const projectedRows = await persistence.dashboard.listDimensionSnapshots(projectContext, projectId, { moduleIds: modules, versionIds: versions, assigneeIds: [], types, sprintIds, squadIds: [] }, requestedStart, requestedEnd)
    const state = new Map<string, { total: number; done: number; points: number; donePoints: number }>()
    const current = { total: 0, done: 0, points: 0, donePoints: 0 }
    const byDay = new Map<string, { total: number; done: number; points: number; donePoints: number }>()
    for (const row of projectedRows) {
      const key = JSON.stringify([row.moduleKey, row.versionKey, row.sprintSetHash, row.sprintIdsJson, row.type])
      const before = state.get(key) ?? { total: 0, done: 0, points: 0, donePoints: 0 }
      const after = { total: row.total, done: row.done, points: row.points, donePoints: row.donePoints }
      current.total += after.total - before.total
      current.done += after.done - before.done
      current.points += after.points - before.points
      current.donePoints += after.donePoints - before.donePoints
      state.set(key, after)
      if (row.metricDate >= requestedStart) byDay.set(row.metricDate, { ...current })
    }
    const series = fillDailySeries(byDay, requestedStart, requestedEnd, { total: 0, done: 0, points: 0, donePoints: 0 })
    return c.json({ partial: true, coverageStartedAt: coverage.coverageStartedAt, projection: { status: 'READY', version: projection.projectionVersion }, warnings: [], filters: { applied: ['from', 'to', 'moduleId', 'sprintId', 'versionId', 'type'], inapplicable: ['squadId', 'assigneeId'] }, series })
  }
  const events = await persistence.dashboard.listEvents(projectContext, projectId, coverage.coverageStartedAt, `${requestedEnd}T23:59:59.999Z`)
  // Item 13: replay com estado persistente e acumuladores incrementais.
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
  return c.json({ partial: true, coverageStartedAt: coverage.coverageStartedAt, projection: { status: 'FALLBACK', version: projection?.projectionVersion ?? null, sourceStatus: projection?.status ?? 'MISSING' }, warnings: ['DASHBOARD_DIMENSION_PROJECTION_FALLBACK'], filters: { applied: ['from', 'to', 'moduleId', 'sprintId', 'versionId', 'type'], inapplicable: ['squadId', 'assigneeId'] }, series })
})

dashboardRouter.get('/aging', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!
  const projectContext = userPersistenceContext(ctx)
  const filter = populationFilter(name => c.req.query(name))
  const limit = parseDashboardPageSize(c.req.query('limit'))
  if (limit === null) return c.json({ error: 'limit deve ser um inteiro entre 1 e 100' }, 422)
  const cursorScope = { tenantId: ctx.tenantId, projectId, collection: 'aging', filters: filter, order: 'startedAt,id:asc' }
  const cursorToken = c.req.query('cursor')
  const position = cursorToken === undefined ? null : readDashboardCursor(cursorScope, cursorToken)
  if (cursorToken !== undefined && (!position || typeof position !== 'object' || Array.isArray(position)
    || typeof (position as Record<string, unknown>).startedAt !== 'string' || typeof (position as Record<string, unknown>).id !== 'string')) {
    return c.json({ error: 'Cursor inválido ou pertencente a outro escopo/filtro' }, 422)
  }
  const after = position as { startedAt: string; id: string } | null
  const today = new Date().toISOString().slice(0, 10)
  const [aggregates, rowsExtra, coverage] = await Promise.all([
    persistence.dashboard.aggregateLeafItems(projectContext, projectId, filter, today),
    persistence.dashboard.listAgingDetailPage(projectContext, projectId, filter, 'WIP', limit + 1, after ?? undefined),
    persistence.dashboard.getCoverage(projectContext, projectId),
  ])
  const total = aggregates.filter(row => activeStatuses.has(row.status)).reduce((sum, row) => sum + row.count, 0)
  const hasMore = rowsExtra.length > limit
  const rows = hasMore ? rowsExtra.slice(0, limit) : rowsExtra
  const now = Date.now()
  const items = rows.map(row => ({
    id: row.id, title: row.title, type: row.type, status: row.status, blockedReason: row.blockedReason,
    assigneeId: row.assigneeId, startedAt: row.startedAt,
    ageHours: Math.max(0, (now - Date.parse(row.startedAt)) / 3600000), minimumKnown: row.minimumKnown,
  }))
  const last = rows.at(-1)
  const pagination = {
    limit, total, hasMore, truncated: hasMore,
    nextCursor: hasMore && last ? createDashboardCursor(cursorScope, { startedAt: last.startedAt, id: last.id }) : null,
  }
  return c.json({ coverageStartedAt: coverage?.coverageStartedAt ?? null, total, pagination, items })
})

dashboardRouter.get('/sprints/:cycleId', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!; const cycleId = c.req.param('cycleId')!
  const projectContext = userPersistenceContext(ctx)
  const cycle = await persistence.dashboard.getSprintCycle(projectContext, projectId, cycleId); if (!cycle) return c.json({ error: 'Ciclo não encontrado' }, 404)
  const commitment = await persistence.dashboard.getSprintCycleCommitmentCounts(projectContext, projectId, cycleId)
  const cutoff = cycle.endedAt && Date.parse(cycle.endedAt) < Date.now() ? cycle.endedAt : new Date().toISOString()
  let currentScope: number
  let currentDone: number
  if (!cycle.endedAt) {
    // Ciclo ativo: estado vigente por join/Leaf Rule set-based, sem replay de eventos.
    ({ currentScope, currentDone } = await persistence.dashboard.getCurrentSprintCycleCounts(projectContext, projectId, cycle.sprintId))
  } else {
    // Ciclo encerrado: replay até o instante de fechamento preserva sua fotografia histórica.
    const committed = await persistence.dashboard.listSprintCycleItems(projectContext, projectId, cycleId)
    const baseline = await persistence.dashboard.getBaselineEvent(projectContext, projectId)
    const events = await persistence.dashboard.listEvents(projectContext, projectId, cycle.startedAt, cutoff)
    const state = new Map<string, { status: string; isLeaf: boolean; sprintIds: string[] }>()
    if (baseline?.afterSnapshot) for (const row of JSON.parse(baseline.afterSnapshot) as Array<{ itemId: string; status: string; isLeaf: boolean; sprintIds?: string[] }>) state.set(row.itemId, { status: row.status, isLeaf: row.isLeaf, sprintIds: row.sprintIds ?? [] })
    for (const row of committed) state.set(row.itemId, { status: row.status, isLeaf: row.isLeaf, sprintIds: [cycle.sprintId] })
    for (const event of events) if (event.itemId && event.eventType === 'ITEM_DELETED') state.delete(event.itemId); else if (event.itemId && event.afterSnapshot) { const next = JSON.parse(event.afterSnapshot) as { status: string; isLeaf: boolean; sprintIds?: string[] }; state.set(event.itemId, { status: next.status, isLeaf: next.isLeaf, sprintIds: next.sprintIds ?? [] }) }
    const current = [...state.values()].filter(row => row.isLeaf && row.sprintIds.includes(cycle.sprintId) && row.status !== 'ARCHIVED')
    currentScope = current.length
    currentDone = current.filter(row => row.status === 'DONE').length
  }
  return c.json({ cycle, ...commitment, currentScope, currentDone })
})

dashboardRouter.get('/sprints', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!
  const limit = parseDashboardPageSize(c.req.query('limit'))
  if (limit === null) return c.json({ error: 'limit deve ser um inteiro entre 1 e 100' }, 422)
  const projectContext = userPersistenceContext(ctx)
  const scope = { tenantId: ctx.tenantId, projectId, collection: 'sprint-cycles', filters: {}, order: 'startedAt,id:asc' }
  const token = c.req.query('cursor')
  const position = token === undefined ? null : readDashboardCursor(scope, token)
  if (token !== undefined && (!position || typeof position !== 'object' || Array.isArray(position)
    || typeof (position as Record<string, unknown>).startedAt !== 'string' || typeof (position as Record<string, unknown>).id !== 'string')) {
    return c.json({ error: 'Cursor inválido ou pertencente a outro escopo/filtro' }, 422)
  }
  const result = await persistence.dashboard.listSprintCyclesPage(projectContext, projectId, limit + 1, position as { startedAt: string; id: string } | null ?? undefined)
  const hasMore = result.rows.length > limit
  const cycles = hasMore ? result.rows.slice(0, limit) : result.rows
  const last = cycles.at(-1)
  const pagination = {
    limit, total: result.total, hasMore, truncated: hasMore,
    nextCursor: hasMore && last ? createDashboardCursor(scope, { startedAt: last.startedAt, id: last.id }) : null,
  }
  return c.json({ cycles, pagination })
})
