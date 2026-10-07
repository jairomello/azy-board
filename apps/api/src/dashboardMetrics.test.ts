import { beforeAll, describe, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'
import { createSprintCycle, type ItemAnalyticsSnapshot } from './services/analytics'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db, sqlite } = await import('./db/index')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
sqlite.exec('PRAGMA foreign_keys = OFF;')
await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })
sqlite.exec('PRAGMA foreign_keys = ON;')

const {
  tenants, users, projects, items, itemSprints, sprints, sprintCycles, sprintCycleItems, projectAnalyticsCoverage, projectMetricsDaily, memberships, itemLogs,
} = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')
const { appendAnalyticsEvent } = await import('./services/analytics')
const {
  applyEventToDailyRollup, recomputeProjectRollup, ensureDashboardRollupsBackfill, readDailyRollupSeries, rollupMatchesReplay,
} = await import('./services/dashboardMetrics')

async function token(userId: string, tenantId: string, email: string) {
  return signJwt({ sub: userId, tenantId, email, role: 'user' })
}

async function request(path: string, session: string) {
  return app.fetch(new Request(`http://test.local/api${path}`, { headers: { cookie: `session=${session}` } }))
}

const now = new Date().toISOString()

describe('rollup diário transacional (Item 13)', () => {
  let tenantId: string
  let projectId: string
  let coveredDay: string

  beforeAll(async () => {
    tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Rollup tenant', slug: `roll-${tenantId.slice(0, 8)}`, createdAt: now })
    projectId = generateId()
    await db.insert(projects).values({ id: projectId, tenantId, name: 'Projeto rollup', createdAt: now })
    coveredDay = new Date('2026-01-05T12:00:00.000Z').toISOString().slice(0, 10)
    await db.insert(projectAnalyticsCoverage).values({ projectId, tenantId, coverageStartedAt: `${coveredDay}T00:00:00.000Z`, createdAt: now })
  })

  test('createSprintCycle seleciona só folhas vinculadas com uma consulta set-based', async () => {
    const sprintId = generateId()
    const storyId = generateId()
    const leafId = generateId()
    const parentId = generateId()
    const childId = generateId()
    await db.insert(sprints).values({
      id: sprintId, tenantId, projectId, name: 'Ciclo N+1', status: 'OPEN',
      startDate: '2026-01-01', endDate: '2026-01-31', createdAt: now,
    })
    await db.insert(items).values([
      { id: storyId, tenantId, projectId, type: 'STORY', parentId: null, moduleId: null, ancestryPath: '[]', title: 'História', status: 'NOT_STARTED', priority: 'MEDIUM', points: null, position: 0, createdAt: now, updatedAt: now },
      { id: leafId, tenantId, projectId, type: 'TASK', parentId: storyId, moduleId: null, ancestryPath: '[]', title: 'Folha', status: 'NOT_STARTED', priority: 'MEDIUM', points: 2, position: 1, createdAt: now, updatedAt: now },
      { id: parentId, tenantId, projectId, type: 'TASK', parentId: storyId, moduleId: null, ancestryPath: '[]', title: 'Pai', status: 'NOT_STARTED', priority: 'MEDIUM', points: 3, position: 2, createdAt: now, updatedAt: now },
      { id: childId, tenantId, projectId, type: 'BUG', parentId, moduleId: null, ancestryPath: '[]', title: 'Filho', status: 'NOT_STARTED', priority: 'MEDIUM', points: 1, position: 3, createdAt: now, updatedAt: now },
    ])
    await db.insert(itemSprints).values([
      { tenantId, itemId: leafId, sprintId },
      { tenantId, itemId: parentId, sprintId },
    ])

    const cycleId = await db.transaction(tx => createSprintCycle(tx, tenantId, projectId, sprintId, 'OPENED'))
    const cycleRows = await db.select().from(sprintCycleItems).where(eq(sprintCycleItems.cycleId, cycleId))
    expect(cycleRows.map(row => row.itemId)).toEqual([leafId])
  })

  test('resumos de ciclo contam compromisso e escopo atual por SQL sem carregar histórico', async () => {
    const sprintId = generateId(), cycleId = generateId()
    const doneId = generateId(), blockedId = generateId(), cancelledId = generateId()
    const parentId = generateId(), childId = generateId(), archivedId = generateId()
    await db.insert(sprints).values({ id: sprintId, tenantId, projectId, name: 'Ciclo agregado', status: 'OPEN', startDate: '2026-01-01', endDate: '2026-01-31', createdAt: now })
    await db.insert(sprintCycles).values({ id: cycleId, tenantId, projectId, sprintId, source: 'OPENED', startedAt: now, endedAt: null, endReason: null })
    await db.insert(items).values([
      { id: doneId, tenantId, projectId, type: 'TASK', parentId: null, moduleId: null, ancestryPath: '[]', title: 'Done', status: 'DONE', priority: 'MEDIUM', points: 3, position: 0, createdAt: now, updatedAt: now },
      { id: blockedId, tenantId, projectId, type: 'BUG', parentId: null, moduleId: null, ancestryPath: '[]', title: 'Blocked', status: 'BLOCKED', priority: 'MEDIUM', points: 2, position: 1, createdAt: now, updatedAt: now },
      { id: cancelledId, tenantId, projectId, type: 'TASK', parentId: null, moduleId: null, ancestryPath: '[]', title: 'Cancelled', status: 'CANCELLED', priority: 'MEDIUM', points: 1, position: 2, createdAt: now, updatedAt: now },
      { id: parentId, tenantId, projectId, type: 'TASK', parentId: null, moduleId: null, ancestryPath: '[]', title: 'Parent', status: 'IN_PROGRESS', priority: 'MEDIUM', points: 5, position: 3, createdAt: now, updatedAt: now },
      { id: childId, tenantId, projectId, type: 'BUG', parentId, moduleId: null, ancestryPath: '[]', title: 'Child', status: 'NOT_STARTED', priority: 'MEDIUM', points: 1, position: 4, createdAt: now, updatedAt: now },
      { id: archivedId, tenantId, projectId, type: 'TASK', parentId: null, moduleId: null, ancestryPath: '[]', title: 'Archived', status: 'ARCHIVED', priority: 'MEDIUM', points: 1, position: 5, createdAt: now, updatedAt: now },
    ])
    await db.insert(itemSprints).values([doneId, blockedId, cancelledId, parentId, childId, archivedId].map(itemId => ({ tenantId, itemId, sprintId })))
    await db.insert(sprintCycleItems).values([
      { cycleId, tenantId, projectId, itemId: doneId, type: 'TASK', isLeaf: true, points: 3, status: 'DONE', moduleId: null, versionId: null },
      { cycleId, tenantId, projectId, itemId: blockedId, type: 'BUG', isLeaf: true, points: 2, status: 'BLOCKED', moduleId: null, versionId: null },
      { cycleId, tenantId, projectId, itemId: cancelledId, type: 'TASK', isLeaf: true, points: 1, status: 'CANCELLED', moduleId: null, versionId: null },
    ])
    const { persistence } = await import('./persistence/runtime')
    const context = { tenantId, actorUserId: null, actorKind: 'SYSTEM' as const }
    expect(await persistence.dashboard.getSprintCycleCommitmentCounts(context, projectId, cycleId)).toEqual({ commitment: 3, committedDone: 1, uncompletedCommitment: 1 })
    expect(await persistence.dashboard.getCurrentSprintCycleCounts(context, projectId, sprintId)).toEqual({ currentScope: 4, currentDone: 1 })
  })

  test('evento único movimenta o dia e baseline define valores absolutos (1.4)', async () => {
    await db.transaction(async (tx) => {
      await appendAnalyticsEvent(tx, {
        tenantId, projectId, eventType: 'ANALYTICS_BASELINE', actorId: 'seed', origin: 'SYSTEM',
        occurredAt: `${coveredDay}T00:00:00.000Z`, after: [
          { itemId: 'i-1', parentId: null, type: 'TASK' as const, isLeaf: true, status: 'NOT_STARTED' as const, points: 3, sprintIds: [], versionId: null, moduleId: null },
          { itemId: 'i-2', parentId: null, type: 'BUG' as const, isLeaf: true, status: 'DONE' as const, points: 5, sprintIds: [], versionId: null, moduleId: null },
          { itemId: 'i-3', parentId: null, type: 'EPIC' as const, isLeaf: false, status: 'NOT_STARTED' as const, points: null, sprintIds: [], versionId: null, moduleId: null }] as unknown as ItemAnalyticsSnapshot[],
      })
    })
    const baseline = (await db.select().from(projectMetricsDaily).where(and(eq(projectMetricsDaily.tenantId, tenantId), eq(projectMetricsDaily.metricDate, coveredDay))))[0]!
    expect(baseline.total).toBe(2)
    expect(baseline.done).toBe(1)
    expect(baseline.points).toBe(8)
    expect(baseline.donePoints).toBe(5)

    // STATUS_CHANGED no mesmo dia: acumula deltas sobre o dia (1.4)
    await db.transaction(async (tx) => {
      await appendAnalyticsEvent(tx, {
        tenantId, projectId, itemId: 'i-1', eventType: 'STATUS_CHANGED', actorId: 'seed', origin: 'SYSTEM',
        occurredAt: `${coveredDay}T15:00:00.000Z`,
        before: { parentId: null, type: 'TASK', isLeaf: true, status: 'NOT_STARTED', points: 3, sprintIds: [], versionId: null, moduleId: null },
        after: { parentId: null, type: 'TASK', isLeaf: true, status: 'DONE', points: 3, sprintIds: [], versionId: null, moduleId: null },
      })
    })
    const after = (await db.select().from(projectMetricsDaily).where(and(eq(projectMetricsDaily.tenantId, tenantId), eq(projectMetricsDaily.metricDate, coveredDay))))[0]!
    expect(after.total).toBe(2)
    expect(after.done).toBe(2)
    expect(after.points).toBe(8)
    expect(after.donePoints).toBe(8)

    // ITEM_DELETED no dia seguinte (carry forward preservado) (1.4/3.2)
    await db.transaction(async (tx) => {
      await appendAnalyticsEvent(tx, {
        tenantId, projectId, itemId: 'i-2', eventType: 'ITEM_DELETED', actorId: 'seed', origin: 'SYSTEM',
        occurredAt: '2026-01-06T08:00:00.000Z',
        before: { parentId: null, type: 'BUG', isLeaf: true, status: 'DONE', points: 5, sprintIds: [], versionId: null, moduleId: null },
      })
    })
    const next = (await db.select().from(projectMetricsDaily).where(and(eq(projectMetricsDaily.tenantId, tenantId), eq(projectMetricsDaily.metricDate, '2026-01-06'))))[0]!
    expect(next.total).toBe(1)
    expect(next.done).toBe(1)
    expect(next.points).toBe(3)
    expect(next.donePoints).toBe(3)
  })

  test('gate anti-drift: rollup incremental == replay completo (3.2)', async () => {
    // Sequência SEMPRE autoconsistente: item novo entra por ITEM_CREATED e os
    // snapshots de before refletem o estado anterior do replay.
    const days = ['2026-01-06T11:00:00.000Z', '2026-01-06T12:00:00.000Z', '2026-01-06T13:00:00.000Z', '2026-01-07T15:00:00.000Z']
    const seed = (): ItemAnalyticsSnapshot => ({ parentId: null, type: 'TASK' as const, isLeaf: true, status: 'NOT_STARTED' as const, points: 3, sprintIds: [], versionId: null, moduleId: null })
    await db.transaction(async (tx) => {
      await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: 'i-6', eventType: 'ITEM_CREATED', actorId: 'seed', origin: 'SYSTEM', occurredAt: days[0]!, after: { ...seed() } })
      await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: 'i-6', eventType: 'POINTS_CHANGED', actorId: 'seed', origin: 'SYSTEM', occurredAt: days[0]!, before: { ...seed() }, after: { ...seed(), points: 5 } })
      await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: 'i-6', eventType: 'STATUS_CHANGED', actorId: 'seed', origin: 'SYSTEM', occurredAt: days[1]!, before: { ...seed(), points: 5 }, after: { ...seed(), status: 'BLOCKED', points: 5 } })
      await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: 'i-6', eventType: 'STATUS_CHANGED', actorId: 'seed', origin: 'SYSTEM', occurredAt: days[2]!, before: { ...seed(), status: 'BLOCKED', points: 5 }, after: { ...seed(), status: 'DONE', points: 5 } })
      // Arquivamento de item novo (before nulo ⇒ entrada ARCHIVED não é elegível)
      await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: 'i-9', eventType: 'ITEM_ARCHIVED', actorId: 'seed', origin: 'SYSTEM', occurredAt: days[3]!, before: null, after: { ...seed(), status: 'ARCHIVED' } })
    })
    expect(await rollupMatchesReplay(tenantId, projectId, coveredDay, '2026-01-07')).toBe(true)
    // Recompute (replay completo) produz as mesmas linhas do incremento
    const beforeRecompute = await db.select().from(projectMetricsDaily).where(eq(projectMetricsDaily.tenantId, tenantId))
    await recomputeProjectRollup(db, tenantId, projectId)
    const afterRecompute = await db.select().from(projectMetricsDaily).where(eq(projectMetricsDaily.tenantId, tenantId))
    expect(afterRecompute.map(row => `${row.metricDate}:${row.total}/${row.done}/${row.points}/${row.donePoints}`).sort())
      .toEqual(beforeRecompute.map(row => `${row.metricDate}:${row.total}/${row.done}/${row.points}/${row.donePoints}`).sort())
  })

  test('recompute é idempotente para eventos legados (3.3)', async () => {
    await recomputeProjectRollup(db, tenantId, projectId)
    const key = (row: { metricDate: string; total: number; done: number; points: number; donePoints: number }) => `[${row.metricDate} ${row.total}/${row.done}/${row.points}/${row.donePoints}]`
    const first = (await db.select().from(projectMetricsDaily).where(eq(projectMetricsDaily.projectId, projectId))).map(key).sort()
    await recomputeProjectRollup(db, tenantId, projectId)
    const again = (await db.select().from(projectMetricsDaily).where(eq(projectMetricsDaily.projectId, projectId))).map(key).sort()
    expect(again).toEqual(first)
    expect(again.length).toBeGreaterThan(0)
  })

  test('burnup sem filtros lê o rollup; com filtros usa replay por deltas (2.3/3.1)', async () => {
    const adminId = generateId()
    const adminEmail = `${generateId()}@rollup.test`
    await db.insert(users).values({ id: adminId, tenantId, email: adminEmail, passwordHash: 'h', name: 'Admin', theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', createdAt: now })
    await db.insert(memberships).values({ id: generateId(), tenantId, userId: adminId, projectId, role: 'ADMIN', createdAt: now })
    const session = await token(adminId, tenantId, adminEmail)

    const response = await request(`/projects/${projectId}/dashboard/burnup`, session)
    expect(response.status).toBe(200)
    const body = await response.json() as { series: Array<{ date: string; total: number; done: number }> }
    const series = body.series
    const firstDate = series[0]?.date ?? ''; const lastDate = series.at(-1)?.date ?? firstDate
    expect(firstDate === lastDate ? true : firstDate <= lastDate).toBe(true)
    // 2026-01-05: baseline (2,1,8,5) + i-1 → DONE; 2026-01-06: i-6 DONE 5p e i-2 (5p) ainda vivo; 2026-01-07: i-2 excluído
    expect(series).toContainEqual(expect.objectContaining({ date: '2026-01-05', total: 2, done: 2 }))
    expect(series).toContainEqual(expect.objectContaining({ date: '2026-01-07', total: 2, done: 2 }))

    const fullYear = await request(`/projects/${projectId}/dashboard/burnup?from=${coveredDay}&to=2027-01-05`, session)
    expect(fullYear.status).toBe(200)
    const fullYearBody = await fullYear.json() as { series: Array<{ date: string }> }
    expect(fullYearBody.series).toHaveLength(366)
    expect(new TextEncoder().encode(JSON.stringify(fullYearBody)).byteLength).toBeLessThan(256 * 1024)

    // Filtro por sprint não existente ⇒ população vazia do primeiro evento em diante
    const filtered = await request(`/projects/${projectId}/dashboard/burnup?from=${coveredDay}&to=2026-01-07&moduleId=inexistente`, session)
    expect(filtered.status).toBe(200)
    const filteredBody = await filtered.json() as { series: Array<{ date: string; total: number }> }
    expect(filteredBody.series.filter(row => row.date === coveredDay)[0]!.total).toBe(0)

    // Snapshot preserva a estrutura mínima e os campos de cobertura
    const snapshot = await request(`/projects/${projectId}/dashboard/snapshot`, session)
    expect(snapshot.status).toBe(200)
    const snapshotBody = await snapshot.json() as Record<string, unknown>
    expect(Object.keys(snapshotBody)).toContain('boxes')

    const cyclesPage = await request(`/projects/${projectId}/dashboard/sprints?limit=1`, session)
    const cyclesBody = await cyclesPage.json() as { cycles: Array<{ id: string }>; pagination: { total: number; hasMore: boolean; nextCursor: string | null } }
    expect(cyclesBody.pagination).toMatchObject({ total: 2, hasMore: true })
    expect(cyclesBody.cycles).toHaveLength(1)
    const nextCyclesPage = await request(`/projects/${projectId}/dashboard/sprints?limit=1&cursor=${encodeURIComponent(cyclesBody.pagination.nextCursor!)}`, session)
    const nextCyclesBody = await nextCyclesPage.json() as typeof cyclesBody
    expect(nextCyclesBody.cycles).toHaveLength(1)
    expect(nextCyclesBody.cycles[0]?.id).not.toBe(cyclesBody.cycles[0]?.id)
    expect(nextCyclesBody.pagination).toMatchObject({ total: 2, hasMore: false, nextCursor: null })
  })

  test('leitura do rollup é escopada por tenant (3.1)', async () => {
    const otherTenant = generateId()
    await db.insert(tenants).values({ id: otherTenant, name: 'Outro', slug: `roll-${otherTenant.slice(0, 8)}`, createdAt: now })
    const otherProject = generateId()
    await db.insert(projects).values({ id: otherProject, tenantId: otherTenant, name: 'Outro projeto', createdAt: now })
    // [CUTOVER] qualquer projeto precisa de cobertura para o gate global
    await db.insert(projectAnalyticsCoverage).values({ projectId: otherProject, tenantId: otherTenant, coverageStartedAt: now, createdAt: now })
    const series = await readDailyRollupSeries(db, otherTenant, otherProject, coveredDay, '2026-01-07')
    expect(series.size).toBe(0)
  })

  test('snapshot oracle preserva Leaf Rule, WIP sobreposto, estimativa e overdue', async () => {
    const snapshotTenant = generateId(), snapshotProject = generateId(), adminId = generateId()
    const email = `${generateId()}@snapshot-oracle.test`
    await db.insert(tenants).values({ id: snapshotTenant, name: 'Snapshot oracle', slug: `snap-${snapshotTenant.slice(0, 8)}`, createdAt: now })
    await db.insert(users).values({ id: adminId, tenantId: snapshotTenant, email, passwordHash: 'h', name: 'Oracle member', createdAt: now })
    await db.insert(projects).values({ id: snapshotProject, tenantId: snapshotTenant, name: 'Projeto oracle', managerUserId: adminId, createdAt: now })
    await db.insert(memberships).values({ id: generateId(), tenantId: snapshotTenant, userId: adminId, projectId: snapshotProject, role: 'ADMIN', createdAt: now })
    const overdueDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    await db.insert(items).values([
      { id: generateId(), tenantId: snapshotTenant, projectId: snapshotProject, type: 'TASK', title: 'Done estimada', status: 'DONE', priority: 'MEDIUM', points: 3, assigneeId: adminId, dueDate: null, position: 0, createdAt: now, updatedAt: now },
      { id: generateId(), tenantId: snapshotTenant, projectId: snapshotProject, type: 'TASK', title: 'WIP sem estimativa', status: 'IN_PROGRESS', priority: 'MEDIUM', points: null, assigneeId: adminId, dueDate: null, position: 1, createdAt: now, updatedAt: now },
      { id: generateId(), tenantId: snapshotTenant, projectId: snapshotProject, type: 'BUG', title: 'Bloqueado atrasado', status: 'BLOCKED', priority: 'HIGH', points: 2, assigneeId: adminId, dueDate: overdueDate, blockedReason: 'Dependência', position: 2, createdAt: now, updatedAt: now },
      { id: generateId(), tenantId: snapshotTenant, projectId: snapshotProject, type: 'BUG', title: 'Não iniciado', status: 'NOT_STARTED', priority: 'LOW', points: 0, assigneeId: null, dueDate: null, position: 3, createdAt: now, updatedAt: now },
      { id: generateId(), tenantId: snapshotTenant, projectId: snapshotProject, type: 'TASK', title: 'Agregador não elegível', status: 'IN_PROGRESS', priority: 'MEDIUM', points: 100, assigneeId: adminId, dueDate: overdueDate, position: 4, createdAt: now, updatedAt: now },
    ])
    const inserted = await db.select().from(items).where(eq(items.projectId, snapshotProject))
    const aggregator = inserted.find(row => row.title === 'Agregador não elegível')!
    const childId = generateId()
    await db.insert(items).values({ id: childId, tenantId: snapshotTenant, projectId: snapshotProject, type: 'BUG', title: 'Filho', status: 'NOT_STARTED', priority: 'LOW', parentId: aggregator.id, points: 1, position: 5, createdAt: now, updatedAt: now })

    const session = await token(adminId, snapshotTenant, email)
    const response = await request(`/projects/${snapshotProject}/dashboard/snapshot`, session)
    expect(response.status).toBe(200)
    const snapshot = await response.json() as { filters: { inapplicable: string[] }; boxes: {
      progressScope: { total: number; done: number; points: number; donePoints: number; estimationCoverage: number | null }
      wip: { total: number; byStatus: Record<string, number>; pointsCoverage: number | null }
      blocked: { total: number }
      overdue: { total: number; points: number; items: Array<{ title: string }>; remainingItems: Array<{ title: string }> }
      teamLoad: { members: Array<{ userId: string; wipTotal: number; blockedSubset: number; wipPoints: number | null; pointsCoverage: number | null }> }
    } }
    expect(snapshot.boxes.progressScope).toMatchObject({ total: 5, done: 1, points: 6, donePoints: 3, estimationCoverage: 80 })
    expect(snapshot.boxes.wip).toMatchObject({ total: 2, byStatus: { IN_PROGRESS: 1, BLOCKED: 1 }, pointsCoverage: 80 })
    expect(snapshot.boxes.blocked.total).toBe(1)
    expect(snapshot.boxes.overdue).toMatchObject({ total: 1, items: [{ title: 'Bloqueado atrasado' }] })
    expect(snapshot.boxes.overdue.points).toBe(2)
    expect(snapshot.boxes.overdue.remainingItems).toHaveLength(4)
    expect(snapshot.boxes.teamLoad.members.find(member => member.userId === adminId)).toMatchObject({ wipTotal: 2, blockedSubset: 1, wipPoints: 2, pointsCoverage: 50 })
    expect(snapshot.filters.inapplicable).toEqual(['from', 'to'])

    const firstPageResponse = await request(`/projects/${snapshotProject}/dashboard/snapshot?limit=1`, session)
    const firstPage = await firstPageResponse.json() as { boxes: {
      wip: { total: number; items: Array<{ id: string }>; pagination: { hasMore: boolean; nextCursor: string | null } }
      blocked: { total: number; items: Array<{ id: string }>; pagination: { hasMore: boolean } }
      overdue: { total: number; points: number; items: Array<{ id: string }>; remainingItems: Array<{ id: string }>; pagination: { hasMore: boolean }; remainingPagination: { hasMore: boolean; nextCursor: string | null } }
    } }
    expect(new TextEncoder().encode(JSON.stringify(firstPage)).byteLength).toBeLessThan(256 * 1024)
    expect(firstPage.boxes.wip).toMatchObject({ total: 2, pagination: { hasMore: true } })
    expect(firstPage.boxes.wip.items).toHaveLength(1)
    expect(firstPage.boxes.blocked).toMatchObject({ total: 1, pagination: { hasMore: false } })
    expect(firstPage.boxes.overdue).toMatchObject({ total: 1, pagination: { hasMore: false }, remainingPagination: { hasMore: true } })
    expect(firstPage.boxes.overdue.remainingItems).toHaveLength(1)
    const nextWip = await request(`/projects/${snapshotProject}/dashboard/snapshot?limit=1&wipCursor=${encodeURIComponent(firstPage.boxes.wip.pagination.nextCursor!)}`, session)
    const nextWipBody = await nextWip.json() as typeof firstPage
    expect(nextWipBody.boxes.wip.total).toBe(2)
    expect(nextWipBody.boxes.wip.items).toHaveLength(1)
    expect(nextWipBody.boxes.wip.items[0]?.id).not.toBe(firstPage.boxes.wip.items[0]?.id)
    const wrongFilter = await request(`/projects/${snapshotProject}/dashboard/snapshot?type=TASK&wipCursor=${encodeURIComponent(firstPage.boxes.wip.pagination.nextCursor!)}`, session)
    expect(wrongFilter.status).toBe(422)

    const agingPageResponse = await request(`/projects/${snapshotProject}/dashboard/aging?limit=1`, session)
    const agingPage = await agingPageResponse.json() as { total: number; pagination: { hasMore: boolean; nextCursor: string | null }; items: Array<{ id: string }> }
    expect(agingPage).toMatchObject({ total: 2, pagination: { limit: 1, hasMore: true } })
    expect(agingPage.items).toHaveLength(1)
    const agingNext = await request(`/projects/${snapshotProject}/dashboard/aging?limit=1&cursor=${encodeURIComponent(agingPage.pagination.nextCursor!)}`, session)
    const agingNextBody = await agingNext.json() as typeof agingPage
    expect(agingNextBody.items).toHaveLength(1)
    expect(agingNextBody.items[0]?.id).not.toBe(agingPage.items[0]?.id)
  })
})

describe('oráculo histórico pequeno e matriz de filtros do burnup', () => {
  test('preserva filtros históricos, união de sprints, Leaf Rule, reabertura, arquivo e cobertura parcial', async () => {
    const tenantId = generateId(), projectId = generateId(), adminId = generateId()
    const adminEmail = `${generateId()}@burnup-oracle.test`
    const moduleA = generateId(), moduleB = generateId()
    const versionA = generateId(), versionB = generateId()
    const sprintA = generateId(), sprintB = generateId()
    const itemA = generateId(), itemB = generateId(), parent = generateId(), itemD = generateId(), itemE = generateId()
    const start = '2026-02-01T00:00:00.000Z'
    const { modules, projectVersions, projectAnalyticsDimensionItems, projectAnalyticsDimensionMeta, projectAnalyticsDimensionSnapshots, projectAnalyticsDimensionState, itemEvents } = await import('./db/schema')
    await db.insert(tenants).values({ id: tenantId, name: 'Burnup oracle', slug: `burn-${tenantId.slice(0, 8)}`, createdAt: now })
    await db.insert(users).values({ id: adminId, tenantId, email: adminEmail, passwordHash: 'h', name: 'Oracle', createdAt: now })
    await db.insert(projects).values({ id: projectId, tenantId, name: 'Projeto burnup oracle', createdAt: now })
    await db.insert(memberships).values({ id: generateId(), tenantId, userId: adminId, projectId, role: 'ADMIN', createdAt: now })
    await db.insert(projectAnalyticsCoverage).values({ projectId, tenantId, coverageStartedAt: start, createdAt: now })
    await db.insert(modules).values([
      { id: moduleA, tenantId, projectId, name: 'Módulo A', position: 0 },
      { id: moduleB, tenantId, projectId, name: 'Módulo B', position: 1 },
    ])
    await db.insert(projectVersions).values([
      { id: versionA, tenantId, projectId, name: 'Versão A', status: 'PLANNED', position: 0, createdAt: now },
      { id: versionB, tenantId, projectId, name: 'Versão B', status: 'IN_DEV', position: 1, createdAt: now },
    ])
    await db.insert(sprints).values([
      { id: sprintA, tenantId, projectId, name: 'Sprint A', status: 'OPEN', startDate: '2026-02-01', endDate: '2026-02-14', createdAt: now },
      { id: sprintB, tenantId, projectId, name: 'Sprint B', status: 'PROPOSED', startDate: '2026-02-15', endDate: '2026-02-28', createdAt: now },
    ])
    const snapshot = (input: Partial<ItemAnalyticsSnapshot> & Pick<ItemAnalyticsSnapshot, 'type' | 'isLeaf' | 'status' | 'points' | 'moduleId' | 'versionId' | 'sprintIds'>): ItemAnalyticsSnapshot => ({ parentId: input.parentId ?? null, ...input })
    const initial = {
      [itemA]: snapshot({ type: 'TASK', isLeaf: true, status: 'NOT_STARTED', points: 3, moduleId: moduleA, versionId: versionA, sprintIds: [sprintA] }),
      [itemB]: snapshot({ type: 'BUG', isLeaf: true, status: 'DONE', points: 5, moduleId: moduleB, versionId: versionB, sprintIds: [sprintA, sprintB] }),
      [parent]: snapshot({ type: 'TASK', isLeaf: false, status: 'IN_PROGRESS', points: 100, moduleId: moduleA, versionId: versionA, sprintIds: [sprintA] }),
      [itemD]: snapshot({ type: 'TASK', isLeaf: true, status: 'IN_PROGRESS', points: null, moduleId: moduleA, versionId: versionB, sprintIds: [sprintB] }),
      [itemE]: snapshot({ type: 'TASK', isLeaf: true, status: 'NOT_STARTED', points: 1, moduleId: moduleB, versionId: versionA, sprintIds: [sprintA] }),
    }
    await db.transaction(async tx => {
      await appendAnalyticsEvent(tx, { tenantId, projectId, eventType: 'ANALYTICS_BASELINE', actorId: adminId, origin: 'TEST', occurredAt: start, after: Object.entries(initial).map(([itemId, after]) => ({ itemId, ...after })) as unknown as ItemAnalyticsSnapshot[] })
      const movedA = { ...initial[itemA], moduleId: moduleB, versionId: versionB, sprintIds: [sprintB] }
      await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: itemA, eventType: 'MODULE_CHANGED', actorId: adminId, origin: 'TEST', occurredAt: '2026-02-02T10:00:00.000Z', before: initial[itemA], after: movedA })
      const reopenedB = { ...initial[itemB], status: 'IN_PROGRESS' as const }
      await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: itemB, eventType: 'STATUS_CHANGED', actorId: adminId, origin: 'TEST', occurredAt: '2026-02-03T10:00:00.000Z', before: initial[itemB], after: reopenedB })
      const completedD = { ...initial[itemD], status: 'DONE' as const }
      await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: itemD, eventType: 'STATUS_CHANGED', actorId: adminId, origin: 'TEST', occurredAt: '2026-02-03T11:00:00.000Z', before: initial[itemD], after: completedD })
      const archivedD = { ...completedD, status: 'ARCHIVED' as const }
      await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: itemD, eventType: 'ITEM_ARCHIVED', actorId: adminId, origin: 'TEST', occurredAt: '2026-02-04T10:00:00.000Z', before: completedD, after: archivedD })
      await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: itemE, eventType: 'ITEM_DELETED', actorId: adminId, origin: 'TEST', occurredAt: '2026-02-04T11:00:00.000Z', before: initial[itemE] })
    })
    const { persistence } = await import('./persistence/runtime')
    await persistence.analytics.backfillDimensionProjections()
    const projectionMeta = await persistence.dashboard.getDimensionProjectionMeta({ tenantId, actorUserId: adminId, actorKind: 'USER' }, projectId)
    expect(projectionMeta).toMatchObject({ projectionVersion: 1, status: 'READY' })
    const projectedBefore = await db.select().from(projectAnalyticsDimensionSnapshots).where(eq(projectAnalyticsDimensionSnapshots.projectId, projectId))
    const baselineEvent = (await db.select().from(itemEvents).where(and(eq(itemEvents.tenantId, tenantId), eq(itemEvents.projectId, projectId), eq(itemEvents.eventType, 'ANALYTICS_BASELINE'))))[0]!
    await db.delete(projectAnalyticsDimensionSnapshots).where(eq(projectAnalyticsDimensionSnapshots.projectId, projectId))
    await db.delete(projectAnalyticsDimensionState).where(eq(projectAnalyticsDimensionState.projectId, projectId))
    await db.delete(projectAnalyticsDimensionItems).where(eq(projectAnalyticsDimensionItems.projectId, projectId))
    await db.update(projectAnalyticsDimensionMeta).set({ status: 'BUILDING', lastSequence: baselineEvent.sequence, targetSequence: null, updatedAt: now }).where(eq(projectAnalyticsDimensionMeta.projectId, projectId))
    const { applyDimensionProjectionBackfill } = await import('./db/sqlite/itemAnalytics')
    sqlite.transaction(() => {
      const baselineRows = JSON.parse(baselineEvent.afterSnapshot!) as Array<{ itemId: string } & ItemAnalyticsSnapshot>
      for (const row of baselineRows) applyDimensionProjectionBackfill(sqlite, tenantId, projectId, row.itemId, baselineEvent.occurredAt, baselineEvent.sequence, null, row)
    })()
    await persistence.analytics.backfillDimensionProjections()
    const projectedAfter = await db.select().from(projectAnalyticsDimensionSnapshots).where(eq(projectAnalyticsDimensionSnapshots.projectId, projectId))
    const order = (row: typeof projectedBefore[number]) => `${row.metricDate}:${row.moduleKey}:${row.versionKey}:${row.sprintSetHash}:${row.type}:${row.total}/${row.done}/${row.points}/${row.donePoints}`
    expect(projectedAfter.map(order).sort()).toEqual(projectedBefore.map(order).sort())

    const session = await token(adminId, tenantId, adminEmail)
    const read = async (filters = '') => {
      const suffix = `from=2026-01-31&to=2026-02-04${filters ? `&${filters}` : ''}`
      const response = await request(`/projects/${projectId}/dashboard/burnup?${suffix}`, session)
      expect(response.status).toBe(200)
      return await response.json() as { partial: boolean; coverageStartedAt: string; projection?: { status: string; version?: number | null; sourceStatus?: string }; warnings?: string[]; filters: { applied: string[]; inapplicable: string[] }; series: Array<{ date: string; total: number; done: number; points: number; donePoints: number }> }
    }
    const totalAt = (series: Awaited<ReturnType<typeof read>>, date: string) => series.series.find(row => row.date === date)!

    const baseline = await read()
    expect(baseline.partial).toBe(true)
    expect(baseline.filters.applied).toEqual(['from', 'to', 'moduleId', 'sprintId', 'versionId', 'type'])
    expect(baseline.filters.inapplicable).toEqual(['squadId', 'assigneeId'])
    expect(baseline.series.map(row => row.date)).toEqual(['2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04'])
    expect(totalAt(baseline, '2026-02-01')).toMatchObject({ total: 4, done: 1, points: 9, donePoints: 5 })
    expect(totalAt(baseline, '2026-02-03')).toMatchObject({ total: 4, done: 1, points: 9, donePoints: 0 })
    expect(totalAt(baseline, '2026-02-04')).toMatchObject({ total: 2, done: 0, points: 8, donePoints: 0 })

    const byModule = await read(`moduleId=${moduleA}`)
    expect(byModule.projection).toEqual({ status: 'READY', version: 1 })
    expect(byModule.series.map(row => row.total)).toEqual([2, 1, 1, 0])
    const listEvents = persistence.dashboard.listEvents
    persistence.dashboard.listEvents = async () => { throw new Error('Burnup com projeção pronta não deve fazer replay dos eventos') }
    try {
      const projectedWithoutReplay = await read(`moduleId=${moduleA}`)
      expect(projectedWithoutReplay.series).toEqual(byModule.series)
    } finally {
      persistence.dashboard.listEvents = listEvents
    }
    const byVersion = await read(`versionId=${versionA}`)
    expect(byVersion.series.map(row => row.total)).toEqual([2, 1, 1, 0])
    const byType = await read('type=TASK')
    expect(byType.series.map(row => row.total)).toEqual([3, 3, 3, 1])
    expect(byType.series.map(row => row.done)).toEqual([0, 0, 1, 0])
    const byOneSprint = await read(`sprintId=${sprintA}`)
    expect(byOneSprint.series.map(row => row.total)).toEqual([3, 2, 2, 1])
    const byTwoSprints = await read(`sprintId=${sprintA},${sprintB}`)
    expect(byTwoSprints.series.map(row => row.total)).toEqual([4, 4, 4, 2])
    const byModuleB = await read(`moduleId=${moduleB}`)
    expect(byModuleB.series.map(row => row.total)).toEqual([2, 3, 3, 2])
    expect(byModuleB.series.map(row => row.points)).toEqual([6, 9, 9, 8])
    const combined = await read(`moduleId=${moduleA},${moduleB}&versionId=${versionB}&sprintId=${sprintA},${sprintB}&type=TASK`)
    expect(combined.series.map(row => row.total)).toEqual([1, 2, 2, 1])
    const empty = await read(`moduleId=${generateId()}`)
    expect(empty.series.every(row => row.total === 0 && row.points === 0)).toBe(true)
    const ignoredPeople = await read(`assigneeId=${generateId()}&squadId=${generateId()}`)
    expect(ignoredPeople.filters.inapplicable).toContain('squadId')
    expect(ignoredPeople.filters.inapplicable).toContain('assigneeId')
    expect(ignoredPeople.series.map(row => row.total)).toEqual(baseline.series.map(row => row.total))

    await db.update(projectAnalyticsDimensionMeta).set({ status: 'BUILDING' }).where(eq(projectAnalyticsDimensionMeta.projectId, projectId))
    const replayByModuleB = await read(`moduleId=${moduleB}`)
    expect(replayByModuleB.series).toEqual(byModuleB.series)
    expect(replayByModuleB.warnings).toContain('DASHBOARD_DIMENSION_PROJECTION_FALLBACK')
    await persistence.analytics.backfillDimensionProjections()
  })
})

describe('agregação de horas por SQL (Item 13)', () => {
  let tenantId: string
  let projectId: string
  let authorId: string
  let adminToken: string

  beforeAll(async () => {
    tenantId = generateId()
    await db.insert(tenants).values({ id: tenantId, name: 'Hours tenant', slug: `hours-${tenantId.slice(0, 8)}`, createdAt: now })
    authorId = generateId()
    const authorEmail = `${generateId()}@hours.test`
    await db.insert(users).values({ id: authorId, tenantId, email: authorEmail, passwordHash: 'h', name: 'Author', theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', createdAt: now })
    projectId = generateId()
    await db.insert(projects).values({ id: projectId, tenantId, name: 'Projeto hours', createdAt: now })
    await db.insert(memberships).values({ id: generateId(), tenantId, userId: authorId, projectId, role: 'ADMIN', createdAt: now })
    adminToken = await token(authorId, tenantId, authorEmail)

    // Semente: história → item com 7 logs manuais (somando 70 minutos)
    const storyId = generateId()
    const itemId = generateId()
    await db.insert(items).values([
      { id: storyId, tenantId, projectId, type: 'STORY', parentId: null, columnId: null, ancestryPath: '[]', title: 'História horas', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, authorId, createdAt: now, updatedAt: now },
      { id: itemId, tenantId, projectId, type: 'TASK', parentId: storyId, columnId: null, ancestryPath: '[]', title: 'Card horas', status: 'IN_PROGRESS', priority: 'MEDIUM', position: 0, authorId, createdAt: now, updatedAt: now },
    ])
    const { itemLogs } = await import('./db/schema')
    await db.insert(itemLogs).values(Array.from({ length: 7 }, (_, index) => ({
      id: generateId(), tenantId, itemId, authorId, type: 'manual' as const, activity: `Trabalho ${index + 1}`,
      actorType: 'HUMAN' as const, source: 'REST' as const, durationMin: 10, createdAt: now, updatedAt: now,
    })))
  })

  test('limite de linhas, total por SQL e autor via parâmetro (2.4)', async () => {
    const filters = `from=2026-01-01&to=2026-12-31&authorId=${authorId}`
    const response = await request(`/projects/${projectId}/dashboard/hours?limit=5&${filters}`, adminToken)
    expect(response.status).toBe(200)
    const body = await response.json() as { totalMinutes: number; totalRows: number; byAuthor: Array<{ totalMinutes: number }>; pagination: { hasMore: boolean; nextCursor: string | null }; rows: Array<{ id: string; durationMin: number }>; limit: number }
    expect(body.totalMinutes).toBe(70) // soma SQL sobre todas as linhas
    expect(body.totalRows).toBe(7)
    expect(body.byAuthor).toEqual([expect.objectContaining({ totalMinutes: 70 })])
    expect(body.rows).toHaveLength(5) // limite aplicável
    expect(new TextEncoder().encode(JSON.stringify(body)).byteLength).toBeLessThan(256 * 1024)
    expect(body.rows.every(row => row.durationMin === 10)).toBe(true)
    expect(body.pagination).toMatchObject({ hasMore: true })
    expect(body.pagination.nextCursor).toBeTruthy()

    const concurrentLogId = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    await db.insert(itemLogs).values({
      id: concurrentLogId, tenantId, itemId: (await db.select({ id: items.id }).from(items).where(eq(items.projectId, projectId)).limit(1))[0]!.id,
      authorId, type: 'manual', actorType: 'HUMAN', actorLabel: null, source: 'REST', activity: 'Registro durante paginação',
      durationMin: 5, createdAt: now, updatedAt: now,
    })

    const next = await request(`/projects/${projectId}/dashboard/hours?limit=5&${filters}&cursor=${encodeURIComponent(body.pagination.nextCursor!)}`, adminToken)
    expect(next.status).toBe(200)
    const nextBody = await next.json() as typeof body
    expect(nextBody.totalMinutes).toBe(75)
    expect(nextBody.totalRows).toBe(8)
    expect(nextBody.byAuthor[0]?.totalMinutes).toBe(75)
    expect(nextBody.rows).toHaveLength(3)
    expect(nextBody.rows.every(row => !body.rows.some(first => first.id === row.id))).toBe(true)
    expect(nextBody.rows.some(row => row.id === concurrentLogId)).toBe(true)
    expect(nextBody.pagination).toMatchObject({ hasMore: false, nextCursor: null })
    const crossFilter = await request(`/projects/${projectId}/dashboard/hours?authorId=missing&cursor=${encodeURIComponent(body.pagination.nextCursor!)}`, adminToken)
    expect(crossFilter.status).toBe(422)

    // sem authorId correspondente: zero linhas e total zero
    const empty = await request(`/projects/${projectId}/dashboard/hours?authorId=missing`, adminToken)
    const emptyBody = await empty.json() as { totalMinutes: number; totalRows: number; rows: unknown[] }
    expect(emptyBody.totalMinutes).toBe(0)
    expect(emptyBody.totalRows).toBe(0)
    expect(emptyBody.rows).toHaveLength(0)
  })

  test('teste sintético de performance: rollup responde com histórico grande (3.4)', async () => {
    // [CUTOVER] garante cobertura para o tenant de horas antes de gerar eventos
    await db.insert(projectAnalyticsCoverage).values({ projectId, tenantId, coverageStartedAt: now, createdAt: now }).onConflictDoNothing()
    // Gera 400 transições incrementais seguidas e consulta o burnup (rollup);
    // a leitura não repasse todos os eventos — a série sai do acervo.
    const startedAt = performance.now() as unknown as number
    await db.transaction(async (tx) => {
      for (let index = 0; index < 200; index++) {
        const status = index % 2 === 0 ? 'IN_PROGRESS' : 'DONE'
        await appendAnalyticsEvent(tx, {
          tenantId, projectId, itemId: `perf-${index}`, eventType: 'STATUS_CHANGED', actorId: 'perf', origin: 'SYSTEM',
          occurredAt: new Date(Date.parse('2026-02-01T00:00:00.000Z') + index * 60_000).toISOString(),
          before: { parentId: null, type: 'TASK' as const, isLeaf: true, status: 'NOT_STARTED' as const, points: 2, sprintIds: [], versionId: null, moduleId: null },
          after: { parentId: null, type: 'TASK' as const, isLeaf: true, status: status as 'IN_PROGRESS' | 'DONE', points: 2, sprintIds: [], versionId: null, moduleId: null },
        })
      }
    })
    const readStart = performance.now()
    const series = await readDailyRollupSeries(db, tenantId, projectId, '2026-02-01', '2026-12-31')
    const readMs = performance.now() - readStart
    // A resposta da leitura do acervo deve ser rápida mesmo com histórico grande
    expect(series.size).toBeGreaterThan(0)
    expect(readMs).toBeLessThan(500) // leitura de poucas linhas agregadas
    expect(performance.now() - startedAt).toBeGreaterThan(0)
  })
})
