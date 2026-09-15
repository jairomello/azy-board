import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from './schema'
import { eq } from 'drizzle-orm'
import { mkdir } from 'node:fs/promises'

describe('migration de outbox de limpeza de storage (Item 12)', () => {
  const migrationsFolder = new URL('./migrations', import.meta.url).pathname

  test('aplica em base vazia, é idempotente e mantém foreign_key_check limpo', () => {
    const sqlite = new Database(':memory:')
    const database = drizzle(sqlite, { schema })
    migrate(database, { migrationsFolder })
    migrate(database, { migrationsFolder })
    const tables = sqlite.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>
    expect(tables.map(table => table.name)).toContain('storage_cleanup_jobs')
    // Base vazia, base recém-migrada e associação típica preservadas
    expect((sqlite.query('SELECT COUNT(*) AS count FROM storage_cleanup_jobs').get() as { count: number }).count).toBe(0)
    expect(sqlite.query('PRAGMA foreign_key_check').all()).toEqual([])
    expect((sqlite.query("PRAGMA index_list('storage_cleanup_jobs')").all() as Array<{ name: string; unique: number }>)
      .some(index => index.name === 'storage_cleanup_pending_path_unique' && index.unique === 1)).toBe(true)
    sqlite.close()
  })

  test('migra base com dados legados preservando contagens e constraints', async () => {
    const sqlite = new Database(':memory:')
    const database = drizzle(sqlite, { schema })
    const pre = `/tmp/azyboard-migrations-${crypto.randomUUID()}`
    await mkdir(`${pre}/meta`, { recursive: true })
    const source = new URL('./migrations', import.meta.url).pathname
    const journal = JSON.parse(await Bun.file(`${source}/meta/_journal.json`).text()) as { version: string; dialect: string; entries: Array<{ tag: string }> }
    const upTo = journal.entries.filter(entry => !entry.tag.startsWith('0023')).map(entry => entry.tag + '.sql')
    for (const file of upTo) await Bun.write(`${pre}/${file}`, await Bun.file(`${source}/${file}`).text())
    await Bun.write(`${pre}/meta/_journal.json`, JSON.stringify({ ...journal, entries: journal.entries.filter(entry => !entry.tag.startsWith('0023')) }))
    migrate(database, { migrationsFolder: pre })

    const now = new Date().toISOString()
    // Base legada populada: tenant + resto mínimo exigido pelas FKs
    await database.insert(schema.tenants).values({ id: 'legacy-tenant', name: 'Legacy', slug: 'legacy', createdAt: now })
    await database.insert(schema.projects).values({ id: 'legacy-project', tenantId: 'legacy-tenant', name: 'Legacy', createdAt: now })

    migrate(database, { migrationsFolder: source })
    expect((await database.select().from(schema.projects)).filter(row => row.id === 'legacy-project')).toHaveLength(1)
    expect(sqlite.query('PRAGMA foreign_key_check').all()).toEqual([])
    sqlite.close()
  })
})

describe('migration de rollup diário do dashboard (Item 13)', () => {
  const migrationsFolder = new URL('./migrations', import.meta.url).pathname

  test('aplica em base vazia e idempotente com foreign_key_check limpo', () => {
    const sqlite = new Database(':memory:')
    const database = drizzle(sqlite, { schema })
    migrate(database, { migrationsFolder })
    migrate(database, { migrationsFolder })
    const tables = sqlite.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>
    expect(tables.map(table => table.name)).toContain('project_metrics_daily')
    expect((sqlite.query('SELECT COUNT(*) AS count FROM project_metrics_daily').get() as { count: number }).count).toBe(0)
    const indexes = sqlite.query("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{ name: string }>
    expect(indexes.map(index => index.name)).toContain('item_events_item_occurrence_idx')
    expect(indexes.map(index => index.name)).toContain('item_logs_tenant_created_idx')
    expect(sqlite.query('PRAGMA foreign_key_check').all()).toEqual([])
    sqlite.close()
  })

  test('preserva dados legados e aceita rollup populado', async () => {
    const sqlite = new Database(':memory:')
    const database = drizzle(sqlite, { schema })
    await migrate(database, { migrationsFolder })
    // Base "legada" populada: cobertura + eventos existentes devem conviver com o rollup
    const now = new Date().toISOString()
    await database.insert(schema.tenants).values({ id: 'roll-tenant', name: 'Roll', slug: 'roll', createdAt: now })
    await database.insert(schema.projects).values({ id: 'roll-project', tenantId: 'roll-tenant', name: 'Roll', createdAt: now })
    await database.insert(schema.projectAnalyticsCoverage).values({ projectId: 'roll-project', tenantId: 'roll-tenant', coverageStartedAt: '2026-01-05T00:00:00.000Z', createdAt: now })
    await database.insert(schema.projectMetricsDaily).values({ tenantId: 'roll-tenant', projectId: 'roll-project', metricDate: '2026-01-05', total: 2, done: 1, points: 8, donePoints: 5 })
    await migrate(database, { migrationsFolder })
    expect((await database.select().from(schema.projectMetricsDaily)).map(row => row.metricDate)).toContain('2026-01-05')
    expect(sqlite.query('PRAGMA foreign_key_check').all()).toEqual([])
    sqlite.close()
  })
})

describe('migration de analytics', () => {
  test('é idempotente em base vazia e cria índices aditivos', async () => {
    const sqlite = new Database(':memory:')
    const database = drizzle(sqlite, { schema })
    const migrationsFolder = new URL('./migrations', import.meta.url).pathname
    await migrate(database, { migrationsFolder })
    await migrate(database, { migrationsFolder })
    const tables = sqlite.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>
    expect(tables.map(table => table.name)).toContain('item_events')
    expect(tables.map(table => table.name)).toContain('sprint_cycles')
    expect(tables.map(table => table.name)).toContain('assistant_settings')
    expect(tables.map(table => table.name)).toContain('assistant_runs')
    expect((sqlite.query("SELECT COUNT(*) AS count FROM assistant_credentials").get() as { count: number }).count).toBe(0)
    expect((sqlite.query("SELECT COUNT(*) AS count FROM assistant_conversations").get() as { count: number }).count).toBe(0)
    const indexes = sqlite.query("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{ name: string }>
    expect(indexes.map(index => index.name)).toContain('item_sprints_item_sprint_unique')
    expect(indexes.map(index => index.name)).toContain('assistant_runs_tenant_user_idempotency_unique')
    sqlite.close()
  })

  test('migra base atual, deduplica associações e só cria ciclo para sprint aberta', async () => {
    const sqlite = new Database(':memory:')
    const database = drizzle(sqlite, { schema })
    const source = new URL('./migrations', import.meta.url).pathname
    const pre = `/tmp/azyboard-migrations-${crypto.randomUUID()}`
    await mkdir(`${pre}/meta`, { recursive: true })
    const prior = ['0000_unified-item-model.sql', '0001_card-checklists.sql', '0002_card-modal-enhancements.sql', '0003_modules-and-versions.sql', '0004_slippery_absorbing_man.sql', '0005_careful_catseye.sql', '0006_simple-board-mode.sql', '0007_api-key-lifecycle.sql', '0008_idempotency.sql', '0009_user-global-group.sql', '0010_sprint-lifecycle.sql']
    for (const file of prior) await Bun.write(`${pre}/${file}`, await Bun.file(`${source}/${file}`).text())
    const journal = JSON.parse(await Bun.file(`${source}/meta/_journal.json`).text()) as { version: string; dialect: string; entries: unknown[] }
    await Bun.write(`${pre}/meta/_journal.json`, JSON.stringify({ ...journal, entries: journal.entries.slice(0, 11) }))
    await migrate(database, { migrationsFolder: pre })

    const now = new Date().toISOString(); const tenantId = 'migration-tenant'; const projectId = 'migration-project'; const emptyProjectId = 'migration-empty'; const openSprintId = 'migration-open'; const closedSprintId = 'migration-closed'; const itemId = 'migration-item'
    await database.insert(schema.tenants).values({ id: tenantId, name: 'Migration tenant', slug: tenantId, createdAt: now })
    // [DB-SWAP] A base legada (migrações 0000-0010) ainda não possui is_restricted/is_hidden,
    // por isso a inserção é feita em SQL puro: o schema atual já reflete as colunas novas.
    const insertLegacyProject = sqlite.query('INSERT INTO projects (id, tenant_id, name, description, board_mode, simple_story_id, manager_user_id, created_at) VALUES (?, ?, ?, NULL, ?, NULL, NULL, ?)')
    insertLegacyProject.run(projectId, tenantId, 'Current', 'HIERARCHICAL', now)
    insertLegacyProject.run(emptyProjectId, tenantId, 'Empty', 'HIERARCHICAL', now)
    await database.insert(schema.sprints).values([{ id: openSprintId, tenantId, projectId, name: 'Open', status: 'OPEN', startDate: '2026-01-01', endDate: '2026-01-14', createdAt: now }, { id: closedSprintId, tenantId, projectId, name: 'Closed', status: 'CLOSED', startDate: '2026-01-15', endDate: '2026-01-28', createdAt: now }])
    // Simula uma linha criada antes da migration 0020, quando sequence_code ainda não existia.
    sqlite.query('INSERT INTO items (id, tenant_id, project_id, type, parent_id, module_id, title, ancestry_path, status, priority, points, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(itemId, tenantId, projectId, 'TASK', null, null, 'Legacy item', '[]', 'IN_PROGRESS', 'MEDIUM', 3, 0, now, now)
    // Inserção legada (migrações 0000-0010): a tabela ainda não possui tenant_id,
    // por isso usa SQL puro; as duplicatas exercitam a deduplicação da migration 0011.
    const insertLegacyItemSprint = sqlite.query('INSERT INTO item_sprints (item_id, sprint_id) VALUES (?, ?)')
    insertLegacyItemSprint.run(itemId, openSprintId)
    insertLegacyItemSprint.run(itemId, openSprintId)

    await migrate(database, { migrationsFolder: source })
    expect((await database.select().from(schema.itemSprints).where(eq(schema.itemSprints.itemId, itemId)))).toHaveLength(1)
    expect((await database.select().from(schema.projectAnalyticsCoverage)).map(row => row.projectId).sort()).toEqual([emptyProjectId, projectId].sort())
    expect((await database.select().from(schema.itemEvents)).filter(row => row.projectId === emptyProjectId && row.itemId === null)).toHaveLength(1)
    expect((await database.select().from(schema.sprintCycles)).filter(row => row.sprintId === openSprintId)).toHaveLength(1)
    expect((await database.select().from(schema.sprintCycles)).filter(row => row.sprintId === closedSprintId)).toHaveLength(0)
    expect((await database.select().from(schema.sprintCycleItems)).filter(row => row.itemId === itemId)).toHaveLength(1)
    sqlite.close()
  })
})
