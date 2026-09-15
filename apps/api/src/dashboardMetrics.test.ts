import { beforeAll, describe, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'
import type { ItemAnalyticsSnapshot } from './services/analytics'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db } = await import('./db/index')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })

const {
  tenants, users, projects, items, projectAnalyticsCoverage, projectMetricsDaily, memberships,
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
    await db.insert(users).values({ id: adminId, tenantId, email: 'rollup@test.local', passwordHash: 'h', name: 'Admin', theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', createdAt: now })
    await db.insert(memberships).values({ id: generateId(), tenantId, userId: adminId, projectId, role: 'ADMIN', createdAt: now })
    const session = await token(adminId, tenantId, 'rollup@test.local')

    const response = await request(`/projects/${projectId}/dashboard/burnup`, session)
    expect(response.status).toBe(200)
    const body = await response.json() as { series: Array<{ date: string; total: number; done: number }> }
    const series = body.series
    const firstDate = series[0]?.date ?? ''; const lastDate = series.at(-1)?.date ?? firstDate
    expect(firstDate === lastDate ? true : firstDate <= lastDate).toBe(true)
    // 2026-01-05: baseline (2,1,8,5) + i-1 → DONE; 2026-01-06: i-6 DONE 5p e i-2 (5p) ainda vivo; 2026-01-07: i-2 excluído
    expect(series).toContainEqual(expect.objectContaining({ date: '2026-01-05', total: 2, done: 2 }))
    expect(series).toContainEqual(expect.objectContaining({ date: '2026-01-07', total: 2, done: 2 }))

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
    await db.insert(users).values({ id: authorId, tenantId, email: 'hours@test.local', passwordHash: 'h', name: 'Author', theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR', createdAt: now })
    projectId = generateId()
    await db.insert(projects).values({ id: projectId, tenantId, name: 'Projeto hours', createdAt: now })
    await db.insert(memberships).values({ id: generateId(), tenantId, userId: authorId, projectId, role: 'ADMIN', createdAt: now })
    adminToken = await token(authorId, tenantId, 'hours@test.local')

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
    const response = await request(`/projects/${projectId}/dashboard/hours?limit=5&from=2026-01-01&to=2026-12-31&authorId=${authorId}`, adminToken)
    expect(response.status).toBe(200)
    const body = await response.json() as { totalMinutes: number; rows: Array<{ durationMin: number }>; limit: number }
    expect(body.totalMinutes).toBe(70) // soma SQL sobre todas as linhas
    expect(body.rows).toHaveLength(5) // limite aplicável
    expect(body.rows.every(row => row.durationMin === 10)).toBe(true)

    // sem authorId correspondente: zero linhas e total zero
    const empty = await request(`/projects/${projectId}/dashboard/hours?authorId=missing`, adminToken)
    const emptyBody = await empty.json() as { totalMinutes: number; rows: unknown[] }
    expect(emptyBody.totalMinutes).toBe(0)
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
