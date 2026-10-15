// T80 — recortes e série de tokens de IA no Dashboard.
import { beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import type { ItemAnalyticsSnapshot } from './services/analytics'

process.env.DATABASE_URL = ':memory:'

const { app } = await import('./index')
const { db, sqlite } = await import('./db/index')
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
sqlite.exec('PRAGMA foreign_keys = OFF;')
await migrate(db, { migrationsFolder: new URL('./db/migrations', import.meta.url).pathname })
sqlite.exec('PRAGMA foreign_keys = ON;')

const { tenants, users, projects, items, memberships, projectAnalyticsCoverage } = await import('./db/schema')
const { signJwt } = await import('./services/auth')
const { generateId } = await import('./utils/id')
const { appendAnalyticsEvent } = await import('./services/analytics')
const { recomputeProjectRollup, rollupMatchesReplay } = await import('./services/dashboardMetrics')

async function session(userId: string, tenantId: string, email: string) {
  return signJwt({ sub: userId, tenantId, email, role: 'user' })
}
async function request(path: string, token: string) {
  return app.fetch(new Request(`http://test.local/api${path}`, { headers: { cookie: `session=${token}` } }))
}

const now = new Date().toISOString()

describe('T80 — rollup e projeção de tokens', () => {
  test('paridade acervo↔replay com tokens (reabertura, arquivo e limpeza)', async () => {
    const tenantId = generateId(); const projectId = generateId(); const adminId = generateId()
    const start = '2026-03-01T00:00:00.000Z'
    await db.insert(tenants).values({ id: tenantId, name: 'Tokens', slug: `tok-${tenantId.slice(0, 8)}`, createdAt: now })
    await db.insert(users).values({ id: adminId, tenantId, email: `${adminId}@tok.test`, passwordHash: 'h', name: 'Tok', createdAt: now })
    await db.insert(projects).values({ id: projectId, tenantId, name: 'Projeto tokens', createdAt: now })
    await db.insert(projectAnalyticsCoverage).values({ projectId, tenantId, coverageStartedAt: start, createdAt: now })
    const snapshot = (input: Partial<ItemAnalyticsSnapshot> & Pick<ItemAnalyticsSnapshot, 'type' | 'isLeaf' | 'status' | 'points' | 'moduleId' | 'versionId' | 'sprintIds'>): ItemAnalyticsSnapshot => ({ parentId: null, ...input })
    const base = snapshot({ type: 'TASK', isLeaf: true, status: 'IN_PROGRESS', points: 3, moduleId: null, versionId: null, sprintIds: [], tokensInput: 100, tokensOutput: 20 })
    const done = { ...base, status: 'DONE' as const, tokensInput: 150, tokensOutput: 40 }
    const cleared = { ...done, tokensInput: null, tokensOutput: null }
    await db.transaction(async tx => {
      await appendAnalyticsEvent(tx, { tenantId, projectId, eventType: 'ANALYTICS_BASELINE', actorId: adminId, origin: 'TEST', occurredAt: start, after: [{ itemId: 'i-1', ...base }] as unknown as ItemAnalyticsSnapshot[] })
      await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: 'i-1', eventType: 'TOKENS_CHANGED', actorId: adminId, origin: 'TEST', occurredAt: '2026-03-02T10:00:00.000Z', before: base, after: { ...base, tokensInput: 130 } })
      await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: 'i-1', eventType: 'STATUS_CHANGED', actorId: adminId, origin: 'TEST', occurredAt: '2026-03-03T10:00:00.000Z', before: { ...base, tokensInput: 130 }, after: done })
      await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: 'i-1', eventType: 'TOKENS_CHANGED', actorId: adminId, origin: 'TEST', occurredAt: '2026-03-04T10:00:00.000Z', before: done, after: cleared })
    })
    await recomputeProjectRollup(db, tenantId, projectId)
    expect(await rollupMatchesReplay(tenantId, projectId, '2026-03-01', '2026-03-04')).toBe(true)
    const rows = await db.select().from((await import('./db/schema')).projectMetricsDaily)
      .where(eq((await import('./db/schema')).projectMetricsDaily.projectId, projectId))
      .orderBy((await import('./db/schema')).projectMetricsDaily.metricDate)
    const last = rows.at(-1)!
    expect(last.tokensInput).toBe(0)
    expect(last.doneTokensInput).toBe(0)
  })
})

describe('T80 — endpoint de tokens', () => {
  const tenantId = generateId(); const projectId = generateId(); const viewerId = generateId(); const outsiderId = generateId()
  let adminSession = ''
  let outsiderSession = ''

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Token board', slug: `tb-${tenantId.slice(0, 8)}`, createdAt: now })
    await db.insert(users).values([
      { id: viewerId, tenantId, email: `viewer-${viewerId}@tb.test`, passwordHash: 'h', name: 'Viewer', createdAt: now },
      { id: outsiderId, tenantId, email: `out-${outsiderId}@tb.test`, passwordHash: 'h', name: 'Out', createdAt: now },
    ])
    await db.insert(projects).values({ id: projectId, tenantId, name: 'Projeto token board', createdAt: now })
    await db.insert(memberships).values({ id: generateId(), tenantId, userId: viewerId, projectId, role: 'VIEWER', createdAt: now })
    await db.insert(projectAnalyticsCoverage).values({ projectId, tenantId, coverageStartedAt: '2026-04-01T00:00:00.000Z', createdAt: now })
    await db.insert(items).values([
      { id: 'tk-a', tenantId, projectId, type: 'TASK', title: 'A', ancestryPath: '[]', status: 'DONE', priority: 'MEDIUM', position: 0, points: 3, tokensInput: 1000, tokensOutput: 200, createdAt: now, updatedAt: now },
      { id: 'tk-b', tenantId, projectId, type: 'TASK', title: 'B', ancestryPath: '[]', status: 'IN_PROGRESS', priority: 'MEDIUM', position: 1, points: 2, tokensInput: 400, tokensOutput: 100, createdAt: now, updatedAt: now },
      { id: 'tk-c', tenantId, projectId, type: 'BUG', title: 'C', ancestryPath: '[]', status: 'NOT_STARTED', priority: 'MEDIUM', position: 2, points: null, tokensOutput: 50, createdAt: now, updatedAt: now },
    ])
    adminSession = await session(viewerId, tenantId, `viewer-${viewerId}@tb.test`)
    outsiderSession = await session(outsiderId, tenantId, `out-${outsiderId}@tb.test`)
  })

  test('recortes de estado atual por status, tipo e responsável', async () => {
    const response = await request(`/projects/${projectId}/dashboard/tokens`, adminSession)
    expect(response.status).toBe(200)
    const body = await response.json() as {
      hasTokens: boolean
      filters: { applied: string[]; inapplicable: string[] }
      boxes: { scope: { tokens: number; doneTokens: number; count: number }; byStatus: Array<{ key: string; tokens: number }>; byType: Array<{ key: string; tokens: number }> }
      series: Array<{ date: string; tokens: number }>
    }
    expect(body.hasTokens).toBe(true)
    expect(body.filters.inapplicable).toEqual(['from', 'to'])
    expect(body.boxes.scope).toMatchObject({ tokens: 1750, doneTokens: 1200, count: 3 })
    const byStatus = Object.fromEntries(body.boxes.byStatus.map(row => [row.key, row.tokens]))
    expect(byStatus.DONE).toBe(1200)
    expect(byStatus.IN_PROGRESS).toBe(500)
    expect(byStatus.NOT_STARTED).toBe(50)
  })

  test('período é aplicável à série e declarado inaplicável aos recortes', async () => {
    const response = await request(`/projects/${projectId}/dashboard/tokens?from=2026-04-01&to=2026-04-03`, adminSession)
    const body = await response.json() as { filters: { inapplicable: string[] }; seriesFilters: { applied: string[]; inapplicable: string[] }; series: Array<{ date: string; tokens: number }> }
    expect(body.filters.inapplicable).toContain('from')
    expect(body.seriesFilters.applied).toContain('from')
    expect(body.seriesFilters.inapplicable).toEqual(['squadId', 'assigneeId'])
    expect(body.series.map(row => row.date)).toEqual(['2026-04-01', '2026-04-02', '2026-04-03'])
    // Sem histórico capturado, a semente vem do estado atual na data de início da cobertura.
    expect(body.series.map(row => row.tokens)).toEqual([1750, 1750, 1750])
  })

  test('agrupamento por módulo e filtro por tipo', async () => {
    const response = await request(`/projects/${projectId}/dashboard/tokens?type=TASK`, adminSession)
    const body = await response.json() as { boxes: { scope: { tokens: number; count: number }; byType: Array<Record<string, unknown>> } }
    expect(body.boxes.scope).toMatchObject({ tokens: 1700, count: 2 })
    expect(body.boxes.byType).toEqual([{ key: 'TASK', tokensInput: 1400, tokensOutput: 300, tokens: 1700, doneTokensInput: 1000, doneTokensOutput: 200, count: 2 }])
  })

  test('RBAC: projeto sem membership na resposta protegida', async () => {
    const response = await request(`/projects/${projectId}/dashboard/tokens`, outsiderSession)
    expect(response.status).toBe(404)
  })

  test('cursor inválido é rejeitado sem dados de outro escopo', async () => {
    const response = await request(`/projects/${projectId}/dashboard/tokens?detailCursor=invalido`, adminSession)
    expect(response.status).toBe(422)
  })

  test('resposta respeita o orçamento de payload (256 KiB) e página de detalhe', async () => {
    const response = await request(`/projects/${projectId}/dashboard/tokens?limit=2`, adminSession)
    const text = await response.text()
    expect(new TextEncoder().encode(text).length).toBeLessThan(256 * 1024)
    const body = JSON.parse(text) as { items: unknown[]; pagination: { limit: number; total: number; hasMore: boolean; truncated: boolean } }
    expect(body.items).toHaveLength(2)
    expect(body.pagination).toMatchObject({ limit: 2, total: 3, hasMore: true, truncated: true })
  })

  test('pai oculto pelo filtro não entra no recorte de tokens', async () => {
    const parentProject = generateId()
    await db.insert(projects).values({ id: parentProject, tenantId, name: 'Pai', createdAt: now })
    await db.insert(memberships).values({ id: generateId(), tenantId, userId: viewerId, projectId: parentProject, role: 'VIEWER', createdAt: now })
    const parentId = generateId()
    await db.insert(items).values([
      { id: parentId, tenantId, projectId: parentProject, type: 'TASK', title: 'Pai', ancestryPath: '[]', status: 'IN_PROGRESS', priority: 'MEDIUM', position: 0, points: null, tokensInput: 9999, tokensOutput: 0, createdAt: now, updatedAt: now },
      { id: generateId(), tenantId, projectId: parentProject, parentId, type: 'TASK', title: 'Filho', ancestryPath: '[]', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, points: null, tokensInput: 10, tokensOutput: 0, createdAt: now, updatedAt: now },
    ])
    const response = await request(`/projects/${parentProject}/dashboard/tokens`, adminSession)
    const body = await response.json() as { boxes: { scope: { tokens: number; count: number } } }
    expect(body.boxes.scope).toMatchObject({ tokens: 10, count: 1 })
  })

  test('item em múltiplas sprints aparece uma vez em cada sprint, sem duplicar no total', async () => {
    const sprintProject = generateId(); const sprintA = generateId(); const sprintB = generateId(); const itemId = generateId()
    const { sprints, itemSprints } = await import('./db/schema')
    await db.insert(projects).values({ id: sprintProject, tenantId, name: 'Sprints', createdAt: now })
    await db.insert(memberships).values({ id: generateId(), tenantId, userId: viewerId, projectId: sprintProject, role: 'VIEWER', createdAt: now })
    await db.insert(sprints).values([
      { id: sprintA, tenantId, projectId: sprintProject, name: 'A', status: 'OPEN', startDate: '2026-04-01', endDate: '2026-04-14', createdAt: now },
      { id: sprintB, tenantId, projectId: sprintProject, name: 'B', status: 'PROPOSED', startDate: '2026-04-15', endDate: '2026-04-28', createdAt: now },
    ])
    await db.insert(items).values({ id: itemId, tenantId, projectId: sprintProject, type: 'TASK', title: 'Multi', ancestryPath: '[]', status: 'IN_PROGRESS', priority: 'MEDIUM', position: 0, points: null, tokensInput: 300, tokensOutput: 100, createdAt: now, updatedAt: now })
    await db.insert(itemSprints).values([{ tenantId, itemId, sprintId: sprintA }, { tenantId, itemId, sprintId: sprintB }])
    const response = await request(`/projects/${sprintProject}/dashboard/tokens`, adminSession)
    const body = await response.json() as { boxes: { scope: { tokens: number; count: number }; bySprint: Array<{ key: string; tokens: number }> } }
    expect(body.boxes.scope).toMatchObject({ tokens: 400, count: 1 })
    expect(Object.fromEntries(body.boxes.bySprint.map(row => [row.key, row.tokens]))).toMatchObject({ [sprintA]: 400, [sprintB]: 400 })
  })

  test('projeto sem tokens orienta o registro em vez de exibir zeros', async () => {
    const emptyProject = generateId()
    await db.insert(projects).values({ id: emptyProject, tenantId, name: 'Sem tokens', createdAt: now })
    await db.insert(memberships).values({ id: generateId(), tenantId, userId: viewerId, projectId: emptyProject, role: 'VIEWER', createdAt: now })
    await db.insert(items).values({ id: generateId(), tenantId, projectId: emptyProject, type: 'TASK', title: 'Sem tokens', ancestryPath: '[]', status: 'NOT_STARTED', priority: 'MEDIUM', position: 0, points: null, createdAt: now, updatedAt: now })
    const response = await request(`/projects/${emptyProject}/dashboard/tokens`, adminSession)
    const body = await response.json() as { hasTokens: boolean; boxes: { scope: { tokens: number; count: number } } }
    expect(body.hasTokens).toBe(false)
    expect(body.boxes.scope).toMatchObject({ tokens: 0, count: 1 })
  })
})

describe('T80 — série filtrada pela projeção por dimensão', () => {
  test('projeção pronta devolve tokens iguais ao replay e a reconstrução é idempotente', async () => {
    const tenantId = generateId(); const projectId = generateId(); const adminId = generateId()
    const moduleId = generateId()
    const start = '2026-05-01T00:00:00.000Z'
    const { modules } = await import('./db/schema')
    const { persistence } = await import('./persistence/runtime')
    await db.insert(tenants).values({ id: tenantId, name: 'Proj tokens', slug: `pj-${tenantId.slice(0, 8)}`, createdAt: now })
    await db.insert(users).values({ id: adminId, tenantId, email: `${adminId}@pj.test`, passwordHash: 'h', name: 'Pj', createdAt: now })
    await db.insert(projects).values({ id: projectId, tenantId, name: 'Projeto projeção tokens', createdAt: now })
    await db.insert(memberships).values({ id: generateId(), tenantId, userId: adminId, projectId, role: 'ADMIN', createdAt: now })
    await db.insert(modules).values({ id: moduleId, tenantId, projectId, name: 'Módulo', position: 0 })
    await db.insert(projectAnalyticsCoverage).values({ projectId, tenantId, coverageStartedAt: start, createdAt: now })
    const snapshot = (input: Partial<ItemAnalyticsSnapshot> & Pick<ItemAnalyticsSnapshot, 'type' | 'isLeaf' | 'status' | 'points' | 'moduleId' | 'versionId' | 'sprintIds'>): ItemAnalyticsSnapshot => ({ parentId: null, ...input })
    const base = snapshot({ type: 'TASK', isLeaf: true, status: 'IN_PROGRESS', points: 2, moduleId, versionId: null, sprintIds: [], tokensInput: 500, tokensOutput: 100 })
    await db.transaction(async tx => {
      await appendAnalyticsEvent(tx, { tenantId, projectId, eventType: 'ANALYTICS_BASELINE', actorId: adminId, origin: 'TEST', occurredAt: start, after: [{ itemId: 'p-1', ...base }] as unknown as ItemAnalyticsSnapshot[] })
      await appendAnalyticsEvent(tx, { tenantId, projectId, itemId: 'p-1', eventType: 'TOKENS_CHANGED', actorId: adminId, origin: 'TEST', occurredAt: '2026-05-02T10:00:00.000Z', before: base, after: { ...base, tokensInput: 900 } })
    })
    await persistence.analytics.backfillDimensionProjections(projectId)
    const read = async () => {
      const response = await app.fetch(new Request(`http://test.local/api/projects/${projectId}/dashboard/tokens?moduleId=${moduleId}&from=2026-05-01&to=2026-05-03`, { headers: { cookie: `session=${await session(adminId, tenantId, `${adminId}@pj.test`)}` } }))
      expect(response.status).toBe(200)
      return await response.json() as { projection: { status: string; version?: number }; series: Array<{ date: string; tokens: number }> }
    }
    const first = await read()
    expect(first.projection).toMatchObject({ status: 'READY', version: 2 })
    expect(first.series.map(row => row.tokens)).toEqual([600, 1000, 1000])
    await persistence.analytics.backfillDimensionProjections(projectId)
    const second = await read()
    expect(second.series).toEqual(first.series)
  })
})
