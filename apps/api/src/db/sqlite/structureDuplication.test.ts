import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as schema from '../schema'
import { createSqlitePersistencePorts } from './adapter'
import type { PersistencePorts } from '../../persistence/ports'
import type { MutationContext, PersistenceContext, ProjectRecord, StructureDuplicationPolicy } from '../../persistence/models'
import { buildDuplicationPlan, buildPlanItem, DEFAULT_DUPLICATION_POLICY, itemFacts } from '../../services/structureDuplication'
import { COMMAND_NAMESPACES, isIdempotentReplay, parseEnvelope } from '../../persistence/idempotency'

function setup(): { ports: PersistencePorts; cleanup: () => void } {
  const sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  const migrationsDir = join(import.meta.dir, '..', 'migrations')
  const journal = JSON.parse(readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ tag: string }> }
  for (const entry of journal.entries) sqlite.exec(readFileSync(join(migrationsDir, `${entry.tag}.sql`), 'utf8'))
  const ports = createSqlitePersistencePorts(drizzle(sqlite, { schema }), sqlite)
  return { ports, cleanup: () => sqlite.close() }
}

async function planFor(ports: PersistencePorts, scope: PersistenceContext, project: ProjectRecord, sourceRootId: string, destinationParentId: string, override: Partial<StructureDuplicationPolicy> = {}) {
  const policy: StructureDuplicationPolicy = { ...DEFAULT_DUPLICATION_POLICY, points: 'COPY', links: 'COPY', ...override }
  const subtree = await ports.items.listSubtree(scope, project.id, sourceRootId)
  const relations = new Map((await ports.items.listItemsWithRelations(scope, project.id)).map(row => [row.id, row]))
  const leafIds = new Set(subtree.map(item => item.id).filter(id => !subtree.some(child => child.parentId === id)))
  const items = []
  const checklists = []
  const links = []
  for (const item of subtree) {
    const lists = await ports.checklists.listChecklists(scope, project.id, item.id)
    const itemLinks = await ports.itemLinks.list(scope, project.id, item.id)
    items.push(buildPlanItem({ item, relations: relations.get(item.id), policy, checklists: lists, links: itemLinks, advancedChecklists: project.advancedChecklists, rootSourceId: sourceRootId, rootTitle: null, isLeaf: leafIds.has(item.id) }))
    for (const list of lists) checklists.push({ itemId: item.id, name: list.name, position: list.position, steps: list.items.map(step => ({ text: step.text, checked: step.checked, position: step.position, description: step.description })) })
    for (const link of itemLinks) links.push({ itemId: item.id, name: link.name, url: link.url, description: link.description })
  }
  const destinationParent = await ports.items.getItem(scope, project.id, destinationParentId)
  return buildDuplicationPlan({ project: { id: project.id, boardMode: project.boardMode, simpleStoryId: project.simpleStoryId }, sourceRoot: subtree[0]!, destinationParent, policies: policy, items, facts: { items: subtree.map(itemFacts), checklists, links }, excluded: { attachments: 0, hours: 0 } })
}

async function seed(ports: PersistencePorts) {
  const tenant = await ports.tenants.createTenant({ name: 'Dup', slug: `dup-${crypto.randomUUID()}` })
  const system: PersistenceContext = { tenantId: tenant.id, actorUserId: null, actorKind: 'SYSTEM', globalGroup: 'ADMIN' }
  const user = await ports.identity.createUser(system, { email: `dup-${crypto.randomUUID()}@test.local`, passwordHash: 'h', name: 'D', globalGroup: 'ADMIN' })
  const scope: PersistenceContext = { tenantId: tenant.id, actorUserId: user.id, actorKind: 'USER', globalGroup: 'ADMIN' }
  const mut: MutationContext = { ...scope, mutation: { origin: 'REST', actorType: 'HUMAN', actorSource: 'REST', actorLabel: null } }
  const project = await ports.unitOfWork.createProjectAggregate(mut, { project: { name: 'Dup', boardMode: 'HIERARCHICAL' }, defaultColumns: [{ name: 'Backlog', baseStatus: 'NOT_STARTED' }], defaultModuleName: 'G', simpleStoryTitle: 'S' })
  const batch = await ports.unitOfWork.createItemsBatch(mut, project.id, [
    { tool: 'create_task', ref: 'epic', title: 'Epic', type: 'EPIC', moduleName: 'G' },
    { tool: 'create_task', ref: 'story', title: 'Story', type: 'STORY', parentRef: 'epic' },
    { tool: 'create_task', ref: 'task', title: 'Task', type: 'TASK', parentRef: 'story', points: 3 },
    { tool: 'create_task', ref: 'sub', title: 'Sub', type: 'BUG', parentRef: 'task', points: 7 },
  ], { atomic: true })
  const ids = { epic: batch.results[0]!.data!.id, story: batch.results[1]!.data!.id, task: batch.results[2]!.data!.id, sub: batch.results[3]!.data!.id }
  const checklist = await ports.checklists.createChecklist(mut, project.id, ids.task, 'L')
  await ports.checklists.createChecklistItem(mut, project.id, ids.task, checklist.id, { text: 'done', checked: true, dueDate: '2026-10-20', description: 'd' })
  await ports.itemLinks.create(mut, project.id, ids.story, { name: 'ref', url: 'https://x.test/a' })
  const sprint = await ports.planning.createSprint(scope, project.id, { name: 'S', startDate: '2026-10-01', endDate: '2026-10-31', status: 'OPEN' })
  await ports.planning.addItemSprint(scope, project.id, ids.task, sprint.id)
  // Origem com histórico: DONE + horas, que a cópia não deve replicar.
  await ports.unitOfWork.updateItemWithRelations(mut, project.id, ids.task, { status: 'DONE' })
  await ports.workLogs.createItemLog(mut, project.id, ids.task, { type: 'manual', activity: 'trabalho', durationMin: 90 })
  const projectRecord = (await ports.projects.getProject(scope, project.id))!
  return { scope, mut, project: projectRecord, ids }
}

describe('duplicação de estrutura (SQLite)', () => {
  test('copia a subárvore limpa, sem defaults, e replay devolve os mesmos IDs', async () => {
    const { ports, cleanup } = setup()
    try {
      const { scope, mut, project, ids } = await seed(ports)
      const plan = await planFor(ports, scope, project, ids.story, ids.epic)
      const idempotent: MutationContext = { ...mut, idempotency: { namespace: COMMAND_NAMESPACES.duplicateStructure, projectScope: project.id, key: `k-${crypto.randomUUID()}`, payloadHash: 'hash', expiresAt: new Date(Date.now() + 3_600_000).toISOString() } }
      const result = await ports.unitOfWork.duplicateStructure(idempotent, plan)
      expect(result.createdItemIds).toHaveLength(3)

      const copies = await Promise.all(result.createdItemIds.map(id => ports.items.getItem(scope, project.id, id)))
      expect(copies.every(copy => copy?.status === 'NOT_STARTED')).toBe(true)
      const copiedTaskId = result.itemMap.find(entry => entry.sourceId === ids.task)!.copyId
      const copiedTask = (await ports.items.getItem(scope, project.id, copiedTaskId))!
      // COPY de pontos só em folhas: a task tem filho, então não herda pontos.
      expect(copiedTask.points).toBeNull()
      const copiedSubId = result.itemMap.find(entry => entry.sourceId === ids.sub)!.copyId
      expect((await ports.items.getItem(scope, project.id, copiedSubId))!.points).toBe(7)
      expect(copiedTask.versionId).toBeNull()
      expect(copiedTask.assigneeId).toBeNull()
      // Sprint CLEAR: nenhum vínculo copiado apesar de a origem ter sprint OPEN.
      const relations = new Map((await ports.items.listItemsWithRelations(scope, project.id)).map(row => [row.id, row]))
      expect(relations.get(copiedTaskId)!.itemSprints).toHaveLength(0)
      // Checklist reiniciada e sem data.
      const copiedChecklists = await ports.checklists.listChecklists(scope, project.id, copiedTaskId)
      expect(copiedChecklists[0]!.items[0]).toMatchObject({ text: 'done', checked: false, dueDate: null, description: 'd' })
      // Link copiado como metadado.
      const copiedStoryId = result.itemMap.find(entry => entry.sourceId === ids.story)!.copyId
      expect((await ports.itemLinks.list(scope, project.id, copiedStoryId)).map(link => link.url)).toEqual(['https://x.test/a'])
      // Sem histórico replicado.
      expect((await ports.workLogs.listItemLogs(scope, project.id, copiedTaskId, { page: 1, limit: 10 })).total).toBe(0)

      let replay: unknown = null
      try { await ports.unitOfWork.duplicateStructure(idempotent, plan) } catch (error) { if (isIdempotentReplay(error)) replay = parseEnvelope(error.record.responseJson)?.body ?? null }
      expect((replay as typeof result).itemMap).toEqual(result.itemMap)
    } finally {
      cleanup()
    }
  })

  test('fonte alterada após a prévia retorna conflito sem criar itens', async () => {
    const { ports, cleanup } = setup()
    try {
      const { scope, mut, project, ids } = await seed(ports)
      const plan = await planFor(ports, scope, project, ids.story, ids.epic)
      await ports.unitOfWork.updateItemWithRelations(mut, project.id, ids.task, { title: 'Alterado' })
      await expect(ports.unitOfWork.duplicateStructure(mut, plan)).rejects.toThrow('DUPLICATION_SOURCE_CHANGED')
      const items = await ports.items.listItems(scope, project.id)
      expect(items.filter(item => item.title === 'Alterado')).toHaveLength(1)
    } finally {
      cleanup()
    }
  })

  test('checklist alterada após a prévia também invalida o plano', async () => {
    const { ports, cleanup } = setup()
    try {
      const { scope, mut, project, ids } = await seed(ports)
      const plan = await planFor(ports, scope, project, ids.story, ids.epic)
      const checklists = await ports.checklists.listChecklists(scope, project.id, ids.task)
      await ports.checklists.updateChecklistItem(scope, project.id, ids.task, checklists[0]!.id, checklists[0]!.items[0]!.id, { text: 'editado' })
      await expect(ports.unitOfWork.duplicateStructure(mut, plan)).rejects.toThrow('DUPLICATION_SOURCE_CHANGED')
    } finally {
      cleanup()
    }
  })
})
