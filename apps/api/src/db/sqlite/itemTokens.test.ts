// T80 — alteração de tokens alimenta o histórico de analytics (evento + snapshot).
import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from '../schema'
import type { PersistenceContext } from '../../persistence/models'
import { createSqlitePersistencePorts } from './adapter'

const migrationsFolder = new URL('../migrations', import.meta.url).pathname
const now = new Date().toISOString()

function setup() {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder })
  sqlite.exec('PRAGMA foreign_keys = ON')
  sqlite.query('INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)').run('tenant-a', 'Tenant A', 'tenant-a', now)
  sqlite.query('INSERT INTO projects (id, tenant_id, name, board_mode, created_at) VALUES (?, ?, ?, ?, ?)').run('project-a', 'tenant-a', 'Projeto A', 'SIMPLE', now)
  sqlite.query('INSERT INTO project_analytics_coverage (project_id, tenant_id, coverage_started_at, baseline_event_id, created_at) VALUES (?, ?, ?, NULL, ?)').run('project-a', 'tenant-a', now, now)
  sqlite.query("INSERT INTO project_analytics_dimension_meta (project_id, tenant_id, projection_version, status, last_sequence, target_sequence, updated_at) VALUES (?, ?, 2, 'READY', -1, NULL, ?)").run('project-a', 'tenant-a', now)
  const context: PersistenceContext = { tenantId: 'tenant-a', actorUserId: null, actorKind: 'SYSTEM' }
  const ports = createSqlitePersistencePorts(db, sqlite)
  const events = (type?: string) => {
    const query = type
      ? 'SELECT event_type, before_snapshot, after_snapshot FROM item_events WHERE project_id = ? AND event_type = ? ORDER BY sequence'
      : 'SELECT event_type, before_snapshot, after_snapshot FROM item_events WHERE project_id = ? ORDER BY sequence'
    return type
      ? sqlite.query<{ event_type: string; before_snapshot: string | null; after_snapshot: string | null }, [string, string]>(query).all('project-a', type)
      : sqlite.query<{ event_type: string; before_snapshot: string | null; after_snapshot: string | null }, [string]>(query).all('project-a')
  }
  return { sqlite, context, ports, events }
}

describe('T80 — tokens no histórico de analytics', () => {
  test('criação com tokens registra o valor no snapshot do evento', async () => {
    const { sqlite, context, ports, events } = setup()
    const item = await ports.items.createItem(context, { projectId: 'project-a', type: 'TASK', title: 'Card', tokensInput: 1200, tokensOutput: 300 } as never)
    const created = events('ITEM_CREATED')
    expect(created).toHaveLength(1)
    const snapshot = JSON.parse(created[0]!.after_snapshot!) as { tokensInput: number | null; tokensOutput: number | null }
    expect(snapshot).toMatchObject({ tokensInput: 1200, tokensOutput: 300 })
    expect(item.tokensInput).toBe(1200)
    sqlite.close()
  })

  test('edição de tokens gera exatamente um evento TOKENS_CHANGED', async () => {
    const { sqlite, context, ports, events } = setup()
    const item = await ports.items.createItem(context, { projectId: 'project-a', type: 'TASK', title: 'Card' } as never)
    await ports.items.updateItem(context, 'project-a', item.id, { tokensInput: 100, tokensOutput: 50 })
    expect(events('TOKENS_CHANGED')).toHaveLength(1)
    sqlite.close()
  })

  test('limpar tokens gera evento com saída dos valores', async () => {
    const { sqlite, context, ports, events } = setup()
    const item = await ports.items.createItem(context, { projectId: 'project-a', type: 'TASK', title: 'Card', tokensInput: 10, tokensOutput: 5 } as never)
    await ports.items.updateItem(context, 'project-a', item.id, { tokensInput: null, tokensOutput: null })
    const tokenEvents = events('TOKENS_CHANGED')
    expect(tokenEvents).toHaveLength(1)
    const after = JSON.parse(tokenEvents[0]!.after_snapshot!) as { tokensInput: number | null; tokensOutput: number | null }
    expect(after).toMatchObject({ tokensInput: null, tokensOutput: null })
    sqlite.close()
  })

  test('edição sem tokens não gera evento de tokens', async () => {
    const { sqlite, context, ports, events } = setup()
    const item = await ports.items.createItem(context, { projectId: 'project-a', type: 'TASK', title: 'Card' } as never)
    await ports.items.updateItem(context, 'project-a', item.id, { title: 'Card renomeado' })
    expect(events('TOKENS_CHANGED')).toHaveLength(0)
    sqlite.close()
  })
})
