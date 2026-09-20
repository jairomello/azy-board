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

  test('auditoria read-only detecta órfãos de checklist, passos e anexos', () => {
    const { sqlite } = migratedDatabase()
    seedTenant(sqlite, 'tenant-a')
    seedProject(sqlite, 'project-a', 'tenant-a')
    seedItem(sqlite, 'item-a', 'tenant-a', 'project-a')
    expect(auditIntegrity(sqlite)).toEqual([])
    // A auditoria é read-only; para "fabricar" violações numa base com FKs ativas,
    // o teste desliga a checagem apenas para a injeção (como faria uma base legada).
    sqlite.exec('PRAGMA foreign_keys = OFF;')
    // Checklist sem item pai — injetado direto no banco
    sqlite.query("INSERT INTO checklists (id, tenant_id, item_id, name, position, created_at) VALUES ('cl-orfan', 'tenant-a', 'item-missing', 'CL', 0, ?)")
      .run(now)
    sqlite.query("INSERT INTO checklist_items (id, tenant_id, checklist_id, text, checked, position) VALUES ('ci-orfan', 'tenant-a', 'cl-missing', 'Passo', 0, 0)")
      .run()
    sqlite.query("INSERT INTO attachments (id, tenant_id, item_id, filename, original_name, mime_type, size, storage_path, created_at) VALUES ('at-orfan', 'tenant-a', 'item-missing', 'a.txt', 'a.txt', 'text/plain', 1, '/tmp/a', ?)")
      .run(now)
    sqlite.exec('PRAGMA foreign_keys = ON;')
    const violations = auditIntegrity(sqlite)
    const checks = violations.map(violation => violation.check).sort()
    expect(checks).toContain('orphan_checklist_item')
    expect(checks).toContain('orphan_checklist_step')
    expect(checks).toContain('orphan_attachment_item')
    expect(violations.every(violation => violation.count === 1)).toBe(true)
    // A auditoria é somente leitura: nada foi apagado
    expect((sqlite.query('SELECT COUNT(*) AS count FROM checklists WHERE id = ?').get('cl-orfan') as { count: number }).count).toBe(1)
    sqlite.close()
  })

  test('auditoria reporta jobs de limpeza vencidos e failures sem modificá-los', () => {
    const { sqlite } = migratedDatabase()
    seedTenant(sqlite, 'tenant-a')
    // Job vencido há 3 dias e job marcado como FAILED permanente
    sqlite.query("INSERT INTO storage_cleanup_jobs (id, tenant_id, storage_path, resource_type, status, attempts, available_at, created_at, updated_at) VALUES ('job-stale', 'tenant-a', '/tmp/old', 'ATTACHMENT', 'PENDING', 0, ?, ?, ?)")
      .run(new Date(Date.now() - 3 * 24 * 3600_000).toISOString(), now, now)
    sqlite.query("INSERT INTO storage_cleanup_jobs (id, tenant_id, storage_path, resource_type, status, attempts, available_at, created_at, updated_at) VALUES ('job-failed', 'tenant-a', '/tmp/broken', 'ATTACHMENT', 'FAILED', 8, ?, ?, ?)")
      .run(now, now, now)
    const checks = auditIntegrity(sqlite).map(violation => violation.check)
    expect(checks).toContain('stale_storage_cleanup_jobs')
    expect(checks).toContain('failed_storage_cleanup_jobs')
    expect((sqlite.query("SELECT COUNT(*) AS count FROM storage_cleanup_jobs WHERE status != 'DONE'").get() as { count: number }).count).toBe(2)
    sqlite.close()
  })

  test('cascade remove avatar com o usuário e auditoria detecta avatar órfão', () => {
    const { sqlite } = migratedDatabase()
    seedTenant(sqlite, 'tenant-a')
    seedUser(sqlite, 'user-1', 'tenant-a', 'user@example.com')
    const insertAvatar = sqlite.query('INSERT INTO user_avatars (tenant_id, user_id, mime_type, size_bytes, width, height, content_hash, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    insertAvatar.run('tenant-a', 'user-1', 'image/webp', 10, 256, 256, 'hash-1', new Uint8Array([1, 2, 3]), now)
    expect(auditIntegrity(sqlite)).toEqual([])

    // Cascade: remover o usuário remove o avatar.
    sqlite.query('DELETE FROM users WHERE id = ?').run('user-1')
    expect((sqlite.query('SELECT COUNT(*) AS count FROM user_avatars').get() as { count: number }).count).toBe(0)

    // Órfão fabricado (base legada, FKs desligadas só na injeção) é detectado.
    sqlite.exec('PRAGMA foreign_keys = OFF;')
    insertAvatar.run('tenant-a', 'user-missing', 'image/webp', 10, 256, 256, 'hash-2', new Uint8Array([1]), now)
    sqlite.exec('PRAGMA foreign_keys = ON;')
    expect(auditIntegrity(sqlite).map(violation => violation.check)).toContain('orphan_user_avatar')
    sqlite.close()
  })
})

describe('integridade dos campos avançados de checklist (Card T5)', () => {
  test('auditoria detecta responsável de passo que não é membro do projeto', () => {
    const { sqlite } = migratedDatabase()
    seedTenant(sqlite, 'tenant-a')
    seedUser(sqlite, 'user-member', 'tenant-a', 'member@a.local')
    seedUser(sqlite, 'user-outsider', 'tenant-a', 'outsider@a.local')
    seedProject(sqlite, 'project-a', 'tenant-a')
    sqlite.query("INSERT INTO memberships (id, tenant_id, user_id, project_id, role, created_at) VALUES ('m1', 'tenant-a', 'user-member', 'project-a', 'MEMBER', ?)").run(now)
    seedItem(sqlite, 'item-a', 'tenant-a', 'project-a')
    sqlite.query("INSERT INTO checklists (id, tenant_id, item_id, name, position, created_at) VALUES ('cl-a', 'tenant-a', 'item-a', 'CL', 0, ?)").run(now)
    sqlite.query("INSERT INTO checklist_items (id, tenant_id, checklist_id, text, checked, position, assignee_id) VALUES ('ci-ok', 'tenant-a', 'cl-a', 'Passo', 0, 0, 'user-member')").run()
    expect(auditIntegrity(sqlite)).toEqual([])

    sqlite.query("INSERT INTO checklist_items (id, tenant_id, checklist_id, text, checked, position, assignee_id) VALUES ('ci-bad', 'tenant-a', 'cl-a', 'Passo', 0, 1, 'user-outsider')").run()
    const violations = auditIntegrity(sqlite)
    expect(violations.find(violation => violation.check === 'checklist_step_assignee_not_member')?.count).toBe(1)
    sqlite.close()
  })
})
