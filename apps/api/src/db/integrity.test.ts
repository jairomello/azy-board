import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from './schema'
import { auditIntegrity } from './integrity'
import { generateId } from '../utils/id'

const migrationsFolder = new URL('./migrations', import.meta.url).pathname

function migratedDatabase() {
  const sqlite = new Database(':memory:')
  const database = drizzle(sqlite, { schema })
  migrate(database, { migrationsFolder })
  sqlite.exec('PRAGMA foreign_keys = ON;')
  return { sqlite, database }
}

const now = new Date().toISOString()

function seedTenant(sqlite: Database, id: string) {
  sqlite.query('INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)').run(id, id, id, now)
}

function seedUser(sqlite: Database, id: string, tenantId: string, email: string) {
  sqlite.query('INSERT INTO users (id, tenant_id, email, password_hash, name, global_group, theme, light_shell_theme, language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, tenantId, email, 'hash', id, 'TEAM_MEMBER', 'light', 'petroleum', 'pt-BR', now)
}

function seedProject(sqlite: Database, id: string, tenantId: string) {
  sqlite.query('INSERT INTO projects (id, tenant_id, name, board_mode, is_restricted, is_hidden, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, tenantId, id, 'HIERARCHICAL', 0, 0, now)
}

function seedItem(sqlite: Database, id: string, tenantId: string, projectId: string, parentId: string | null = null) {
  sqlite.query('INSERT INTO items (id, tenant_id, project_id, type, parent_id, ancestry_path, title, status, priority, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, tenantId, projectId, 'TASK', parentId, '[]', id, 'NOT_STARTED', 'MEDIUM', 0, now, now)
}

describe('integridade do schema', () => {
  test('aplica constraints de FK compostas e de hierarquia', () => {
    const { sqlite } = migratedDatabase()
    const itemFks = sqlite.query('PRAGMA foreign_key_list(items)').all() as Array<{ from: string; table: string; to: string }>
    const parentFk = itemFks.find(fk => fk.from === 'parent_id')
    expect(parentFk).toBeTruthy()
    expect(parentFk?.table).toBe('items')

    const membershipIndexes = (sqlite.query("PRAGMA index_list('memberships')").all() as Array<{ name: string; unique: number }>)
    expect(membershipIndexes.some(index => index.name === 'memberships_tenant_project_user_unique')).toBe(true)

    expect((sqlite.query("PRAGMA table_info('item_tags')").all() as Array<{ name: string }>).some(column => column.name === 'tenant_id')).toBe(true)
    const emailIndexes = (sqlite.query("PRAGMA index_list('users')").all() as Array<{ name: string; unique: number }>)
    expect(emailIndexes.some(index => index.name === 'users_tenant_email_unique' && index.unique === 1)).toBe(true)
    sqlite.close()
  })

  test('rejeita vínculo cross-tenant na hierarquia', () => {
    const { sqlite } = migratedDatabase()
    seedTenant(sqlite, 'tenant-a')
    seedTenant(sqlite, 'tenant-b')
    seedProject(sqlite, 'project-a', 'tenant-a')
    seedProject(sqlite, 'project-b', 'tenant-b')
    seedItem(sqlite, 'parent-a', 'tenant-a', 'project-a')
    seedItem(sqlite, 'parent-b', 'tenant-b', 'project-b')
    expect(() => seedItem(sqlite, 'child', 'tenant-a', 'project-a', 'parent-b')).toThrow()
    sqlite.close()
  })

  test('rejeita e-mail duplicado no mesmo tenant e aceita em tenants diferentes', () => {
    const { sqlite } = migratedDatabase()
    seedTenant(sqlite, 'tenant-a')
    seedTenant(sqlite, 'tenant-b')
    seedUser(sqlite, 'user-1', 'tenant-a', 'user@example.com')
    expect(() => seedUser(sqlite, 'user-2', 'tenant-a', 'user@example.com')).toThrow()
    seedUser(sqlite, 'user-3', 'tenant-b', 'user@example.com')
    sqlite.close()
  })

  test('rejeita membership duplicado', () => {
    const { sqlite } = migratedDatabase()
    seedTenant(sqlite, 'tenant-a')
    seedUser(sqlite, 'user-1', 'tenant-a', 'user@example.com')
    seedProject(sqlite, 'project-a', 'tenant-a')
    const insert = sqlite.query('INSERT INTO memberships (id, tenant_id, user_id, project_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    insert.run(generateId(), 'tenant-a', 'user-1', 'project-a', 'MEMBER', now)
    expect(() => insert.run(generateId(), 'tenant-a', 'user-1', 'project-a', 'ADMIN', now)).toThrow()
    sqlite.close()
  })

  test('rejeita tag repetida no mesmo item', () => {
    const { sqlite } = migratedDatabase()
    seedTenant(sqlite, 'tenant-a')
    seedProject(sqlite, 'project-a', 'tenant-a')
    seedItem(sqlite, 'item-a', 'tenant-a', 'project-a')
    sqlite.query('INSERT INTO tags (id, tenant_id, project_id, name, color) VALUES (?, ?, ?, ?, ?)').run('tag-a', 'tenant-a', 'project-a', 'Tag', '#000')
    const insert = sqlite.query('INSERT INTO item_tags (tenant_id, item_id, tag_id) VALUES (?, ?, ?)')
    insert.run('tenant-a', 'item-a', 'tag-a')
    expect(() => insert.run('tenant-a', 'item-a', 'tag-a')).toThrow()
    sqlite.close()
  })

  test('rejeita números negativos e datas invertidas', () => {
    const { sqlite } = migratedDatabase()
    seedTenant(sqlite, 'tenant-a')
    seedProject(sqlite, 'project-a', 'tenant-a')
    expect(() => sqlite.query('INSERT INTO items (id, tenant_id, project_id, type, ancestry_path, title, status, priority, points, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('item-neg', 'tenant-a', 'project-a', 'TASK', '[]', 'Neg', 'NOT_STARTED', 'MEDIUM', -1, 0, now, now)).toThrow()
    expect(() => sqlite.query('INSERT INTO sprints (id, tenant_id, project_id, name, status, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('sprint-bad', 'tenant-a', 'project-a', 'Bad', 'PROPOSED', '2026-02-01', '2026-01-01', now)).toThrow()
    sqlite.close()
  })

  test('exclusão de subárvore respeita FKs NO ACTION', () => {
    const { sqlite } = migratedDatabase()
    seedTenant(sqlite, 'tenant-a')
    seedProject(sqlite, 'project-a', 'tenant-a')
    seedItem(sqlite, 'parent-a', 'tenant-a', 'project-a')
    seedItem(sqlite, 'child-a', 'tenant-a', 'project-a', 'parent-a')
    // Excluir o pai antes do filho viola a auto-FK (NO ACTION)
    expect(() => sqlite.query('DELETE FROM items WHERE id = ?').run('parent-a')).toThrow()
    // A aplicação exclui a subárvore inteira em uma única instrução
    sqlite.query('DELETE FROM items WHERE id IN (?, ?)').run('parent-a', 'child-a')
    expect((sqlite.query('SELECT COUNT(*) AS count FROM items').get() as { count: number }).count).toBe(0)
    expect(auditIntegrity(sqlite)).toEqual([])
    sqlite.close()
  })

  test('não deixa órfãos nem duplicatas após operações típicas', () => {
    const { sqlite } = migratedDatabase()
    seedTenant(sqlite, 'tenant-a')
    seedUser(sqlite, 'user-1', 'tenant-a', 'user@example.com')
    seedProject(sqlite, 'project-a', 'tenant-a')
    sqlite.query('INSERT INTO memberships (id, tenant_id, user_id, project_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(generateId(), 'tenant-a', 'user-1', 'project-a', 'MEMBER', now)
    seedItem(sqlite, 'parent-a', 'tenant-a', 'project-a')
    seedItem(sqlite, 'child-a', 'tenant-a', 'project-a', 'parent-a')
    expect(auditIntegrity(sqlite)).toEqual([])
    sqlite.close()
  })
})
