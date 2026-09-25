import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from '../schema'
import type { MutationContext } from '../../persistence/models'
import { createSqliteItemUnitOfWork } from './itemUnitOfWork'

const migrationsFolder = new URL('../migrations', import.meta.url).pathname

function setup() {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder })
  sqlite.exec('PRAGMA foreign_keys = ON')
  const now = new Date().toISOString()
  sqlite.query('INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)').run('tenant-a', 'Tenant A', 'tenant-a', now)
  sqlite.query('INSERT INTO projects (id, tenant_id, name, board_mode, created_at) VALUES (?, ?, ?, ?, ?)').run('project-a', 'tenant-a', 'Projeto A', 'HIERARCHICAL', now)
  const context: MutationContext = {
    tenantId: 'tenant-a', actorUserId: null, actorKind: 'SYSTEM',
    mutation: { origin: 'TEST', actorType: 'SYSTEM', actorSource: 'SYSTEM', actorLabel: null },
  }
  return { sqlite, context, unit: createSqliteItemUnitOfWork(sqlite) }
}

describe('comandos atômicos SQLite para itens', () => {
  test('cria item e relações no mesmo commit', () => {
    const { sqlite, context, unit } = setup()
    const now = new Date().toISOString()
    sqlite.query('INSERT INTO tags (id, tenant_id, project_id, name, color) VALUES (?, ?, ?, ?, ?)').run('tag-a', 'tenant-a', 'project-a', 'Tag A', '#123456')
    sqlite.query('INSERT INTO sprints (id, tenant_id, project_id, name, status, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('sprint-a', 'tenant-a', 'project-a', 'Sprint A', 'PROPOSED', '2026-01-01', '2026-01-14', now)

    const item = unit.createItemWithRelations(context, { projectId: 'project-a', type: 'TASK', title: 'Item atômico' }, { tagIds: ['tag-a'], sprintIds: ['sprint-a'] })

    expect(item.title).toBe('Item atômico')
    expect(sqlite.query('SELECT tag_id FROM item_tags WHERE tenant_id = ? AND item_id = ?').all('tenant-a', item.id)).toEqual([{ tag_id: 'tag-a' }])
    expect(sqlite.query('SELECT sprint_id FROM item_sprints WHERE tenant_id = ? AND item_id = ?').all('tenant-a', item.id)).toEqual([{ sprint_id: 'sprint-a' }])
    sqlite.close()
  })

  test('reverte o item se validar uma relação falha', () => {
    const { sqlite, context, unit } = setup()

    expect(() => unit.createItemWithRelations(context, { projectId: 'project-a', type: 'TASK', title: 'Não deve persistir' }, { tagIds: ['tag-inexistente'] }))
      .toThrow('Vínculo inválido')
    expect(sqlite.query("SELECT id FROM items WHERE title = 'Não deve persistir'").all()).toEqual([])
    sqlite.close()
  })

  test('atualiza campos e relações com evento, rollup e log no mesmo commit', () => {
    const { sqlite, context, unit } = setup()
    const item = unit.createItemWithRelations(context, { projectId: 'project-a', type: 'TASK', title: 'Item atualizado' })

    const updated = unit.updateItemWithRelations(context, 'project-a', item.id, { status: 'DONE', points: 5 }, { activity: 'Campos atualizados' })

    expect(updated?.status).toBe('DONE')
    const eventTypes = sqlite.query<{ event_type: string }, [string, string]>(
      'SELECT event_type FROM item_events WHERE tenant_id = ? AND project_id = ? ORDER BY sequence',
    ).all('tenant-a', 'project-a').map(row => row.event_type)
    expect(eventTypes).toEqual(['ITEM_CREATED', 'STATUS_CHANGED', 'POINTS_CHANGED'])
    const rollup = sqlite.query<{ total: number; done: number; points: number; done_points: number }, [string, string]>(
      'SELECT total, done, points, done_points FROM project_metrics_daily WHERE tenant_id = ? AND project_id = ?',
    ).get('tenant-a', 'project-a')
    expect(rollup).toEqual({ total: 1, done: 2, points: 10, done_points: 10 })
    expect(sqlite.query<{ activity: string }, [string, string]>(
      'SELECT activity FROM item_logs WHERE tenant_id = ? AND item_id = ? ORDER BY created_at',
    ).all('tenant-a', item.id).map(row => row.activity)).toEqual(['Card criado: Item atualizado', 'Campos atualizados'])
    sqlite.close()
  })

  test('recalcula ancestry de toda a subárvore na mesma transação', () => {
    const { sqlite, context, unit } = setup()
    const now = new Date().toISOString()
    const insert = sqlite.query('INSERT INTO items (id, tenant_id, project_id, type, parent_id, ancestry_path, title, status, priority, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    insert.run('parent-old', 'tenant-a', 'project-a', 'STORY', null, '[]', 'Pai antigo', 'NOT_STARTED', 'MEDIUM', 0, now, now)
    insert.run('parent-new', 'tenant-a', 'project-a', 'STORY', null, '[]', 'Pai novo', 'NOT_STARTED', 'MEDIUM', 1, now, now)
    insert.run('child', 'tenant-a', 'project-a', 'TASK', 'parent-old', '[{"id":"parent-old","title":"Pai antigo","type":"STORY"}]', 'Filho', 'NOT_STARTED', 'MEDIUM', 0, now, now)
    insert.run('grandchild', 'tenant-a', 'project-a', 'BUG', 'child', '[{"id":"parent-old","title":"Pai antigo","type":"STORY"},{"id":"child","title":"Filho","type":"TASK"}]', 'Neto', 'NOT_STARTED', 'MEDIUM', 0, now, now)

    unit.reparentSubtree(context, 'project-a', 'child', 'parent-new')

    const child = sqlite.query<{ ancestry_path: string }, [string]>("SELECT ancestry_path FROM items WHERE id = ?").get('child')!
    const grandchild = sqlite.query<{ ancestry_path: string }, [string]>("SELECT ancestry_path FROM items WHERE id = ?").get('grandchild')!
    expect(JSON.parse(child.ancestry_path)).toEqual([{ id: 'parent-new', title: 'Pai novo', type: 'STORY' }])
    expect(JSON.parse(grandchild.ancestry_path)).toEqual([
      { id: 'parent-new', title: 'Pai novo', type: 'STORY' },
      { id: 'child', title: 'Filho', type: 'TASK' },
    ])
    sqlite.close()
  })

  test('exclui subárvore, registra eventos e enfileira anexos atomicamente', () => {
    const { sqlite, context, unit } = setup()
    const now = new Date().toISOString()
    const insert = sqlite.query('INSERT INTO items (id, tenant_id, project_id, type, parent_id, ancestry_path, title, status, priority, points, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    insert.run('story', 'tenant-a', 'project-a', 'STORY', null, '[]', 'História', 'NOT_STARTED', 'MEDIUM', null, 0, now, now)
    insert.run('task', 'tenant-a', 'project-a', 'TASK', 'story', '[{"id":"story","title":"História","type":"STORY"}]', 'Tarefa', 'DONE', 'MEDIUM', 3, 0, now, now)
    sqlite.query('INSERT INTO attachments (id, tenant_id, item_id, filename, original_name, mime_type, size, storage_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('attachment', 'tenant-a', 'task', 'stored.bin', 'arquivo.txt', 'text/plain', 10, 'tenant-a/task/stored.bin', now)

    unit.deleteItemSubtree(context, 'project-a', 'story')

    expect(sqlite.query("SELECT id FROM items WHERE id IN ('story', 'task')").all()).toEqual([])
    expect(sqlite.query('SELECT storage_path, status FROM storage_cleanup_jobs WHERE tenant_id = ?').all('tenant-a'))
      .toEqual([{ storage_path: 'tenant-a/task/stored.bin', status: 'PENDING' }])
    const events = sqlite.query<{ event_type: string; item_id: string }, [string]>(
      'SELECT event_type, item_id FROM item_events WHERE tenant_id = ? ORDER BY sequence',
    ).all('tenant-a')
    expect(events.filter(event => event.event_type === 'ITEM_DELETED').map(event => event.item_id)).toEqual(['story', 'task'])
    const rollup = sqlite.query<{ total: number; done: number; points: number }, [string, string]>(
      'SELECT total, done, points FROM project_metrics_daily WHERE tenant_id = ? AND project_id = ?',
    ).get('tenant-a', 'project-a')
    expect(rollup).toEqual({ total: -1, done: -1, points: -3 })
    sqlite.close()
  })

  test('exclui agregado de projeto sem eventos por item e preserva outbox de anexos', () => {
    const { sqlite, context, unit } = setup()
    const now = new Date().toISOString()
    sqlite.query('INSERT INTO items (id, tenant_id, project_id, type, ancestry_path, title, status, priority, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('item', 'tenant-a', 'project-a', 'TASK', '[]', 'Item', 'NOT_STARTED', 'MEDIUM', 0, now, now)
    sqlite.query('INSERT INTO attachments (id, tenant_id, item_id, filename, original_name, mime_type, size, storage_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('attachment', 'tenant-a', 'item', 'stored.bin', 'arquivo.txt', 'text/plain', 10, 'tenant-a/item/stored.bin', now)

    unit.deleteProjectAggregate(context, 'project-a')

    expect(sqlite.query("SELECT id FROM projects WHERE id = 'project-a'").all()).toEqual([])
    expect(sqlite.query("SELECT id FROM items WHERE id = 'item'").all()).toEqual([])
    expect(sqlite.query('SELECT event_type FROM item_events').all()).toEqual([])
    expect(sqlite.query('SELECT storage_path FROM storage_cleanup_jobs WHERE tenant_id = ?').all('tenant-a'))
      .toEqual([{ storage_path: 'tenant-a/item/stored.bin' }])
    sqlite.close()
  })

  test('exclui módulo em cascata com a hierarquia e preserva outbox/analytics', () => {
    const { sqlite, context, unit } = setup()
    const now = new Date().toISOString()
    sqlite.query('INSERT INTO modules (id, tenant_id, project_id, name, position) VALUES (?, ?, ?, ?, ?)')
      .run('module-delete', 'tenant-a', 'project-a', 'Excluir', 0)
    sqlite.query('INSERT INTO items (id, tenant_id, project_id, type, module_id, ancestry_path, title, status, priority, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('epic', 'tenant-a', 'project-a', 'EPIC', 'module-delete', '[]', 'Épico', 'NOT_STARTED', 'MEDIUM', 0, now, now)
    sqlite.query('INSERT INTO items (id, tenant_id, project_id, type, parent_id, ancestry_path, title, status, priority, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('story', 'tenant-a', 'project-a', 'STORY', 'epic', '[{"id":"epic","title":"Épico","type":"EPIC"}]', 'História', 'NOT_STARTED', 'MEDIUM', 0, now, now)
    sqlite.query('INSERT INTO items (id, tenant_id, project_id, type, parent_id, ancestry_path, title, status, priority, points, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('task', 'tenant-a', 'project-a', 'TASK', 'story', '[{"id":"epic","title":"Épico","type":"EPIC"},{"id":"story","title":"História","type":"STORY"}]', 'Tarefa', 'DONE', 'MEDIUM', 2, 0, now, now)
    sqlite.query('INSERT INTO attachments (id, tenant_id, item_id, filename, original_name, mime_type, size, storage_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('module-attachment', 'tenant-a', 'task', 'file.bin', 'file.txt', 'text/plain', 5, 'tenant-a/task/file.bin', now)

    const result = unit.deleteModuleAggregate(context, 'project-a', 'module-delete', { cascade: true })

    expect(result).toEqual({ deleted: true, epicCount: 1, deletedItemCount: 3 })
    expect(sqlite.query("SELECT id FROM items WHERE id IN ('epic', 'story', 'task')").all()).toEqual([])
    expect(sqlite.query('SELECT storage_path FROM storage_cleanup_jobs WHERE tenant_id = ?').all('tenant-a'))
      .toEqual([{ storage_path: 'tenant-a/task/file.bin' }])
    expect(sqlite.query("SELECT event_type FROM item_events WHERE tenant_id = ? AND event_type = 'ITEM_DELETED'").all('tenant-a')).toHaveLength(3)
    sqlite.close()
  })

  test('move épicos para outro módulo no mesmo commit de exclusão do módulo', () => {
    const { sqlite, context, unit } = setup()
    sqlite.query('INSERT INTO modules (id, tenant_id, project_id, name, position) VALUES (?, ?, ?, ?, ?)')
      .run('module-old', 'tenant-a', 'project-a', 'Antigo', 0)
    sqlite.query('INSERT INTO modules (id, tenant_id, project_id, name, position) VALUES (?, ?, ?, ?, ?)')
      .run('module-new', 'tenant-a', 'project-a', 'Novo', 1)
    const now = new Date().toISOString()
    sqlite.query('INSERT INTO items (id, tenant_id, project_id, type, module_id, ancestry_path, title, status, priority, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('epic-move', 'tenant-a', 'project-a', 'EPIC', 'module-old', '[]', 'Épico', 'NOT_STARTED', 'MEDIUM', 0, now, now)

    const result = unit.deleteModuleAggregate(context, 'project-a', 'module-old', { targetModuleId: 'module-new' })

    expect(result).toEqual({ deleted: true, epicCount: 1, deletedItemCount: 0 })
    expect(sqlite.query<{ module_id: string }, []>("SELECT module_id FROM items WHERE id = 'epic-move'").get()).toEqual({ module_id: 'module-new' })
    sqlite.close()
  })
})
