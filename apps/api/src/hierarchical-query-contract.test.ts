// [CONTRATO-ESTRUTURAL] impede regressão aos padrões N+1 nas operações
// hierárquicas. Medições dinâmicas complementares vivem nos testes dos adapters.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const apiRoot = join(import.meta.dir)
function source(path: string) { return readFileSync(join(apiRoot, path), 'utf8') }

describe('contrato de consultas hierárquicas em lote', () => {
  test('leaf check usa hasChildren sem materializar todos os itens do projeto', () => {
    const application = source('application/itemRules.ts')
    const helper = application.slice(application.indexOf('export async function isLeaf'), application.indexOf('export async function resolveProjectTagIds'))
    expect(helper.includes('persistence.items.hasChildren(')).toBe(true)
    expect(helper.includes('listItems(')).toBe(false)
  })

  test('detecção de ciclo consulta uma vez o pai e percorre ancestryPath em memória', () => {
    const application = source('application/itemRules.ts')
    const helper = application.slice(application.indexOf('export async function detectReparentCycle'), application.indexOf('export async function nextSequenceCode'))
    expect(helper.includes('persistence.items.getItem(')).toBe(true)
    expect(helper.includes('ancestry.some(')).toBe(true)
    expect(helper.includes('for (')).toBe(false)
  })

  test('Dashboard pede só a última entrada em BLOCKED/WIP por item aos adapters', () => {
    const sqlite = source('db/sqlite/adapter.ts')
    const postgres = source('db/postgres/adapter.ts')
    for (const adapter of [sqlite, postgres]) {
      const startQuery = adapter.slice(adapter.indexOf('async listTransitionStarts'), adapter.indexOf('async listEvents', adapter.indexOf('async listTransitionStarts')))
      expect(startQuery).toContain('ROW_NUMBER() OVER (PARTITION BY item_id')
      expect(startQuery).toContain("event_type = 'STATUS_CHANGED'")
    }
  })

  test('ciclos ativos agregam compromisso e folhas atuais em SQL set-based', () => {
    const sqlite = source('db/sqlite/adapter.ts')
    const postgres = source('db/postgres/adapter.ts')
    for (const adapter of [sqlite, postgres]) {
      const counts = adapter.slice(adapter.indexOf('async getSprintCycleCommitmentCounts'), adapter.indexOf('async listSprintCycleItems', adapter.indexOf('async getSprintCycleCommitmentCounts')))
      const current = adapter.slice(adapter.indexOf('async getCurrentSprintCycleCounts'), adapter.indexOf('async listHoursLogs', adapter.indexOf('async getCurrentSprintCycleCounts')))
      expect(counts).toContain('COUNT(*)')
      expect(current).toContain('item_sprints')
      expect(current).toContain('NOT EXISTS')
      expect(current).toContain("'ARCHIVED'")
    }
  })

  test('snapshot/team-load agregam por status e responsável nos dois adapters', () => {
    const sqlite = source('db/sqlite/adapter.ts')
    const postgres = source('db/postgres/adapter.ts')
    const sqliteAggregate = sqlite.slice(sqlite.indexOf('async aggregateLeafItems'), sqlite.indexOf('async listSprintItemIds', sqlite.indexOf('async aggregateLeafItems')))
    const postgresAggregate = postgres.slice(postgres.indexOf('async aggregateLeafItems'), postgres.indexOf('async listSprintItemIds', postgres.indexOf('async aggregateLeafItems')))
    expect(sqliteAggregate).toContain('groupBy(items.status, items.assigneeId)')
    expect(postgresAggregate).toContain('GROUP BY i.status, i.assignee_id')
    expect(sqliteAggregate).toContain('COUNT(')
    expect(postgresAggregate).toContain('overdue_count')
  })

  test('detalhes do Dashboard usam páginas set-based e cursors keyset nos dois adapters', () => {
    const sqlite = source('db/sqlite/adapter.ts')
    const postgres = source('db/postgres/adapter.ts')
    const route = source('routes/dashboard.ts')
    expect(route).toContain('aggregateLeafItems(projectContext, projectId, filter, today)')
    expect(route).toContain('listAgingDetailPage(projectContext, projectId, filter,')
    expect(route).toContain('limit + 1')
    for (const adapter of [sqlite, postgres]) {
      const leafPage = adapter.slice(adapter.indexOf('async listLeafItems'), adapter.indexOf('async listAgingDetailPage'))
      const agingPage = adapter.slice(adapter.indexOf('async listAgingDetailPage'), adapter.indexOf('async getDimensionProjectionMeta'))
      const hours = adapter.slice(adapter.indexOf('async listHoursLogs'), adapter.indexOf('agent:', adapter.indexOf('async listHoursLogs')))
      expect(leafPage).toContain('page.limit')
      expect(agingPage).toContain('ORDER BY')
      expect(agingPage.includes('i.id') || agingPage.includes('items.id')).toBe(true)
      expect(hours).toContain('createdAt')
      expect(hours).toContain('totalRows')
      expect(hours).toContain('byAuthor')
    }
  })

  test('burnup filtrado usa projeção pronta antes do fallback de replay', () => {
    const route = source('routes/dashboard.ts')
    const burnup = route.slice(route.indexOf("dashboardRouter.get('/burnup'"), route.indexOf("dashboardRouter.get('/aging'"))
    expect(burnup.indexOf('listDimensionSnapshots')).toBeGreaterThan(-1)
    expect(burnup.indexOf('listDimensionSnapshots')).toBeLessThan(burnup.indexOf('persistence.dashboard.listEvents'))
    expect(burnup).toContain('DASHBOARD_DIMENSION_PROJECTION_FALLBACK')
    const sqlite = source('db/sqlite/adapter.ts')
    const postgres = source('db/postgres/adapter.ts')
    expect(sqlite.slice(sqlite.indexOf('async listDimensionSnapshots'), sqlite.indexOf('async listSprintItemIds'))).toContain('ROW_NUMBER() OVER')
    expect(postgres.slice(postgres.indexOf('async listDimensionSnapshots'), postgres.indexOf('async listSprintItemIds'))).toContain('ROW_NUMBER() OVER')
  })

  test('SQLite percorre descendentes em CTE e calcula snapshots por lote', () => {
    const unit = source('db/sqlite/itemUnitOfWork.ts')
    const analytics = source('db/sqlite/itemAnalytics.ts')
    expect(unit.includes('WITH RECURSIVE subtree')).toBe(true)
    expect(unit.includes('child.tenant_id = ? AND child.project_id = ?')).toBe(true)
    expect(unit.includes('writeAncestryPaths(database')).toBe(true)
    expect(analytics.includes('export function readItemSnapshots(')).toBe(true)
    expect(analytics.includes('export function recordDeletedItemEventsBatch(')).toBe(true)
  })

  test('PostgreSQL usa CTE recursiva e updates por VALUES em lote', () => {
    const adapter = source('db/postgres/adapter.ts')
    expect(adapter.includes('WITH RECURSIVE subtree')).toBe(true)
    expect(adapter.includes('child.tenant_id = $1 AND child.project_id = $2')).toBe(true)
    expect(adapter.includes('FROM (VALUES ${values}) AS paths')).toBe(true)
    expect(adapter.includes('DELETE FROM items WHERE tenant_id = $1 AND project_id = $2 AND id = ANY($3::text[])')).toBe(true)
  })

  test('ciclo de sprint usa join e NOT EXISTS sem loop por item', () => {
    const analytics = source('services/analytics.ts')
    const helper = analytics.slice(analytics.indexOf('export async function createSprintCycle'), analytics.indexOf('export async function closeSprintCycle'))
    expect(helper.includes('.innerJoin(itemSprints')).toBe(true)
    expect(helper.includes('NOT EXISTS')).toBe(true)
    expect(helper.includes('for (const item of projectItems)')).toBe(false)
  })

  test('transição ativa de sprint materializa folhas por INSERT SELECT nos adapters', () => {
    const sqlite = source('db/sqlite/adapter.ts')
    const postgres = source('db/postgres/adapter.ts')
    expect(sqlite.includes('INSERT INTO sprint_cycle_items')).toBe(true)
    expect(sqlite.includes('FROM items AS item')).toBe(true)
    expect(sqlite.includes('AND NOT EXISTS (')).toBe(true)
    expect(sqlite.includes('for (const item of projectItems)')).toBe(false)
    expect(postgres.includes('INSERT INTO sprint_cycle_items (cycle_id')).toBe(true)
    expect(postgres.includes('FROM items AS item')).toBe(true)
    expect(postgres.includes('AND NOT EXISTS (')).toBe(true)
  })

  test('testes dinâmicos fixam limite de leituras em árvore crescente nos adapters', () => {
    const sqliteTests = source('db/sqlite/adapter.test.ts')
    const pgTests = source('db/postgres/parity.test.ts')
    expect(sqliteTests.includes('renomear ancestry não dispara SELECT por descendente')).toBe(true)
    expect(sqliteTests.includes('excluir subárvore não faz SELECT por item ou nível')).toBe(true)
    expect(pgTests.includes('PostgreSQL carrega subárvore profunda em número constante de leituras')).toBe(true)
  })
})
