import type { Database } from 'bun:sqlite'
import type { ItemRecord, MutationContext } from '../../persistence/models'
import type { BatchItemCreateOperation, BatchItemCreateResult, BatchItemUpdate, ItemPatch, ItemRelationsMutation, NewItemRecord } from '../../persistence/ports'
import { generateId } from '../../utils/id'
import { runSqliteAtomic } from './atomicTransaction'
import { readItemSnapshot, recordItemEvent } from './itemAnalytics'

interface ItemRow {
  id: string
  tenant_id: string
  project_id: string
  type: ItemRecord['type']
  sequence_code: string | null
  parent_id: string | null
  module_id: string | null
  column_id: string | null
  ancestry_path: string
  title: string
  description: string | null
  persona: string | null
  goal: string | null
  benefit: string | null
  acceptance_criteria: string | null
  notes: string | null
  status: ItemRecord['status']
  status_before_archive: ItemRecord['statusBeforeArchive']
  cost_center_id: string | null
  priority: ItemRecord['priority']
  points: number | null
  assignee_id: string | null
  assignee_api_key_id: string | null
  blocked_reason: string | null
  position: number
  start_date: string | null
  due_date: string | null
  author_id: string | null
  version_id: string | null
  created_at: string
  updated_at: string
}

interface AncestryNode {
  id: string
  title: string
  type: ItemRecord['type']
}

const itemColumns = {
  type: 'type',
  sequenceCode: 'sequence_code',
  parentId: 'parent_id',
  moduleId: 'module_id',
  columnId: 'column_id',
  ancestryPath: 'ancestry_path',
  title: 'title',
  description: 'description',
  persona: 'persona',
  goal: 'goal',
  benefit: 'benefit',
  acceptanceCriteria: 'acceptance_criteria',
  notes: 'notes',
  status: 'status',
  statusBeforeArchive: 'status_before_archive',
  costCenterId: 'cost_center_id',
  priority: 'priority',
  points: 'points',
  assigneeId: 'assignee_id',
  assigneeApiKeyId: 'assignee_api_key_id',
  blockedReason: 'blocked_reason',
  position: 'position',
  startDate: 'start_date',
  dueDate: 'due_date',
  authorId: 'author_id',
  versionId: 'version_id',
} as const

function toItem(row: ItemRow): ItemRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    type: row.type,
    sequenceCode: row.sequence_code,
    parentId: row.parent_id,
    moduleId: row.module_id,
    columnId: row.column_id,
    ancestryPath: row.ancestry_path,
    title: row.title,
    description: row.description,
    persona: row.persona,
    goal: row.goal,
    benefit: row.benefit,
    acceptanceCriteria: row.acceptance_criteria,
    notes: row.notes,
    status: row.status,
    statusBeforeArchive: row.status_before_archive,
    costCenterId: row.cost_center_id,
    priority: row.priority,
    points: row.points,
    assigneeId: row.assignee_id,
    assigneeApiKeyId: row.assignee_api_key_id,
    blockedReason: row.blocked_reason,
    position: row.position,
    startDate: row.start_date,
    dueDate: row.due_date,
    authorId: row.author_id,
    versionId: row.version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function itemById(database: Database, tenantId: string, projectId: string, itemId: string): ItemRow | null {
  return database.query<ItemRow, [string, string, string]>(
    'SELECT * FROM items WHERE tenant_id = ? AND project_id = ? AND id = ?',
  ).get(tenantId, projectId, itemId) ?? null
}

function replaceRelations(database: Database, table: 'item_tags' | 'item_sprints', foreignKey: 'tag_id' | 'sprint_id', tenantId: string, projectId: string, itemId: string, ids: string[]) {
  const deduplicatedIds = [...new Set(ids)]
  const targets = table === 'item_tags' ? 'tags' : 'sprints'
  for (const relatedId of deduplicatedIds) {
    const found = database.query<{ id: string }, [string, string, string]>(
      `SELECT id FROM ${targets} WHERE tenant_id = ? AND project_id = ? AND id = ?`,
    ).get(tenantId, projectId, relatedId)
    if (!found) throw new Error(`Vínculo inválido: ${table}.${foreignKey} não pertence ao projeto e tenant.`)
  }

  database.query(`DELETE FROM ${table} WHERE tenant_id = ? AND item_id = ?`).run(tenantId, itemId)
  for (const relatedId of deduplicatedIds) {
    database.query(`INSERT INTO ${table} (tenant_id, item_id, ${foreignKey}) VALUES (?, ?, ?)`)
      .run(tenantId, itemId, relatedId)
  }
}

function insertActivity(database: Database, context: MutationContext, itemId: string, activity: string, now = new Date().toISOString()) {
  database.query(`INSERT INTO item_logs
    (id, tenant_id, item_id, author_id, type, actor_type, actor_label, source, activity, duration_min, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'auto', ?, ?, ?, ?, NULL, ?, ?)`)
    .run(generateId(), context.tenantId, itemId, context.actorUserId, context.mutation.actorType,
      context.mutation.actorLabel, context.mutation.actorSource, activity, now, now)
}

function collectSubtree(database: Database, tenantId: string, projectId: string, rootId: string): string[] {
  const result: string[] = []
  const queue = [rootId]
  const visited = new Set<string>()
  while (queue.length) {
    const currentId = queue.shift()!
    if (visited.has(currentId)) continue
    const current = itemById(database, tenantId, projectId, currentId)
    if (!current) continue
    visited.add(currentId)
    result.push(currentId)
    const children = database.query<{ id: string }, [string, string, string]>(
      'SELECT id FROM items WHERE tenant_id = ? AND project_id = ? AND parent_id = ? ORDER BY id',
    ).all(tenantId, projectId, currentId)
    queue.push(...children.map(child => child.id))
  }
  return result
}

function refreshDescendantAncestry(database: Database, tenantId: string, projectId: string, rootId: string) {
  const queue = [rootId]
  const visited = new Set<string>()
  while (queue.length > 0) {
    const parentId = queue.shift()!
    if (visited.has(parentId)) continue
    visited.add(parentId)
    const parent = itemById(database, tenantId, projectId, parentId)
    if (!parent) continue
    const parentPath = JSON.parse(parent.ancestry_path) as AncestryNode[]
    const children = database.query<ItemRow, [string, string, string]>(
      'SELECT * FROM items WHERE tenant_id = ? AND project_id = ? AND parent_id = ? ORDER BY id',
    ).all(tenantId, projectId, parentId)
    const childPath = [...parentPath, { id: parent.id, title: parent.title, type: parent.type }]
    for (const child of children) {
      if (visited.has(child.id)) throw new Error('HIERARCHY_CYCLE')
      database.query('UPDATE items SET ancestry_path = ?, updated_at = ? WHERE tenant_id = ? AND project_id = ? AND id = ?')
        .run(JSON.stringify(childPath), new Date().toISOString(), tenantId, projectId, child.id)
      queue.push(child.id)
    }
  }
}

function deleteItemsInsideTransaction(database: Database, context: MutationContext, projectId: string, itemIds: string[], recordAnalyticsEvents: boolean) {
  const itemIdSet = new Set(itemIds)
  const snapshots = new Map<string, NonNullable<ReturnType<typeof readItemSnapshot>>>()
  const parentSnapshots = new Map<string, NonNullable<ReturnType<typeof readItemSnapshot>>>()
  const storagePaths: string[] = []

  for (const itemId of itemIds) {
    const item = itemById(database, context.tenantId, projectId, itemId)
    const snapshot = readItemSnapshot(database, context.tenantId, projectId, itemId)
    if (!item || !snapshot) continue
    snapshots.set(itemId, snapshot)
    if (snapshot.parentId && !parentSnapshots.has(snapshot.parentId)) {
      const parentSnapshot = readItemSnapshot(database, context.tenantId, projectId, snapshot.parentId)
      if (parentSnapshot) parentSnapshots.set(snapshot.parentId, parentSnapshot)
    }
    const attachments = database.query<{ storage_path: string }, [string, string]>(
      'SELECT storage_path FROM attachments WHERE tenant_id = ? AND item_id = ?',
    ).all(context.tenantId, itemId)
    storagePaths.push(...attachments.map(attachment => attachment.storage_path))
  }

  const now = new Date().toISOString()
  for (const storagePath of storagePaths) {
    database.query(`INSERT OR IGNORE INTO storage_cleanup_jobs
      (id, tenant_id, storage_path, resource_type, status, attempts, available_at, created_at, updated_at)
      VALUES (?, ?, ?, 'ATTACHMENT', 'PENDING', 0, ?, ?, ?)`)
      .run(generateId(), context.tenantId, storagePath, now, now, now)
  }

  if (recordAnalyticsEvents) {
    for (const itemId of itemIds) {
      const before = snapshots.get(itemId)
      if (before) recordItemEvent(database, context, { projectId, itemId, eventType: 'ITEM_DELETED', before, after: null })
    }
  }

  // Filhos primeiro para satisfazer a FK auto-referenciada sem deferred constraints.
  for (const itemId of [...itemIds].reverse()) {
    const checklistIds = database.query<{ id: string }, [string, string]>(
      'SELECT id FROM checklists WHERE tenant_id = ? AND item_id = ?',
    ).all(context.tenantId, itemId).map(row => row.id)
    for (const checklistId of checklistIds) {
      database.query('DELETE FROM checklist_items WHERE tenant_id = ? AND checklist_id = ?').run(context.tenantId, checklistId)
    }
    database.query('DELETE FROM checklists WHERE tenant_id = ? AND item_id = ?').run(context.tenantId, itemId)
    database.query('DELETE FROM item_tags WHERE tenant_id = ? AND item_id = ?').run(context.tenantId, itemId)
    database.query('DELETE FROM item_sprints WHERE tenant_id = ? AND item_id = ?').run(context.tenantId, itemId)
    database.query('DELETE FROM attachments WHERE tenant_id = ? AND item_id = ?').run(context.tenantId, itemId)
    database.query('DELETE FROM item_logs WHERE tenant_id = ? AND item_id = ?').run(context.tenantId, itemId)
    database.query('DELETE FROM items WHERE tenant_id = ? AND project_id = ? AND id = ?').run(context.tenantId, projectId, itemId)
  }

  if (recordAnalyticsEvents) {
    for (const [parentId, before] of parentSnapshots) {
      const after = itemIdSet.has(parentId) ? { ...before, isLeaf: true } : readItemSnapshot(database, context.tenantId, projectId, parentId)
      recordItemEvent(database, context, { projectId, itemId: parentId, eventType: 'LEAF_CHANGED', before, after })
    }
  }
}

export function deleteSqliteItemsInsideTransaction(database: Database, context: MutationContext, projectId: string, itemIds: string[], recordAnalyticsEvents = true) {
  deleteItemsInsideTransaction(database, context, projectId, itemIds, recordAnalyticsEvents)
}

function createBatchItemInsideTransaction(database: Database, context: MutationContext, projectId: string, operation: BatchItemCreateOperation, moduleCreates: Array<{ id: string; name: string; position: number; description: string | null }>): BatchItemCreateResult {
  if (operation.tool !== 'create_task' && operation.tool !== 'create_item') throw new Error('VALIDATION_ERROR')
  if (!operation.title?.trim()) throw new Error('VALIDATION_ERROR')
  if (operation.invalidType) throw new Error('INTERNAL_ERROR')
  const project = database.query<{ board_mode: 'SIMPLE' | 'HIERARCHICAL'; simple_story_id: string | null }, [string, string]>(
    'SELECT board_mode, simple_story_id FROM projects WHERE tenant_id = ? AND id = ?',
  ).get(context.tenantId, projectId)
  if (!project) throw new Error('VALIDATION_ERROR')

  const type = operation.type ?? 'TASK'
  const parentId = project.board_mode === 'SIMPLE' && (type === 'TASK' || type === 'BUG')
    ? project.simple_story_id
    : operation.parentId ?? null
  if (type === 'STORY' && !parentId) throw new Error('VALIDATION_ERROR')
  if ((type === 'TASK' || type === 'BUG') && !parentId) throw new Error('HIERARCHY_REQUIRED')
  if (type === 'EPIC' && (parentId || (!operation.moduleId && !operation.moduleName))) throw new Error('VALIDATION_ERROR')

  let moduleId = operation.moduleId ?? null
  const projectModules = database.query<{ id: string; name: string }, [string, string]>(
    'SELECT id, name FROM modules WHERE tenant_id = ? AND project_id = ? ORDER BY position',
  ).all(context.tenantId, projectId)
  if (operation.moduleName) {
    const name = operation.moduleName.trim()
    if (!name) throw new Error('VALIDATION_ERROR')
    const existing = projectModules.find(module => module.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)
    if (existing) moduleId = existing.id
    else {
      const id = generateId()
      const position = projectModules.length
      database.query('INSERT INTO modules (id, tenant_id, project_id, name, description, position) VALUES (?, ?, ?, ?, NULL, ?)')
        .run(id, context.tenantId, projectId, name, position)
      moduleId = id
      projectModules.push({ id, name })
      moduleCreates.push({ id, name, position, description: null })
    }
  }
  if (moduleId) {
    const module = projectModules.find(candidate => candidate.id === moduleId)
    if (!module) throw new Error('RELATION_OUT_OF_SCOPE')
  }

  const parent = parentId ? itemById(database, context.tenantId, projectId, parentId) : null
  if (parentId && !parent) throw new Error('RELATION_OUT_OF_SCOPE')
  if (type === 'STORY' && parent?.type !== 'EPIC') throw new Error('VALIDATION_ERROR')
  if ((type === 'TASK' || type === 'BUG') && parent && !['STORY', 'TASK', 'BUG'].includes(parent.type)) throw new Error('VALIDATION_ERROR')

  const firstColumn = type === 'TASK' || type === 'BUG'
    ? database.query<{ id: string }, [string, string]>(
      'SELECT id FROM columns WHERE tenant_id = ? AND project_id = ? ORDER BY position LIMIT 1',
    ).get(context.tenantId, projectId)?.id ?? null
    : null
  const ancestryPath = parent ? [...JSON.parse(parent.ancestry_path) as AncestryNode[], { id: parent.id, title: parent.title, type: parent.type }] : []
  const id = generateId()
  const now = new Date().toISOString()
  const title = operation.title.trim()
  const priority = operation.priority ?? 'MEDIUM'
  const assigneeId = operation.assignToCurrentUser ? context.actorUserId : null
  database.query(`INSERT INTO items
    (id, tenant_id, project_id, type, sequence_code, parent_id, module_id, column_id, ancestry_path, title, description,
     status, priority, points, assignee_id, author_id, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'NOT_STARTED', ?, ?, ?, ?, 0, ?, ?)`)
    .run(id, context.tenantId, projectId, type, parentId, moduleId, firstColumn, JSON.stringify(ancestryPath), title,
      operation.description ?? null, priority, operation.points ?? null, assigneeId, context.actorUserId, now, now)

  const after = readItemSnapshot(database, context.tenantId, projectId, id)
  recordItemEvent(database, context, { projectId, itemId: id, eventType: 'ITEM_CREATED', correlationId: id, after })
  return {
    id, title, type, projectId, parentId, moduleId, columnId: firstColumn,
    ancestryPath: JSON.stringify(ancestryPath), description: operation.description ?? null,
    priority, points: operation.points ?? null, assigneeId, status: 'NOT_STARTED',
  }
}

/** Comandos transacionais de hierarquia/itens para o adapter SIMPLE. */
export function createSqliteItemUnitOfWork(database: Database) {
  return {
    createItemWithRelations(context: MutationContext, input: NewItemRecord, relations: ItemRelationsMutation = {}): ItemRecord {
      const now = new Date().toISOString()
      const id = generateId()
      return runSqliteAtomic(database, () => {
        const parentBefore = input.parentId
          ? readItemSnapshot(database, context.tenantId, input.projectId, input.parentId)
          : null
        const values: Record<string, unknown> = {
          id,
          tenant_id: context.tenantId,
          project_id: input.projectId,
          type: input.type,
          title: input.title,
          ancestry_path: input.ancestryPath ?? '[]',
          status: input.status ?? 'NOT_STARTED',
          priority: input.priority ?? 'MEDIUM',
          position: input.position ?? 0,
          created_at: now,
          updated_at: now,
        }
        for (const [property, column] of Object.entries(itemColumns)) {
          const value = input[property as keyof typeof itemColumns]
          if (value !== undefined) values[column] = value
        }
        const columns = Object.keys(values)
        database.query(`INSERT INTO items (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
          .run(...columns.map(column => values[column] as string | number | null))

        if (relations.tagIds !== undefined) replaceRelations(database, 'item_tags', 'tag_id', context.tenantId, input.projectId, id, relations.tagIds)
        if (relations.sprintIds !== undefined) replaceRelations(database, 'item_sprints', 'sprint_id', context.tenantId, input.projectId, id, relations.sprintIds)

        const inserted = itemById(database, context.tenantId, input.projectId, id)
        if (!inserted) throw new Error('Item criado não pôde ser lido dentro da transação.')
        const after = readItemSnapshot(database, context.tenantId, input.projectId, id)
        insertActivity(database, context, id, relations.activity ?? context.mutation.activity ?? `Card criado: ${input.title}`, now)
        recordItemEvent(database, context, { projectId: input.projectId, itemId: id, eventType: 'ITEM_CREATED', after })
        if (parentBefore && input.parentId) {
          recordItemEvent(database, context, {
            projectId: input.projectId,
            itemId: input.parentId,
            eventType: 'LEAF_CHANGED',
            before: parentBefore,
            after: readItemSnapshot(database, context.tenantId, input.projectId, input.parentId),
          })
        }
        return toItem(inserted)
      })
    },

    updateItemWithRelations(context: MutationContext, projectId: string, itemId: string, patch: ItemPatch, relations: ItemRelationsMutation = {}): ItemRecord | null {
      return runSqliteAtomic(database, () => {
        const current = itemById(database, context.tenantId, projectId, itemId)
        if (!current) return null
        const before = readItemSnapshot(database, context.tenantId, projectId, itemId)
        const oldParentId = current.parent_id
        const nextParentId = patch.parentId !== undefined ? patch.parentId : current.parent_id
        const parentChanged = nextParentId !== oldParentId
        const oldParentBefore = parentChanged && oldParentId
          ? readItemSnapshot(database, context.tenantId, projectId, oldParentId)
          : null
        const newParentBefore = parentChanged && nextParentId
          ? readItemSnapshot(database, context.tenantId, projectId, nextParentId)
          : null
        if (relations.expectedUpdatedAt !== undefined && current.updated_at !== relations.expectedUpdatedAt) {
          throw new Error('PERSISTENCE_CONFLICT: o item foi alterado por outra operação.')
        }

        const values: Record<string, unknown> = { updated_at: new Date().toISOString() }
        for (const [property, column] of Object.entries(itemColumns)) {
          const value = patch[property as keyof ItemPatch]
          if (value !== undefined) values[column] = value
        }
        if (parentChanged) {
          const parent = nextParentId ? itemById(database, context.tenantId, projectId, nextParentId) : null
          if (nextParentId && !parent) throw new Error('PARENT_NOT_FOUND')
          const parentPath = parent ? JSON.parse(parent.ancestry_path) as AncestryNode[] : []
          if (nextParentId === itemId || parentPath.some(node => node.id === itemId)) throw new Error('HIERARCHY_CYCLE')
          values.ancestry_path = JSON.stringify(parent ? [...parentPath, { id: parent.id, title: parent.title, type: parent.type }] : [])
        }
        const columns = Object.keys(values)
        database.query(`UPDATE items SET ${columns.map(column => `${column} = ?`).join(', ')} WHERE tenant_id = ? AND project_id = ? AND id = ?`)
          .run(...columns.map(column => values[column] as string | number | null), context.tenantId, projectId, itemId)

        if (relations.tagIds !== undefined) replaceRelations(database, 'item_tags', 'tag_id', context.tenantId, projectId, itemId, relations.tagIds)
        if (relations.sprintIds !== undefined) replaceRelations(database, 'item_sprints', 'sprint_id', context.tenantId, projectId, itemId, relations.sprintIds)
        const updated = itemById(database, context.tenantId, projectId, itemId)
        if (updated) {
          if (parentChanged || patch.title !== undefined) refreshDescendantAncestry(database, context.tenantId, projectId, itemId)
          const after = readItemSnapshot(database, context.tenantId, projectId, itemId)
          if (relations.activity ?? context.mutation.activity) insertActivity(database, context, itemId, relations.activity ?? context.mutation.activity!)
          if (before && after) {
            const eventByField: Array<[keyof ItemPatch, string]> = [
              ['status', 'STATUS_CHANGED'], ['points', 'POINTS_CHANGED'], ['type', 'TYPE_CHANGED'],
              ['versionId', 'VERSION_CHANGED'], ['moduleId', 'MODULE_CHANGED'], ['parentId', 'ITEM_REPARENTED'],
            ]
            for (const [field, eventType] of eventByField) {
              if (patch[field] !== undefined && patch[field] !== current[itemColumns[field as keyof typeof itemColumns] as keyof ItemRow]) {
                recordItemEvent(database, context, { projectId, itemId, eventType, before, after })
              }
            }
            if (relations.sprintIds !== undefined && JSON.stringify(before.sprintIds) !== JSON.stringify(after.sprintIds)) {
              recordItemEvent(database, context, { projectId, itemId, eventType: 'SPRINT_CHANGED', before, after })
            }
          }
          if (oldParentBefore && oldParentId) {
            recordItemEvent(database, context, {
              projectId, itemId: oldParentId, eventType: 'LEAF_CHANGED', before: oldParentBefore,
              after: readItemSnapshot(database, context.tenantId, projectId, oldParentId),
            })
          }
          if (newParentBefore && nextParentId) {
            recordItemEvent(database, context, {
              projectId, itemId: nextParentId, eventType: 'LEAF_CHANGED', before: newParentBefore,
              after: readItemSnapshot(database, context.tenantId, projectId, nextParentId),
            })
          }
        }
        return updated ? toItem(updated) : null
      })
    },

    reparentSubtree(context: MutationContext, projectId: string, itemId: string, newParentId: string | null): void {
      runSqliteAtomic(database, () => {
        const root = itemById(database, context.tenantId, projectId, itemId)
        if (!root) throw new Error('ITEM_NOT_FOUND')
        if (root.parent_id === newParentId) return
        const parent = newParentId === null ? null : itemById(database, context.tenantId, projectId, newParentId)
        if (newParentId !== null && !parent) throw new Error('PARENT_NOT_FOUND')
        const before = readItemSnapshot(database, context.tenantId, projectId, itemId)
        const oldParentBefore = root.parent_id
          ? readItemSnapshot(database, context.tenantId, projectId, root.parent_id)
          : null
        const newParentBefore = newParentId
          ? readItemSnapshot(database, context.tenantId, projectId, newParentId)
          : null

        const parentPath = parent ? JSON.parse(parent.ancestry_path) as AncestryNode[] : []
        if (parentPath.some(node => node.id === itemId) || newParentId === itemId) throw new Error('HIERARCHY_CYCLE')
        const rootPath = parent ? [...parentPath, { id: parent.id, title: parent.title, type: parent.type }] : []

        const pending: Array<{ id: string; path: AncestryNode[] }> = [{ id: itemId, path: rootPath }]
        database.query('UPDATE items SET parent_id = ?, ancestry_path = ?, updated_at = ? WHERE tenant_id = ? AND project_id = ? AND id = ?')
          .run(newParentId, JSON.stringify(rootPath), new Date().toISOString(), context.tenantId, projectId, itemId)

        while (pending.length > 0) {
          const current = pending.shift()!
          const currentRow = itemById(database, context.tenantId, projectId, current.id)
          if (!currentRow) continue
          const children = database.query<ItemRow, [string, string, string]>(
            'SELECT * FROM items WHERE tenant_id = ? AND project_id = ? AND parent_id = ? ORDER BY id',
          ).all(context.tenantId, projectId, current.id)
          const childPath = [...current.path, { id: currentRow.id, title: currentRow.title, type: currentRow.type }]
          for (const child of children) {
            database.query('UPDATE items SET ancestry_path = ?, updated_at = ? WHERE tenant_id = ? AND project_id = ? AND id = ?')
              .run(JSON.stringify(childPath), new Date().toISOString(), context.tenantId, projectId, child.id)
            pending.push({ id: child.id, path: childPath })
          }
        }

        const after = readItemSnapshot(database, context.tenantId, projectId, itemId)
        if (before && after) recordItemEvent(database, context, { projectId, itemId, eventType: 'ITEM_REPARENTED', before, after })
        if (oldParentBefore && root.parent_id) {
          recordItemEvent(database, context, {
            projectId, itemId: root.parent_id, eventType: 'LEAF_CHANGED', before: oldParentBefore,
            after: readItemSnapshot(database, context.tenantId, projectId, root.parent_id),
          })
        }
        if (newParentBefore && newParentId) {
          recordItemEvent(database, context, {
            projectId, itemId: newParentId, eventType: 'LEAF_CHANGED', before: newParentBefore,
            after: readItemSnapshot(database, context.tenantId, projectId, newParentId),
          })
        }
      })
    },

    claimItem(context: MutationContext, projectId: string, itemId: string, assigneeId: string, apiKeyId?: string, columnId?: string | null): boolean {
      return runSqliteAtomic(database, () => {
        const before = readItemSnapshot(database, context.tenantId, projectId, itemId)
        if (!before) return false
        const result = database.query(`UPDATE items SET assignee_id = ?, assignee_api_key_id = ?, column_id = ?, status = 'IN_PROGRESS', updated_at = ?
          WHERE tenant_id = ? AND project_id = ? AND id = ? AND assignee_id IS NULL`)
          .run(assigneeId, apiKeyId ?? null, columnId ?? null, new Date().toISOString(), context.tenantId, projectId, itemId)
        if (!result.changes) return false
        insertActivity(database, context, itemId, context.mutation.activity ?? 'Card assumido para trabalho')
        recordItemEvent(database, context, { projectId, itemId, eventType: 'STATUS_CHANGED', before, after: readItemSnapshot(database, context.tenantId, projectId, itemId) })
        return true
      })
    },

    releaseItem(context: MutationContext, projectId: string, itemId: string, activity = 'Trabalho liberado'): void {
      runSqliteAtomic(database, () => {
        const before = readItemSnapshot(database, context.tenantId, projectId, itemId)
        database.query(`UPDATE items SET assignee_id = NULL, assignee_api_key_id = NULL, status = 'NOT_STARTED', updated_at = ?
          WHERE tenant_id = ? AND project_id = ? AND id = ?`)
          .run(new Date().toISOString(), context.tenantId, projectId, itemId)
        if (before) {
          insertActivity(database, context, itemId, context.mutation.activity ?? activity)
          recordItemEvent(database, context, { projectId, itemId, eventType: 'STATUS_CHANGED', before, after: readItemSnapshot(database, context.tenantId, projectId, itemId) })
        }
      })
    },

    moveItem(context: MutationContext, projectId: string, itemId: string, column: { id: string; name: string; baseStatus: string }, fromColumnName: string): void {
      runSqliteAtomic(database, () => {
        const before = readItemSnapshot(database, context.tenantId, projectId, itemId)
        database.query('UPDATE items SET column_id = ?, status = ?, updated_at = ? WHERE tenant_id = ? AND project_id = ? AND id = ?')
          .run(column.id, column.baseStatus, new Date().toISOString(), context.tenantId, projectId, itemId)
        if (before) {
          insertActivity(database, context, itemId, context.mutation.activity ?? `Movido de '${fromColumnName}' para '${column.name}'`)
          recordItemEvent(database, context, { projectId, itemId, eventType: 'STATUS_CHANGED', before, after: readItemSnapshot(database, context.tenantId, projectId, itemId) })
        }
      })
    },

    deleteItemSubtree(context: MutationContext, projectId: string, itemId: string, options: { recordAnalyticsEvents?: boolean } = {}): void {
      runSqliteAtomic(database, () => {
        const subtree = collectSubtree(database, context.tenantId, projectId, itemId)
        deleteItemsInsideTransaction(database, context, projectId, subtree, options.recordAnalyticsEvents ?? true)
      })
    },

    deleteProjectAggregate(context: MutationContext, projectId: string, _options: { recordAnalyticsEvents?: boolean } = {}): void {
      runSqliteAtomic(database, () => {
        const project = database.query<{ id: string }, [string, string]>(
          'SELECT id FROM projects WHERE tenant_id = ? AND id = ?',
        ).get(context.tenantId, projectId)
        if (!project) return

        const itemIds = database.query<{ id: string }, [string, string]>(
          'SELECT id FROM items WHERE tenant_id = ? AND project_id = ?',
        ).all(context.tenantId, projectId).map(row => row.id)
        database.query('UPDATE projects SET simple_story_id = NULL WHERE tenant_id = ? AND id = ?').run(context.tenantId, projectId)
        deleteItemsInsideTransaction(database, context, projectId, itemIds, false)

        database.query('DELETE FROM memberships WHERE tenant_id = ? AND project_id = ?').run(context.tenantId, projectId)
        database.query('DELETE FROM tags WHERE tenant_id = ? AND project_id = ?').run(context.tenantId, projectId)
        database.query('DELETE FROM sprints WHERE tenant_id = ? AND project_id = ?').run(context.tenantId, projectId)
        database.query('DELETE FROM project_versions WHERE tenant_id = ? AND project_id = ?').run(context.tenantId, projectId)
        database.query('DELETE FROM project_cost_centers WHERE tenant_id = ? AND project_id = ?').run(context.tenantId, projectId)
        database.query('DELETE FROM modules WHERE tenant_id = ? AND project_id = ?').run(context.tenantId, projectId)
        database.query('DELETE FROM columns WHERE tenant_id = ? AND project_id = ?').run(context.tenantId, projectId)
        database.query('DELETE FROM squads WHERE tenant_id = ? AND project_id = ?').run(context.tenantId, projectId)
        database.query('DELETE FROM assistant_conversations WHERE tenant_id = ? AND project_id = ?').run(context.tenantId, projectId)
        database.query('DELETE FROM projects WHERE tenant_id = ? AND id = ?').run(context.tenantId, projectId)
      })
    },

    deleteModuleAggregate(context: MutationContext, projectId: string, moduleId: string, options: { targetModuleId?: string | null; cascade?: boolean } = {}) {
      return runSqliteAtomic(database, () => {
        const module = database.query<{ id: string }, [string, string, string]>(
          'SELECT id FROM modules WHERE tenant_id = ? AND project_id = ? AND id = ?',
        ).get(context.tenantId, projectId, moduleId)
        if (!module) return { deleted: false, epicCount: 0, deletedItemCount: 0 }

        const epics = database.query<{ id: string }, [string, string, string]>(
          "SELECT id FROM items WHERE tenant_id = ? AND project_id = ? AND module_id = ? AND type = 'EPIC'",
        ).all(context.tenantId, projectId, moduleId)
        let deletedItemCount = 0
        if (epics.length && options.targetModuleId) {
          const target = database.query<{ id: string }, [string, string, string]>(
            'SELECT id FROM modules WHERE tenant_id = ? AND project_id = ? AND id = ?',
          ).get(context.tenantId, projectId, options.targetModuleId)
          if (!target || target.id === moduleId) throw new Error('INVALID_MODULE_DESTINATION')
          database.query("UPDATE items SET module_id = ? WHERE tenant_id = ? AND project_id = ? AND module_id = ? AND type = 'EPIC'")
            .run(options.targetModuleId, context.tenantId, projectId, moduleId)
        } else if (epics.length && options.cascade) {
          const subtree = new Set<string>()
          for (const epic of epics) {
            for (const itemId of collectSubtree(database, context.tenantId, projectId, epic.id)) subtree.add(itemId)
          }
          deletedItemCount = subtree.size
          deleteItemsInsideTransaction(database, context, projectId, [...subtree], true)
        } else if (epics.length) {
          throw new Error('MODULE_HAS_EPICS')
        }

        const deleted = database.query('DELETE FROM modules WHERE tenant_id = ? AND project_id = ? AND id = ?')
          .run(context.tenantId, projectId, moduleId).changes === 1
        return { deleted, epicCount: epics.length, deletedItemCount }
      })
    },

    archiveItemSubtree(context: MutationContext, projectId: string, itemId: string): string[] {
      return runSqliteAtomic(database, () => {
        const itemIds = collectSubtree(database, context.tenantId, projectId, itemId)
        if (!itemIds.length) throw new Error('ITEM_NOT_FOUND')
        for (const currentId of itemIds) {
          const current = itemById(database, context.tenantId, projectId, currentId)
          if (!current || current.status === 'ARCHIVED') continue
          const before = readItemSnapshot(database, context.tenantId, projectId, currentId)
          const now = new Date().toISOString()
          database.query(`UPDATE items SET status = 'ARCHIVED', status_before_archive = ?, updated_at = ?
            WHERE tenant_id = ? AND project_id = ? AND id = ?`)
            .run(current.status, now, context.tenantId, projectId, currentId)
          insertActivity(database, context, currentId, context.mutation.activity ?? 'Card arquivado', now)
          if (before) recordItemEvent(database, context, {
            projectId, itemId: currentId, eventType: 'ITEM_ARCHIVED', before,
            after: { ...before, status: 'ARCHIVED' },
          })
        }
        return itemIds
      })
    },

    unarchiveItemSubtree(context: MutationContext, projectId: string, itemId: string): string[] {
      return runSqliteAtomic(database, () => {
        const root = itemById(database, context.tenantId, projectId, itemId)
        if (!root) throw new Error('ITEM_NOT_FOUND')
        if (root.status !== 'ARCHIVED') throw new Error('ITEM_NOT_ARCHIVED')

        const allIds = [itemId]
        const queue = [itemId]
        const visited = new Set<string>()
        while (queue.length > 0) {
          const parentId = queue.shift()!
          if (visited.has(parentId)) continue
          visited.add(parentId)
          const children = database.query<{ id: string }, [string, string, string]>(
            "SELECT id FROM items WHERE tenant_id = ? AND project_id = ? AND parent_id = ? AND status = 'ARCHIVED' ORDER BY id",
          ).all(context.tenantId, projectId, parentId)
          for (const child of children) {
            allIds.push(child.id)
            queue.push(child.id)
          }
        }

        const ancestorPath = JSON.parse(root.ancestry_path || '[]') as AncestryNode[]
        for (const ancestor of ancestorPath) {
          const row = itemById(database, context.tenantId, projectId, ancestor.id)
          if (!row || row.status !== 'ARCHIVED') continue
          database.query('UPDATE items SET status = ?, status_before_archive = NULL, updated_at = ? WHERE tenant_id = ? AND project_id = ? AND id = ?')
            .run(row.status_before_archive ?? 'NOT_STARTED', new Date().toISOString(), context.tenantId, projectId, ancestor.id)
        }

        for (const currentId of allIds) {
          const current = itemById(database, context.tenantId, projectId, currentId)
          if (!current) continue
          const before = readItemSnapshot(database, context.tenantId, projectId, currentId)
          const now = new Date().toISOString()
          database.query('UPDATE items SET status = ?, status_before_archive = NULL, updated_at = ? WHERE tenant_id = ? AND project_id = ? AND id = ?')
            .run(current.status_before_archive ?? 'NOT_STARTED', now, context.tenantId, projectId, currentId)
          insertActivity(database, context, currentId, context.mutation.activity ?? 'Card restaurado', now)
          if (before) recordItemEvent(database, context, {
            projectId, itemId: currentId, eventType: 'ITEM_UNARCHIVED', before,
            after: readItemSnapshot(database, context.tenantId, projectId, currentId),
          })
        }
        return allIds
      })
    },

    applyItemBatch(context: MutationContext, projectId: string, updates: BatchItemUpdate[]): Array<{ id: string; changes: Record<string, unknown> }> {
      return runSqliteAtomic(database, () => {
        const output: Array<{ id: string; changes: Record<string, unknown> }> = []
        for (const operation of updates) {
          const current = itemById(database, context.tenantId, projectId, operation.itemId)
          if (!current) throw new Error('ITEM_NOT_FOUND')
          const before = readItemSnapshot(database, context.tenantId, projectId, operation.itemId)
          const now = new Date().toISOString()
          const values: Record<string, unknown> = { updated_at: now }
          for (const [property, column] of Object.entries(itemColumns)) {
            const value = operation.patch[property as keyof ItemPatch]
            if (value !== undefined) values[column] = value
          }
          const columns = Object.keys(values)
          database.query(`UPDATE items SET ${columns.map(column => `${column} = ?`).join(', ')} WHERE tenant_id = ? AND project_id = ? AND id = ?`)
            .run(...columns.map(column => values[column] as string | number | null), context.tenantId, projectId, operation.itemId)
          if (operation.sprintIds !== undefined) {
            replaceRelations(database, 'item_sprints', 'sprint_id', context.tenantId, projectId, operation.itemId, operation.sprintIds)
          }
          if (operation.activity) insertActivity(database, context, operation.itemId, operation.activity, now)
          const after = readItemSnapshot(database, context.tenantId, projectId, operation.itemId)
          if (before && after) {
            const eventFields: Array<[string, string]> = [
              ['status', 'STATUS_CHANGED'], ['points', 'POINTS_CHANGED'], ['type', 'TYPE_CHANGED'],
              ['sprint', 'SPRINT_CHANGED'], ['version', 'VERSION_CHANGED'],
              ['parent', 'ITEM_REPARENTED'], ['module', 'MODULE_CHANGED'],
            ]
            for (const [field, eventType] of eventFields) {
              if (operation.changedFields?.includes(field)) {
                recordItemEvent(database, context, { projectId, itemId: operation.itemId, eventType, before, after })
              }
            }
          }
          if (operation.responseChanges) output.push({ id: operation.itemId, changes: operation.responseChanges })
        }
        return output
      })
    },

    createItemsBatch(context: MutationContext, projectId: string, operations: BatchItemCreateOperation[], options: { atomic: boolean; agentRunId?: string | null }) {
      const refs = new Map<string, string>()
      const createdModules: Array<{ id: string; name: string; position: number; description: string | null }> = []
      const resolveOperation = (operation: BatchItemCreateOperation) => {
        const parentId = operation.parentRef ? refs.get(operation.parentRef) : operation.parentId
        if (operation.parentRef && !parentId) throw new Error('RELATION_OUT_OF_SCOPE')
        if (operation.ref && refs.has(operation.ref)) throw new Error('VALIDATION_ERROR')
        return { ...operation, parentId: parentId ?? null }
      }

      if (options.atomic) {
        const results = runSqliteAtomic(database, () => operations.map((operation, index) => {
          const moduleCreates: typeof createdModules = []
          try {
            const resolved = resolveOperation(operation)
            const data = createBatchItemInsideTransaction(database, context, projectId, resolved, moduleCreates)
            if (operation.ref) refs.set(operation.ref, data.id)
            createdModules.push(...moduleCreates)
            return { ok: true, data }
          } catch (error) {
            const reason = error instanceof Error ? error.message : 'INTERNAL_ERROR'
            throw new Error(`BATCH_ITEM:${index}:${reason}`)
          }
        }))
        return { atomic: true, agentRunId: options.agentRunId ?? null, results, createdModules }
      }

      const results: Array<{ ok: boolean; data?: BatchItemCreateResult; code?: string }> = []
      for (const operation of operations) {
        const moduleCreates: typeof createdModules = []
        try {
          const resolved = resolveOperation(operation)
          const data = runSqliteAtomic(database, () => createBatchItemInsideTransaction(database, context, projectId, resolved, moduleCreates))
          if (operation.ref) refs.set(operation.ref, data.id)
          createdModules.push(...moduleCreates)
          results.push({ ok: true, data })
        } catch (error) {
          const code = error instanceof Error && ['VALIDATION_ERROR', 'RELATION_OUT_OF_SCOPE', 'HIERARCHY_REQUIRED'].includes(error.message)
            ? error.message
            : 'INTERNAL_ERROR'
          results.push({ ok: false, code })
        }
      }
      return { atomic: false, agentRunId: options.agentRunId ?? null, results, createdModules }
    },
  }
}
