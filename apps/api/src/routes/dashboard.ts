import { Hono } from 'hono'
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db/index'
import { authMiddleware, requireRole } from '../middleware/auth'
import { items, itemEvents, itemLogs, itemSprints, projectAnalyticsCoverage, sprintCycleItems, sprintCycles, memberships, squads, users, sprints } from '../db/schema'
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
export function period(from?: string, to?: string) {
  if (!from && !to) return null
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return 'from e to devem ser datas UTC no formato AAAA-MM-DD'
  const start = Date.parse(`${from}T00:00:00.000Z`); const end = Date.parse(`${to}T23:59:59.999Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return 'Período inválido'
  if (end - start > MAX_PERIOD_DAYS * 86400000) return `O período máximo é de ${MAX_PERIOD_DAYS} dias`
  return null
}

async function population(ctx: RequestContext, projectId: string) {
  const rows = await db.select().from(items).where(and(eq(items.tenantId, ctx.tenantId), eq(items.projectId, projectId)))
  const parentIds = new Set(rows.map(row => row.parentId).filter((id): id is string => Boolean(id)))
  return rows.map(row => ({ ...row, isLeaf: !parentIds.has(row.id) })).filter(row => isEligibleLeaf(row, row.isLeaf))
}

async function filterPopulation(ctx: RequestContext, projectId: string, rows: Awaited<ReturnType<typeof population>>, query: (name: string) => string | undefined) {
  const modules = csv(query('moduleId')); const versions = csv(query('versionId')); const assignees = csv(query('assigneeId')); const types = csv(query('type'))
  const sprintIds = csv(query('sprintId')); const squadIds = csv(query('squadId'))
  const sprintRows = sprintIds.length ? await db.select({ itemId: itemSprints.itemId }).from(itemSprints).innerJoin(items, eq(items.id, itemSprints.itemId)).where(and(eq(items.tenantId, ctx.tenantId), eq(items.projectId, projectId), sql`${itemSprints.sprintId} IN (${sql.join(sprintIds.map(id => sql`${id}`), sql`, `)})`)) : []
  const sprintItems = new Set(sprintRows.map(row => row.itemId))
  const squadRows = squadIds.length ? await db.select({ userId: memberships.userId }).from(memberships).where(and(eq(memberships.tenantId, ctx.tenantId), eq(memberships.projectId, projectId), sql`${memberships.squadId} IN (${sql.join(squadIds.map(id => sql`${id}`), sql`, `)})`)) : []
  const squadUsers = new Set(squadRows.map(row => row.userId))
  return rows.filter(row => (!modules.length || modules.includes(row.moduleId ?? '')) && (!versions.length || versions.includes(row.versionId ?? '')) && (!assignees.length || assignees.includes(row.assigneeId ?? '')) && (!types.length || types.includes(row.type)) && (!sprintIds.length || sprintItems.has(row.id)) && (!squadIds.length || squadUsers.has(row.assigneeId ?? '')))
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
  const team = memberRows.map(member => { const mine = teamRows.filter(row => row.assigneeId === member.userId); const estimated = mine.filter(row => row.points !== null); return { userId: member.userId, userName: member.userName, squadId: member.squadId, squadName: member.squadName, wipTotal: mine.length, wipPoints: estimated.length ? estimated.reduce((sum, row) => sum + (row.points ?? 0), 0) : null, pointsCoverage: completionPercent(estimated.length, mine.length) } })
  const unassignedRows = teamRows.filter(row => !row.assigneeId); const unassignedEstimated = unassignedRows.filter(row => row.points !== null)
  const unassigned = unassignedRows.length; const teamTotal = teamRows.length; const teamEstimated = teamRows.filter(row => row.points !== null)
  const coverage = await db.query.projectAnalyticsCoverage.findFirst({ where: (row) => and(eq(row.tenantId, ctx.tenantId), eq(row.projectId, projectId)) })
  const events = await db.select().from(itemEvents).where(and(eq(itemEvents.tenantId, ctx.tenantId), eq(itemEvents.projectId, projectId))).orderBy(asc(itemEvents.occurredAt), asc(itemEvents.sequence), asc(itemEvents.id))
  const now = Date.now()
  const blockedDetails = blocked.map(row => {
    const transitions = events.filter(event => event.itemId === row.id && event.afterSnapshot).map(event => ({ event, after: JSON.parse(event.afterSnapshot!) as { status?: string }, before: event.beforeSnapshot ? JSON.parse(event.beforeSnapshot) as { status?: string } : null })).filter(entry => entry.after.status === 'BLOCKED' && entry.before?.status !== 'BLOCKED')
    const observedAt = transitions.at(-1)?.event.occurredAt ?? coverage?.coverageStartedAt
    const minimumKnown = !transitions.length
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
  const logs = await db.select({ log: itemLogs, item: items, membership: memberships, squadName: squads.name, authorName: users.name }).from(itemLogs).innerJoin(items, and(eq(items.id, itemLogs.itemId), eq(items.tenantId, ctx.tenantId), eq(items.projectId, projectId))).leftJoin(users, and(eq(users.id, itemLogs.authorId), eq(users.tenantId, ctx.tenantId))).leftJoin(memberships, and(eq(memberships.userId, itemLogs.authorId), eq(memberships.tenantId, ctx.tenantId), eq(memberships.projectId, projectId))).leftJoin(squads, and(eq(squads.id, memberships.squadId), eq(squads.tenantId, ctx.tenantId), eq(squads.projectId, projectId))).where(and(eq(itemLogs.tenantId, ctx.tenantId), eq(itemLogs.type, 'manual'), sql`${itemLogs.durationMin} > 0`, ...(from ? [gte(itemLogs.createdAt, from)] : []), ...(to ? [lte(itemLogs.createdAt, to)] : []), ...(sprintExists ? [sprintExists] : [])))
  const author = c.req.query('authorId'); const squadId = c.req.query('squadId'); const moduleIds = csv(c.req.query('moduleId')); const versionIds = csv(c.req.query('versionId')); const types = csv(c.req.query('type')); const filtered = logs.filter(row => (!author || row.log.authorId === author) && (!squadId || row.membership?.squadId === squadId) && (!moduleIds.length || moduleIds.includes(row.item.moduleId ?? '')) && (!versionIds.length || versionIds.includes(row.item.versionId ?? '')) && (!types.length || types.includes(row.item.type)))
  return c.json({ semantics: 'manual durationMin, grouped by log author and current author squad; createdAt is the registration date', totalMinutes: filtered.reduce((sum, row) => sum + (row.log.durationMin ?? 0), 0), rows: filtered.map(row => ({ authorId: row.log.authorId, authorName: row.authorName, squadName: row.squadName, itemId: row.item.id, versionId: row.item.versionId, moduleId: row.item.moduleId, durationMin: row.log.durationMin, createdAt: row.log.createdAt })) })
})

dashboardRouter.get('/burnup', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!; const from = c.req.query('from'); const to = c.req.query('to'); const periodError = period(from, to); if (periodError) return c.json({ error: periodError }, 422)
  const coverage = await db.query.projectAnalyticsCoverage.findFirst({ where: (row) => and(eq(row.tenantId, ctx.tenantId), eq(row.projectId, projectId)) }); if (!coverage) return c.json({ partial: true, series: [] })
  const requestedStart = from && from > coverage.coverageStartedAt.slice(0, 10) ? from : coverage.coverageStartedAt.slice(0, 10); const requestedEnd = to ?? new Date().toISOString().slice(0, 10)
  const events = await db.select().from(itemEvents).where(and(eq(itemEvents.tenantId, ctx.tenantId), eq(itemEvents.projectId, projectId), gte(itemEvents.occurredAt, coverage.coverageStartedAt), lte(itemEvents.occurredAt, `${requestedEnd}T23:59:59.999Z`))).orderBy(asc(itemEvents.occurredAt), asc(itemEvents.sequence), asc(itemEvents.id))
  const state = new Map<string, { status: string; type: string; isLeaf: boolean; points: number | null; moduleId?: string | null; versionId?: string | null; sprintIds?: string[] }>(); const baseline = events.find(event => event.eventType === 'ANALYTICS_BASELINE')
  if (baseline?.afterSnapshot) for (const row of JSON.parse(baseline.afterSnapshot) as Array<{ itemId: string; status: string; type: string; isLeaf: boolean; points: number | null; moduleId?: string | null; versionId?: string | null; sprintIds?: string[] }>) state.set(row.itemId, row)
  const byDay = new Map<string, { total: number; done: number; points: number; donePoints: number }>()
  const modules = csv(c.req.query('moduleId')); const versions = csv(c.req.query('versionId')); const types = csv(c.req.query('type')); const sprintIds = csv(c.req.query('sprintId'))
  for (const event of events) { if (event.itemId && (event.eventType === 'ITEM_DELETED' || event.eventType === 'ITEM_ARCHIVED')) state.delete(event.itemId); else if (event.itemId && event.afterSnapshot) state.set(event.itemId, JSON.parse(event.afterSnapshot)); const key = event.occurredAt.slice(0, 10); const values = [...state.values()].filter(row => isEligibleLeaf(row, row.isLeaf) && (!modules.length || modules.includes(row.moduleId ?? '')) && (!versions.length || versions.includes(row.versionId ?? '')) && (!types.length || types.includes(row.type)) && (!sprintIds.length || sprintIds.some(id => row.sprintIds?.includes(id)))); byDay.set(key, { total: values.length, done: values.filter(row => row.status === 'DONE').length, points: values.reduce((sum, row) => sum + (row.points ?? 0), 0), donePoints: values.filter(row => row.status === 'DONE').reduce((sum, row) => sum + (row.points ?? 0), 0) }) }
  const series = fillDailySeries(byDay, requestedStart, requestedEnd, { total: 0, done: 0, points: 0, donePoints: 0 })
  return c.json({ partial: true, coverageStartedAt: coverage.coverageStartedAt, filters: { applied: ['from', 'to', 'moduleId', 'sprintId', 'versionId', 'type'], inapplicable: ['squadId', 'assigneeId'] }, series })
})

dashboardRouter.get('/aging', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!; const rows = await filterPopulation(ctx, projectId, await population(ctx, projectId), name => c.req.query(name)); const coverage = await db.query.projectAnalyticsCoverage.findFirst({ where: (row) => and(eq(row.tenantId, ctx.tenantId), eq(row.projectId, projectId)) }); const events = await db.select().from(itemEvents).where(and(eq(itemEvents.tenantId, ctx.tenantId), eq(itemEvents.projectId, projectId))).orderBy(asc(itemEvents.occurredAt), asc(itemEvents.sequence))
  const now = Date.now(); const result = rows.filter(row => activeStatuses.has(row.status)).map(row => { const starts = events.filter(event => event.itemId === row.id && event.afterSnapshot && activeStatuses.has(JSON.parse(event.afterSnapshot).status) && (!event.beforeSnapshot || !activeStatuses.has(JSON.parse(event.beforeSnapshot).status))); const startedAt = starts.at(-1)?.occurredAt ?? coverage?.coverageStartedAt ?? row.createdAt; return { id: row.id, title: row.title, type: row.type, status: row.status, blockedReason: row.blockedReason, assigneeId: row.assigneeId, startedAt, ageHours: Math.max(0, (now - Date.parse(startedAt)) / 3600000), minimumKnown: !starts.length } })
  return c.json({ coverageStartedAt: coverage?.coverageStartedAt ?? null, items: result })
})

dashboardRouter.get('/sprints/:cycleId', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!; const cycleId = c.req.param('cycleId')!; const cycle = await db.query.sprintCycles.findFirst({ where: (row) => and(eq(row.id, cycleId), eq(row.tenantId, ctx.tenantId), eq(row.projectId, projectId)) }); if (!cycle) return c.json({ error: 'Ciclo não encontrado' }, 404)
  const committed = await db.select().from(sprintCycleItems).where(and(eq(sprintCycleItems.cycleId, cycleId), eq(sprintCycleItems.tenantId, ctx.tenantId), eq(sprintCycleItems.projectId, projectId), eq(sprintCycleItems.isLeaf, true)))
  const cutoff = cycle.endedAt && Date.parse(cycle.endedAt) < Date.now() ? cycle.endedAt : new Date().toISOString()
  const history = await db.select().from(itemEvents).where(and(eq(itemEvents.tenantId, ctx.tenantId), eq(itemEvents.projectId, projectId), lte(itemEvents.occurredAt, cutoff))).orderBy(asc(itemEvents.occurredAt), asc(itemEvents.sequence), asc(itemEvents.id))
  const state = new Map<string, { status: string; isLeaf: boolean; sprintIds: string[] }>()
  const baseline = history.find(event => event.eventType === 'ANALYTICS_BASELINE')
  if (baseline?.afterSnapshot) for (const row of JSON.parse(baseline.afterSnapshot) as Array<{ itemId: string; status: string; isLeaf: boolean; sprintIds?: string[] }>) state.set(row.itemId, { status: row.status, isLeaf: row.isLeaf, sprintIds: row.sprintIds ?? [] })
  for (const row of committed) state.set(row.itemId, { status: row.status, isLeaf: row.isLeaf, sprintIds: [cycle.sprintId] })
  for (const event of history) if (event.occurredAt >= cycle.startedAt && event.itemId && event.eventType === 'ITEM_DELETED') state.delete(event.itemId); else if (event.occurredAt >= cycle.startedAt && event.itemId && event.afterSnapshot) { const next = JSON.parse(event.afterSnapshot) as { status: string; isLeaf: boolean; sprintIds?: string[] }; state.set(event.itemId, { status: next.status, isLeaf: next.isLeaf, sprintIds: next.sprintIds ?? [] }) }
  const current = [...state.values()].filter(row => row.isLeaf && row.sprintIds.includes(cycle.sprintId) && row.status !== 'ARCHIVED')
  return c.json({ cycle, commitment: committed.length, committedDone: committed.filter(row => row.status === 'DONE').length, currentScope: current.length, currentDone: current.filter(row => row.status === 'DONE').length, uncompletedCommitment: committed.filter(row => !['DONE', 'CANCELLED'].includes(row.status)).length })
})

dashboardRouter.get('/sprints', requireRole('VIEWER'), async (c) => {
  const ctx = c.get('ctx') as RequestContext; const projectId = c.req.param('projectId')!
  const cycles = await db.select().from(sprintCycles).where(and(eq(sprintCycles.tenantId, ctx.tenantId), eq(sprintCycles.projectId, projectId))).orderBy(asc(sprintCycles.startedAt), asc(sprintCycles.id))
  return c.json({ cycles })
})
