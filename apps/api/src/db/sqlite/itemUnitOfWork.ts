import type { Database } from 'bun:sqlite'
import type { ItemRecord, MutationContext } from '../../persistence/models'
import type { BatchItemCreateOperation, BatchItemCreateResult, BatchItemUpdate, ItemPatch, ItemRelationsMutation, NewItemRecord } from '../../persistence/ports'
import { generateId } from '../../utils/id'
import { nextSequenceCode as computeNextSequenceCode, sequencePrefix } from '../../utils/sequenceCode'
import { runSqliteAtomic } from './atomicTransaction'
import { assertJournalAvailable, reserveJournal } from './idempotencyJournal'
import { appendDomainEventSync } from './domainEventOutbox'
import { DOMAIN_EVENT_TYPES } from '../../persistence/domainEvents'
import { buildBatchUpdateResponse } from '../../persistence/commandResponses'
import { readItemSnapshot, readItemSnapshots, recordDeletedItemEventsBatch, recordItemEvent } from './itemAnalytics'

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
  icon: string | null
  color: string | null
  created_at: string
  updated_at: string
}

interface AncestryNode {
  id: string
  title: string
  type: ItemRecord['type']
}

const MAX_HIERARCHY_DEPTH = 50

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
  icon: 'icon',
  color: 'color',
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
    icon: row.icon,
    color: row.color,
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

function readSubtreeRows(database: Database, tenantId: string, projectId: string, rootId: string): Array<ItemRow & { subtree_depth: number }> {
  const rows = database.query<ItemRow & { subtree_depth: number }, [string, string, string, string, string, number, string, string]>(`
    WITH RECURSIVE subtree(id, depth) AS (
      SELECT id, 0 FROM items WHERE tenant_id = ? AND project_id = ? AND id = ?
      UNION ALL
      SELECT child.id, subtree.depth + 1
      FROM items AS child
      INNER JOIN subtree ON child.parent_id = subtree.id
      WHERE child.tenant_id = ? AND child.project_id = ? AND subtree.depth <= ?
    )
    SELECT items.*, subtree.depth AS subtree_depth
    FROM subtree
    INNER JOIN items ON items.tenant_id = ? AND items.project_id = ? AND items.id = subtree.id
    ORDER BY subtree.depth, subtree.id
  `).all(tenantId, projectId, rootId, tenantId, projectId, MAX_HIERARCHY_DEPTH, tenantId, projectId)
  if (rows.some(row => row.subtree_depth > MAX_HIERARCHY_DEPTH)) throw new Error('MAX_ANCESTRY_DEPTH')
  return rows
}

function collectSubtree(database: Database, tenantId: string, projectId: string, rootId: string): string[] {
  return readSubtreeRows(database, tenantId, projectId, rootId).map(row => row.id)
}

function collectModuleSubtrees(database: Database, tenantId: string, projectId: string, moduleId: string): string[] {
  const rows = database.query<{ id: string; depth: number }, [string, string, string, string, string, number]>(`
    WITH RECURSIVE subtree(id, depth) AS (
      SELECT id, 0 FROM items
      WHERE tenant_id = ? AND project_id = ? AND module_id = ? AND type = 'EPIC'
      UNION ALL
      SELECT child.id, subtree.depth + 1
      FROM items AS child
      INNER JOIN subtree ON child.parent_id = subtree.id
      WHERE child.tenant_id = ? AND child.project_id = ? AND subtree.depth <= ?
    )
    SELECT id, depth FROM subtree ORDER BY depth, id
  `).all(tenantId, projectId, moduleId, tenantId, projectId, MAX_HIERARCHY_DEPTH)
  if (rows.some(row => row.depth > MAX_HIERARCHY_DEPTH)) throw new Error('MAX_ANCESTRY_DEPTH')
  return rows.map(row => row.id)
}

function writeAncestryPaths(database: Database, tenantId: string, projectId: string, updates: Array<{ id: string; path: string }>) {
  const batchSize = 200
  const updatedAt = new Date().toISOString()
  for (let offset = 0; offset < updates.length; offset += batchSize) {
    const batch = updates.slice(offset, offset + batchSize)
    const cases = batch.map(() => 'WHEN ? THEN ?').join(' ')
    const ids = batch.map(() => '?').join(', ')
    const params: Array<string> = []
    for (const update of batch) params.push(update.id, update.path)
    params.push(updatedAt, tenantId, projectId, ...batch.map(update => update.id))
    database.query(
      `UPDATE items SET ancestry_path = CASE id ${cases} ELSE ancestry_path END, updated_at = ?
       WHERE tenant_id = ? AND project_id = ? AND id IN (${ids})`,
    ).run(...params)
  }
}

function refreshDescendantAncestry(database: Database, tenantId: string, projectId: string, rootId: string) {
  // [TENANT] A CTE lê somente a subárvore deste tenant e projeto; nenhuma
  // consulta adicional é feita por pai ou descendente.
  const rows = readSubtreeRows(database, tenantId, projectId, rootId)
  if (rows.length < 2) return
  const rowById = new Map(rows.map(row => [row.id, row]))
  const pathById = new Map<string, AncestryNode[]>()
  const root = rows[0]!
  pathById.set(root.id, JSON.parse(root.ancestry_path || '[]') as AncestryNode[])
  const updates: Array<{ id: string; path: string }> = []

  for (const row of rows.slice(1)) {
    if (!row.parent_id) throw new Error('HIERARCHY_INVALID_PARENT')
    const parent = rowById.get(row.parent_id)
    if (!parent) throw new Error('HIERARCHY_INVALID_PARENT')
    const parentPath = pathById.get(parent.id)
    if (!parentPath) throw new Error('HIERARCHY_ORDER_INVALID')
    const path = [...parentPath, { id: parent.id, title: parent.title, type: parent.type }]
    pathById.set(row.id, path)
    updates.push({ id: row.id, path: JSON.stringify(path) })
  }

  writeAncestryPaths(database, tenantId, projectId, updates)
}

function deleteItemsInsideTransaction(database: Database, context: MutationContext, projectId: string, itemIds: string[], recordAnalyticsEvents: boolean) {
  const itemIdSet = new Set(itemIds)
  const snapshots = readItemSnapshots(database, context.tenantId, projectId, itemIds)
  const parentIds = [...new Set([...snapshots.values()].flatMap(snapshot => snapshot.parentId ? [snapshot.parentId] : []))]
    .filter(parentId => !itemIdSet.has(parentId))
  const parentSnapshots = readItemSnapshots(database, context.tenantId, projectId, parentIds)
  const storagePaths: string[] = []

  // Dependências são lidas por lotes, em vez de uma consulta por item.
  for (let offset = 0; offset < itemIds.length; offset += 300) {
    const batch = itemIds.slice(offset, offset + 300)
    const placeholders = batch.map(() => '?').join(', ')
    const attachments = database.query<{ storage_path: string }, string[]>(
      `SELECT storage_path FROM attachments WHERE tenant_id = ? AND item_id IN (${placeholders})`,
    ).all(context.tenantId, ...batch)
    storagePaths.push(...attachments.map(attachment => attachment.storage_path))
  }

  const now = new Date().toISOString()
  for (let offset = 0; offset < storagePaths.length; offset += 100) {
    const batch = storagePaths.slice(offset, offset + 100)
    const values = batch.map(() => "(?, ?, ?, 'ATTACHMENT', 'PENDING', 0, ?, ?, ?)").join(', ')
    const params: string[] = []
    for (const storagePath of batch) params.push(generateId(), context.tenantId, storagePath, now, now, now)
    database.query(`INSERT OR IGNORE INTO storage_cleanup_jobs
      (id, tenant_id, storage_path, resource_type, status, attempts, available_at, created_at, updated_at)
      VALUES ${values}`).run(...params)
  }

  if (recordAnalyticsEvents) {
    recordDeletedItemEventsBatch(database, context, projectId, snapshots)
  }

  // Filhos primeiro para satisfazer a FK auto-referenciada sem deferred constraints.
  // Remoção de relações e checklists é set-based por lote; apenas o DELETE de
  // items continua ordenado por nó para respeitar a FK pai-filho imediata.
  for (let offset = 0; offset < itemIds.length; offset += 300) {
    const batch = itemIds.slice(offset, offset + 300)
    const placeholders = batch.map(() => '?').join(', ')
    const checklistIds = database.query<{ id: string }, string[]>(
      `SELECT id FROM checklists WHERE tenant_id = ? AND item_id IN (${placeholders})`,
    ).all(context.tenantId, ...batch).map(row => row.id)
    for (let checklistOffset = 0; checklistOffset < checklistIds.length; checklistOffset += 300) {
      const checklistBatch = checklistIds.slice(checklistOffset, checklistOffset + 300)
      const checklistPlaceholders = checklistBatch.map(() => '?').join(', ')
      database.query(`DELETE FROM checklist_items WHERE tenant_id = ? AND checklist_id IN (${checklistPlaceholders})`)
        .run(context.tenantId, ...checklistBatch)
    }
    database.query(`DELETE FROM checklists WHERE tenant_id = ? AND item_id IN (${placeholders})`).run(context.tenantId, ...batch)
    database.query(`DELETE FROM item_tags WHERE tenant_id = ? AND item_id IN (${placeholders})`).run(context.tenantId, ...batch)
    database.query(`DELETE FROM item_sprints WHERE tenant_id = ? AND item_id IN (${placeholders})`).run(context.tenantId, ...batch)
    database.query(`DELETE FROM attachments WHERE tenant_id = ? AND item_id IN (${placeholders})`).run(context.tenantId, ...batch)
    database.query(`DELETE FROM item_links WHERE tenant_id = ? AND item_id IN (${placeholders})`).run(context.tenantId, ...batch)
    database.query(`DELETE FROM item_logs WHERE tenant_id = ? AND item_id IN (${placeholders})`).run(context.tenantId, ...batch)
  }
  for (const itemId of [...itemIds].reverse()) {
    database.query('DELETE FROM items WHERE tenant_id = ? AND project_id = ? AND id = ?').run(context.tenantId, projectId, itemId)
  }

  if (recordAnalyticsEvents) {
    const remainingParentIds = new Set<string>()
    for (let offset = 0; offset < parentIds.length; offset += 300) {
      const batch = parentIds.slice(offset, offset + 300)
      const placeholders = batch.map(() => '?').join(', ')
      const rows = database.query<{ parent_id: string }, string[]>(
        `SELECT DISTINCT parent_id FROM items WHERE tenant_id = ? AND project_id = ? AND parent_id IN (${placeholders})`,
      ).all(context.tenantId, projectId, ...batch)
      rows.forEach(row => remainingParentIds.add(row.parent_id))
    }
    for (const [parentId, before] of parentSnapshots) {
      const after = { ...before, isLeaf: !remainingParentIds.has(parentId) }
      recordItemEvent(database, context, { projectId, itemId: parentId, eventType: 'LEAF_CHANGED', before, after })
    }
  }
}

export function deleteSqliteItemsInsideTransaction(database: Database, context: MutationContext, projectId: string, itemIds: string[], recordAnalyticsEvents = true) {
  deleteItemsInsideTransaction(database, context, projectId, itemIds, recordAnalyticsEvents)
}

// Próximo sequence_code do tipo dentro da transação do lote: a consulta vê os
// itens já gravados pelas operações anteriores do mesmo lote, então a numeração
// sai sequencial e sem colisão sem precisar de contador separado.
function nextBatchSequenceCode(database: Database, tenantId: string, projectId: string, type: string): string {
  const prefix = sequencePrefix(type)
  const rows = database.query<{ sequence_code: string | null }, [string, string, string]>(
    'SELECT sequence_code FROM items WHERE tenant_id = ? AND project_id = ? AND sequence_code LIKE ?',
  ).all(tenantId, projectId, `${prefix}%`)
  return computeNextSequenceCode(rows.map(row => row.sequence_code), type)
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
  const sequenceCode = nextBatchSequenceCode(database, context.tenantId, projectId, type)
  database.query(`INSERT INTO items
    (id, tenant_id, project_id, type, sequence_code, parent_id, module_id, column_id, ancestry_path, title, description,
     status, priority, points, assignee_id, author_id, version_id, icon, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NOT_STARTED', ?, ?, ?, ?, ?, ?, 0, ?, ?)`)
    .run(id, context.tenantId, projectId, type, sequenceCode, parentId, moduleId, firstColumn, JSON.stringify(ancestryPath), title,
      operation.description ?? null, priority, operation.points ?? null, assigneeId, context.actorUserId,
      operation.versionId ?? null, operation.icon ?? null, now, now)

  // Card T35 — vínculo automático de sprint no lote (antes inexistente).
  if (operation.sprintIds !== undefined) {
    replaceRelations(database, 'item_sprints', 'sprint_id', context.tenantId, projectId, id, operation.sprintIds)
  }

  const after = readItemSnapshot(database, context.tenantId, projectId, id)
  recordItemEvent(database, context, { projectId, itemId: id, eventType: 'ITEM_CREATED', correlationId: id, after })
  return {
    id, title, type, projectId, parentId, moduleId, columnId: firstColumn, sequenceCode,
    ancestryPath: JSON.stringify(ancestryPath), description: operation.description ?? null,
    priority, points: operation.points ?? null, assigneeId, status: 'NOT_STARTED',
    versionId: operation.versionId ?? null, icon: operation.icon ?? null, sprintIds: operation.sprintIds ?? [],
  }
}

/** Comandos transacionais de hierarquia/itens para o adapter SIMPLE. */
export function createSqliteItemUnitOfWork(database: Database) {
  return {
    createItemWithRelations(context: MutationContext, input: NewItemRecord, relations: ItemRelationsMutation = {}): ItemRecord {
      const now = new Date().toISOString()
      const id = generateId()
      return runSqliteAtomic(database, () => {
        // [T38] Reserva/replay da chave no MESMO commit da mutação.
        assertJournalAvailable(database, context)
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
        // Reserva PENDING com referência ao item; o corpo final é completado
        // após o commit. Crash antes disso é recuperável pela referência.
        const operationId = reserveJournal(database, context, JSON.stringify({ status: 201, body: { __pendingOperationId: id } }))
        // [T38] Evento de domínio durável no MESMO commit (invalidação).
        appendDomainEventSync(database, {
          tenantId: context.tenantId, projectId: input.projectId,
          type: DOMAIN_EVENT_TYPES.itemCreated,
          payload: { itemIds: [id], parentId: input.parentId ?? null },
          correlationId: context.mutation.correlationId ?? null,
          operationId,
        })
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
        const subtree = readSubtreeRows(database, context.tenantId, projectId, itemId)
        const root = subtree[0]
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
        const subtreeIds = new Set(subtree.map(row => row.id))
        const subtreeById = new Map(subtree.map(row => [row.id, row]))
        if ((newParentId && subtreeIds.has(newParentId)) || parentPath.some(node => node.id === itemId)) throw new Error('HIERARCHY_CYCLE')
        const rootPath = parent ? [...parentPath, { id: parent.id, title: parent.title, type: parent.type }] : []
        const maxSubtreeDepth = subtree.reduce((max, row) => Math.max(max, row.subtree_depth), 0)
        if (rootPath.length + maxSubtreeDepth > MAX_HIERARCHY_DEPTH) throw new Error('MAX_ANCESTRY_DEPTH')

        database.query('UPDATE items SET parent_id = ?, ancestry_path = ?, updated_at = ? WHERE tenant_id = ? AND project_id = ? AND id = ?')
          .run(newParentId, JSON.stringify(rootPath), new Date().toISOString(), context.tenantId, projectId, itemId)

        const pathById = new Map<string, AncestryNode[]>([[itemId, rootPath]])
        const pathUpdates: Array<{ id: string; path: string }> = []
        for (const row of subtree.slice(1)) {
          if (!row.parent_id) throw new Error('HIERARCHY_INVALID_PARENT')
          const parentRow = subtreeById.get(row.parent_id)
          const parentAncestry = pathById.get(row.parent_id)
          if (!parentRow || !parentAncestry) throw new Error('HIERARCHY_ORDER_INVALID')
          const path = [...parentAncestry, { id: parentRow.id, title: parentRow.title, type: parentRow.type }]
          pathById.set(row.id, path)
          pathUpdates.push({ id: row.id, path: JSON.stringify(path) })
        }
        writeAncestryPaths(database, context.tenantId, projectId, pathUpdates)

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
        // [T38] Reserva/replay idempotente na MESMA transação do movimento.
        assertJournalAvailable(database, context)
        const before = readItemSnapshot(database, context.tenantId, projectId, itemId)
        database.query('UPDATE items SET column_id = ?, status = ?, updated_at = ? WHERE tenant_id = ? AND project_id = ? AND id = ?')
          .run(column.id, column.baseStatus, new Date().toISOString(), context.tenantId, projectId, itemId)
        if (before) {
          insertActivity(database, context, itemId, context.mutation.activity ?? `Movido de '${fromColumnName}' para '${column.name}'`)
          recordItemEvent(database, context, { projectId, itemId, eventType: 'STATUS_CHANGED', before, after: readItemSnapshot(database, context.tenantId, projectId, itemId) })
        }
        reserveJournal(database, context, JSON.stringify({ status: 200, body: { itemId, columnId: column.id, status: column.baseStatus } }))
      })
    },

    deleteItemSubtree(context: MutationContext, projectId: string, itemId: string, options: { recordAnalyticsEvents?: boolean } = {}): string[] {
      return runSqliteAtomic(database, () => {
        const subtree = collectSubtree(database, context.tenantId, projectId, itemId)
        deleteItemsInsideTransaction(database, context, projectId, subtree, options.recordAnalyticsEvents ?? true)
        return subtree
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
        appendDomainEventSync(database, { tenantId: context.tenantId, projectId, type: DOMAIN_EVENT_TYPES.projectMetadataChanged, payload: { section: 'project' } })
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
          const subtreeIds = collectModuleSubtrees(database, context.tenantId, projectId, moduleId)
          deletedItemCount = subtreeIds.length
          deleteItemsInsideTransaction(database, context, projectId, subtreeIds, true)
        } else if (epics.length) {
          throw new Error('MODULE_HAS_EPICS')
        }

        const deleted = database.query('DELETE FROM modules WHERE tenant_id = ? AND project_id = ? AND id = ?')
          .run(context.tenantId, projectId, moduleId).changes === 1
        if (deleted) appendDomainEventSync(database, { tenantId: context.tenantId, projectId, type: DOMAIN_EVENT_TYPES.projectMetadataChanged, payload: { section: 'modules' } })
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

    applyItemBatch(context: MutationContext, projectId: string, updates: BatchItemUpdate[]): Array<{ id: string; identity: Record<string, unknown>; changes: Record<string, unknown> }> {
      return runSqliteAtomic(database, () => {
        assertJournalAvailable(database, context)
        const output: Array<{ id: string; identity: Record<string, unknown>; changes: Record<string, unknown> }> = []
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
          if (operation.responseChanges) output.push({ id: operation.itemId, identity: operation.responseIdentity ?? { id: operation.itemId }, changes: operation.responseChanges })
        }
        // [T38] Resultado integral do update em lote no MESMO commit.
        const operationId = reserveJournal(database, context, JSON.stringify({ status: 200, body: buildBatchUpdateResponse(output) }))
        if (output.length) {
          appendDomainEventSync(database, {
            tenantId: context.tenantId, projectId,
            type: DOMAIN_EVENT_TYPES.itemUpdated,
            payload: { itemIds: output.map(entry => entry.id) },
            operationId,
          })
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

      const agentRunId = options.agentRunId ?? null
      const envelope = (results: Array<{ ok: boolean; data?: BatchItemCreateResult; code?: string }>, atomic: boolean) =>
        JSON.stringify({ status: 200, body: { atomic, agentRunId, results } })

      if (options.atomic) {
        // atomic=true: uma transação para o lote inteiro; qualquer falha reverte
        // domínio/auditoria/analytics/journal juntos (sem gravação parcial).
        const results = runSqliteAtomic(database, () => {
          assertJournalAvailable(database, context)
          const mapped = operations.map((operation, index) => {
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
          })
          const operationId = reserveJournal(database, context, envelope(mapped, true))
          appendDomainEventSync(database, {
            tenantId: context.tenantId, projectId,
            type: DOMAIN_EVENT_TYPES.itemCreated,
            payload: { itemIds: mapped.filter(entry => entry.ok && entry.data).map(entry => entry.data!.id) },
            operationId,
          })
          return mapped
        })
        return { atomic: true, agentRunId, results, createdModules }
      }

      // atomic=false: transação única do pedido com savepoints por operação;
      // itens válidos persistem, inválidos são revertidos ao savepoint, e o
      // resultado integral é gravado no MESMO commit do pedido.
      const results = runSqliteAtomic(database, () => {
        assertJournalAvailable(database, context)
        const collected: Array<{ ok: boolean; data?: BatchItemCreateResult; code?: string }> = []
        operations.forEach((operation, index) => {
          const savepoint = `batch_op_${index}`
          database.exec(`SAVEPOINT ${savepoint}`)
          const moduleCreates: typeof createdModules = []
          try {
            const resolved = resolveOperation(operation)
            const data = createBatchItemInsideTransaction(database, context, projectId, resolved, moduleCreates)
            if (operation.ref) refs.set(operation.ref, data.id)
            createdModules.push(...moduleCreates)
            collected.push({ ok: true, data })
            database.exec(`RELEASE ${savepoint}`)
          } catch (error) {
            database.exec(`ROLLBACK TO ${savepoint}`)
            database.exec(`RELEASE ${savepoint}`)
            const code = error instanceof Error && ['VALIDATION_ERROR', 'RELATION_OUT_OF_SCOPE', 'HIERARCHY_REQUIRED'].includes(error.message)
              ? error.message
              : 'INTERNAL_ERROR'
            collected.push({ ok: false, code })
          }
        })
        const operationId = reserveJournal(database, context, envelope(collected, false))
        appendDomainEventSync(database, {
          tenantId: context.tenantId, projectId,
          type: DOMAIN_EVENT_TYPES.itemCreated,
          payload: { itemIds: collected.filter(entry => entry.ok && entry.data).map(entry => entry.data!.id) },
          operationId,
        })
        return collected
      })
      return { atomic: false, agentRunId, results, createdModules }
    },
  }
}
