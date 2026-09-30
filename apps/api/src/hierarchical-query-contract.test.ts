// [CONTRATO-ESTRUTURAL] impede regressão aos padrões N+1 nas operações
// hierárquicas. Medições dinâmicas complementares vivem nos testes dos adapters.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const apiRoot = join(import.meta.dir)
function source(path: string) { return readFileSync(join(apiRoot, path), 'utf8') }

describe('contrato de consultas hierárquicas em lote', () => {
  test('leaf check usa hasChildren sem materializar todos os itens do projeto', () => {
    const route = source('routes/items.ts')
    const helper = route.slice(route.indexOf('async function isLeaf'), route.indexOf('// [TENANT] Valida que todas as tags'))
    expect(helper.includes('persistence.items.hasChildren(')).toBe(true)
    expect(helper.includes('listItems(')).toBe(false)
  })

  test('detecção de ciclo consulta uma vez o pai e percorre ancestryPath em memória', () => {
    const route = source('routes/items.ts')
    const helper = route.slice(route.indexOf('async function detectReparentCycle'), route.indexOf('// Gera o próximo sequenceCode'))
    expect(helper.includes('persistence.items.getItem(')).toBe(true)
    expect(helper.includes('ancestry.some(')).toBe(true)
    expect(helper.includes('for (')).toBe(false)
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
