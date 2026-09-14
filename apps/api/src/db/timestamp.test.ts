import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from './schema'
import { mkdir } from 'node:fs/promises'

const migrationsFolder = new URL('./migrations', import.meta.url).pathname
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const NOW_WINDOW_MS = 5 * 60 * 1000

function freshMigrated() {
  const sqlite = new Database(':memory:')
  const database = drizzle(sqlite, { schema })
  migrate(database, { migrationsFolder })
  sqlite.exec('PRAGMA foreign_keys = ON;')
  return { sqlite, database }
}

function isRecentIso(value: string | null | undefined) {
  return typeof value === 'string' && ISO_UTC.test(value) && Math.abs(Date.now() - Date.parse(value)) < NOW_WINDOW_MS
}

describe('defaults temporais', () => {
  test('inserts via Drizzle recebem o instante atual, não o do carregamento', () => {
    const { sqlite, database } = freshMigrated()
    database.insert(schema.tenants).values({ id: 'tenant-a', name: 'A', slug: 'tenant-a' }).run()
    database.insert(schema.tenants).values({ id: 'tenant-b', name: 'B', slug: 'tenant-b' }).run()
    const rows = database.select({ id: schema.tenants.id, createdAt: schema.tenants.createdAt }).from(schema.tenants).all()
    expect(rows).toHaveLength(2)
    for (const row of rows) expect(isRecentIso(row.createdAt)).toBe(true)
    sqlite.close()
  })

  test('insert SQL direto omitindo timestamp usa default dinâmico ISO UTC', () => {
    const { sqlite } = freshMigrated()
    sqlite.query('INSERT INTO tenants (id, name, slug) VALUES (?, ?, ?)').run('tenant-direct', 'D', 'tenant-direct')
    const row = sqlite.query('SELECT created_at AS createdAt FROM tenants WHERE id = ?').get('tenant-direct') as { createdAt: string }
    expect(isRecentIso(row.createdAt)).toBe(true)
    sqlite.close()
  })

  test('migration preserva histórico e passa a produzir defaults dinâmicos', async () => {
    const source = migrationsFolder
    const journal = JSON.parse(await Bun.file(`${source}/meta/_journal.json`).text()) as {
      version: string
      dialect: string
      entries: Array<{ idx: number; tag: string }>
    }
    const prefixEntries = journal.entries.filter(entry => entry.idx <= 21)
    const pre = `/tmp/azyboard-timestamp-${crypto.randomUUID()}`
    await mkdir(`${pre}/meta`, { recursive: true })
    for (const entry of prefixEntries) {
      await Bun.write(`${pre}/${entry.tag}.sql`, await Bun.file(`${source}/${entry.tag}.sql`).text())
    }
    await Bun.write(`${pre}/meta/_journal.json`, JSON.stringify({ ...journal, entries: prefixEntries }))

    const sqlite = new Database(':memory:')
    const database = drizzle(sqlite, { schema })
    migrate(database, { migrationsFolder: pre })

    // Base pré-correção: reproduz o default físico congelado gravado pela migration 0021.
    sqlite.query('INSERT INTO tenants (id, name, slug) VALUES (?, ?, ?)').run('frozen', 'F', 'frozen')
    const frozen = sqlite.query('SELECT created_at AS createdAt FROM tenants WHERE id = ?').get('frozen') as { createdAt: string }
    expect(frozen.createdAt).toBe('2026-09-14T01:21:50.719Z')

    // Histórico explícito que jamais deve ser reescrito pela migration corretiva.
    const history = '2020-01-02T03:04:05.000Z'
    sqlite.query('INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)').run('history', 'H', 'history', history)

    // Aplica a migration corretiva (0022) sobre a base já populada.
    migrate(database, { migrationsFolder: source })

    const historyRow = sqlite.query('SELECT created_at AS createdAt FROM tenants WHERE id = ?').get('history') as { createdAt: string }
    const frozenRow = sqlite.query('SELECT created_at AS createdAt FROM tenants WHERE id = ?').get('frozen') as { createdAt: string }
    expect(historyRow.createdAt).toBe(history)
    expect(frozenRow.createdAt).toBe('2026-09-14T01:21:50.719Z')

    // Depois da correção, novas inserções passam a receber o instante atual.
    sqlite.query('INSERT INTO tenants (id, name, slug) VALUES (?, ?, ?)').run('fresh', 'N', 'fresh')
    const freshRow = sqlite.query('SELECT created_at AS createdAt FROM tenants WHERE id = ?').get('fresh') as { createdAt: string }
    expect(isRecentIso(freshRow.createdAt)).toBe(true)

    // Integridade e constraints preservadas após os rebuilds.
    expect(sqlite.query('PRAGMA foreign_key_check').all()).toEqual([])
    const itemsFks = sqlite.query('PRAGMA foreign_key_list(items)').all() as Array<{ from: string }>
    expect(itemsFks.some(fk => fk.from === 'parent_id')).toBe(true)
    const usersIndexes = sqlite.query("PRAGMA index_list('users')").all() as Array<{ name: string }>
    expect(usersIndexes.some(index => index.name === 'users_tenant_email_unique')).toBe(true)

    // Reexecutar o fluxo completo é idempotente e não altera o histórico.
    migrate(database, { migrationsFolder: source })
    expect((sqlite.query('SELECT created_at AS createdAt FROM tenants WHERE id = ?').get('history') as { createdAt: string }).createdAt).toBe(history)
    sqlite.close()
  })

  test('timestamp obrigatório sem default continua exigindo valor explícito', () => {
    const { sqlite } = freshMigrated()
    sqlite.query('INSERT INTO tenants (id, name, slug) VALUES (?, ?, ?)').run('tenant-a', 'A', 'tenant-a')
    sqlite.query("INSERT INTO projects (id, tenant_id, name) VALUES (?, ?, ?)").run('project-a', 'tenant-a', 'P')
    // project_versions.created_at é NOT NULL sem default: omitir deve falhar.
    expect(() => sqlite.query("INSERT INTO project_versions (id, tenant_id, project_id, name) VALUES (?, ?, ?, ?)")
      .run('version-a', 'tenant-a', 'project-a', 'V1')).toThrow()
    sqlite.close()
  })
})
