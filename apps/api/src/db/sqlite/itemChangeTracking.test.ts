// Card T57 — marcador de última alteração: mutações do card e de dependentes
// atualizam o `updated_at` do item dono e dos seus ancestrais.
import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from '../schema'
import type { MutationContext } from '../../persistence/models'
import { createSqlitePersistencePorts } from './adapter'

const migrationsFolder = new URL('../migrations', import.meta.url).pathname
const OLD = '2020-01-01T00:00:00.000Z'

function setup() {
  const sqlite = new Database(':memory:')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder })
  sqlite.exec('PRAGMA foreign_keys = ON')
  const now = new Date().toISOString()
  sqlite.query('INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)').run('tenant-a', 'Tenant A', 'tenant-a', now)
  sqlite.query('INSERT INTO projects (id, tenant_id, name, board_mode, created_at) VALUES (?, ?, ?, ?, ?)').run('project-a', 'tenant-a', 'Projeto A', 'HIERARCHICAL', now)
  sqlite.query('INSERT INTO projects (id, tenant_id, name, board_mode, created_at) VALUES (?, ?, ?, ?, ?)').run('project-b', 'tenant-a', 'Projeto B', 'HIERARCHICAL', now)
  sqlite.query('INSERT INTO project_analytics_coverage (project_id, tenant_id, coverage_started_at, baseline_event_id, created_at) VALUES (?, ?, ?, NULL, ?)').run('project-a', 'tenant-a', now, now)
  sqlite.query("INSERT INTO project_analytics_dimension_meta (project_id, tenant_id, projection_version, status, last_sequence, target_sequence, updated_at) VALUES (?, ?, 2, 'READY', -1, NULL, ?)").run('project-a', 'tenant-a', now)

  const insertItem = sqlite.query('INSERT INTO items (id, tenant_id, project_id, type, parent_id, ancestry_path, title, status, priority, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  insertItem.run('epic', 'tenant-a', 'project-a', 'EPIC', null, '[]', 'Épico', 'NOT_STARTED', 'MEDIUM', 0, now, OLD)
  insertItem.run('story', 'tenant-a', 'project-a', 'STORY', 'epic', '[{"id":"epic","title":"Épico","type":"EPIC"}]', 'História', 'NOT_STARTED', 'MEDIUM', 0, now, OLD)
  insertItem.run('task', 'tenant-a', 'project-a', 'TASK', 'story', '[{"id":"epic","title":"Épico","type":"EPIC"},{"id":"story","title":"História","type":"STORY"}]', 'Tarefa', 'NOT_STARTED', 'MEDIUM', 0, now, OLD)
  insertItem.run('other-project-task', 'tenant-a', 'project-b', 'TASK', null, '[]', 'Outro projeto', 'NOT_STARTED', 'MEDIUM', 0, now, OLD)
  sqlite.query('INSERT INTO columns (id, tenant_id, project_id, name, base_status, position) VALUES (?, ?, ?, ?, ?, ?)').run('col-x', 'tenant-a', 'project-a', 'Fazendo', 'IN_PROGRESS', 0)

  const context: MutationContext = {
    tenantId: 'tenant-a', actorUserId: null, actorKind: 'SYSTEM',
    mutation: { origin: 'TEST', actorType: 'SYSTEM', actorSource: 'SYSTEM', actorLabel: null },
  }
  const ports = createSqlitePersistencePorts(db, sqlite)
  const updatedAt = (id: string) => sqlite.query<{ updated_at: string }, [string]>('SELECT updated_at FROM items WHERE id = ?').get(id)?.updated_at
  return { sqlite, context, ports, updatedAt }
}

describe('T57 — marcador de última alteração', () => {
  test('mutação de checklist marca o card dono e os ancestrais', async () => {
    const { sqlite, context, ports, updatedAt } = setup()
    const checklist = await ports.checklists.createChecklist(context, 'project-a', 'task', 'Checklist')
    await ports.checklists.createChecklistItem(context, 'project-a', 'task', checklist.id, { text: 'Passo' })
    expect(updatedAt('task')).not.toBe(OLD)
    expect(updatedAt('story')).not.toBe(OLD)
    expect(updatedAt('epic')).not.toBe(OLD)
    expect(updatedAt('other-project-task')).toBe(OLD)
    sqlite.close()
  })

  test('mutação de log de trabalho marca o card dono e os ancestrais', async () => {
    const { sqlite, context, ports, updatedAt } = setup()
    await ports.workLogs.createItemLog(context, 'project-a', 'task', { type: 'manual', activity: 'Trabalho' })
    expect(updatedAt('task')).not.toBe(OLD)
    expect(updatedAt('story')).not.toBe(OLD)
    sqlite.close()
  })

  test('mutação de link externo marca o card dono', async () => {
    const { sqlite, context, ports, updatedAt } = setup()
    await ports.itemLinks.create(context, 'project-a', 'task', { name: 'Wiki', url: 'https://example.com' })
    expect(updatedAt('task')).not.toBe(OLD)
    expect(updatedAt('story')).not.toBe(OLD)
    sqlite.close()
  })

  test('mutação de anexo marca o card dono', async () => {
    const { sqlite, context, ports, updatedAt } = setup()
    await ports.files.createAttachment(context, 'project-a', 'task', {
      fileName: 'a.bin', originalName: 'a.txt', mimeType: 'text/plain', sizeBytes: 3, storagePath: 'tenant-a/task/a.bin',
    })
    expect(updatedAt('task')).not.toBe(OLD)
    expect(updatedAt('epic')).not.toBe(OLD)
    sqlite.close()
  })

  test('mutação de dependência marca o card dono', async () => {
    const { sqlite, context, ports, updatedAt } = setup()
    await ports.itemDependencies.create(context, 'project-a', 'task', { dependsOnItemId: 'other-project-task' })
    expect(updatedAt('task')).not.toBe(OLD)
    expect(updatedAt('story')).not.toBe(OLD)
    sqlite.close()
  })

  test('criar, alterar, mover e remover subtask propaga ao dono e ancestrais', async () => {
    const { sqlite, context, ports, updatedAt } = setup()
    const child = await ports.unitOfWork.createItemWithRelations(context, {
      projectId: 'project-a', type: 'TASK', parentId: 'task', title: 'Subtask',
      ancestryPath: '[{"id":"epic","title":"Épico","type":"EPIC"},{"id":"story","title":"História","type":"STORY"},{"id":"task","title":"Tarefa","type":"TASK"}]',
    })
    expect(updatedAt('task')).not.toBe(OLD)
    expect(updatedAt('story')).not.toBe(OLD)

    sqlite.query('UPDATE items SET updated_at = ? WHERE id IN (?, ?, ?)').run(OLD, 'epic', 'story', 'task')
    await ports.unitOfWork.updateItemWithRelations(context, 'project-a', child.id, { status: 'DONE' })
    expect(updatedAt('task')).not.toBe(OLD)
    expect(updatedAt('story')).not.toBe(OLD)

    sqlite.query('UPDATE items SET updated_at = ? WHERE id IN (?, ?, ?)').run(OLD, 'epic', 'story', 'task')
    await ports.unitOfWork.moveItem(context, 'project-a', child.id, { id: 'col-x', name: 'Fazendo', baseStatus: 'IN_PROGRESS' }, 'A Fazer')
    expect(updatedAt('task')).not.toBe(OLD)

    sqlite.query('UPDATE items SET updated_at = ? WHERE id IN (?, ?, ?)').run(OLD, 'epic', 'story', 'task')
    await ports.unitOfWork.deleteItemSubtree(context, 'project-a', child.id)
    expect(updatedAt('task')).not.toBe(OLD)
    expect(updatedAt('story')).not.toBe(OLD)
    sqlite.close()
  })
})
