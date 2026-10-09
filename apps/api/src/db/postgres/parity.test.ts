import { describe, expect, test } from 'bun:test'
import type { Pool } from 'pg'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from '../schema'
import { createSqlitePersistencePorts } from '../sqlite/adapter'
import { createPostgresPersistencePorts } from './adapter'
import { runPgMigrations } from './index'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { PersistencePorts } from '../../persistence/ports'
import type { MutationContext, PersistenceContext } from '../../persistence/models'
import { shouldRunPostgresTests } from './pgTestSupport'
import { buildDuplicationPlan, buildPlanItem, DEFAULT_DUPLICATION_POLICY, itemFacts } from '../../services/structureDuplication'
import { COMMAND_NAMESPACES, isIdempotentReplay, parseEnvelope } from '../../persistence/idempotency'
import { buildSprintTransitionPlan, candidateFromItem, isEligibleCandidate } from '../../services/sprintTransition'
import type { ProjectRecord, StructureDuplicationPolicy } from '../../persistence/models'

const PG_URL = process.env.TEST_PG_URL ?? 'postgresql://postgres:postgres@localhost:5432/azyboard_parity'
const runPostgres = await shouldRunPostgresTests(PG_URL)

function makeContext(tenantId: string): PersistenceContext {
  return { tenantId, actorUserId: 'user-1', actorKind: 'USER', globalGroup: 'ADMIN' }
}

function makeMutationContext(tenantId: string): MutationContext {
  return {
    ...makeContext(tenantId),
    mutation: { origin: 'REST', actorType: 'HUMAN', actorSource: 'REST', actorLabel: null },
  }
}

async function buildDuplicationPlanForTest(
  ports: PersistencePorts, ctx: PersistenceContext, project: ProjectRecord,
  sourceRootId: string, destinationParentId: string | null, override: Partial<StructureDuplicationPolicy> = {},
) {
  const policy: StructureDuplicationPolicy = { ...DEFAULT_DUPLICATION_POLICY, points: 'COPY', links: 'COPY', ...override }
  const subtree = await ports.items.listSubtree(ctx, project.id, sourceRootId)
  const relations = new Map((await ports.items.listItemsWithRelations(ctx, project.id)).map(row => [row.id, row]))
  const leafIds = new Set(subtree.map(item => item.id).filter(id => !subtree.some(child => child.parentId === id)))
  const items = []
  const checklistFacts = []
  const linkFacts = []
  for (const item of subtree) {
    const lists = await ports.checklists.listChecklists(ctx, project.id, item.id)
    const links = await ports.itemLinks.list(ctx, project.id, item.id)
    items.push(buildPlanItem({ item, relations: relations.get(item.id), policy, checklists: lists, links, advancedChecklists: project.advancedChecklists, rootSourceId: sourceRootId, rootTitle: null, isLeaf: leafIds.has(item.id) }))
    for (const list of lists) checklistFacts.push({ itemId: item.id, name: list.name, position: list.position, steps: list.items.map(step => ({ text: step.text, checked: step.checked, position: step.position, description: step.description })) })
    for (const link of links) linkFacts.push({ itemId: item.id, name: link.name, url: link.url, description: link.description })
  }
  const destinationParent = destinationParentId ? await ports.items.getItem(ctx, project.id, destinationParentId) : null
  return buildDuplicationPlan({
    project: { id: project.id, boardMode: project.boardMode, simpleStoryId: project.simpleStoryId },
    sourceRoot: subtree[0]!, destinationParent, policies: policy, items,
    facts: { items: subtree.map(itemFacts), checklists: checklistFacts, links: linkFacts },
    excluded: { attachments: 0, hours: 0 },
  })
}

async function seedDuplication(ports: PersistencePorts, mode: 'HIERARCHICAL' | 'SIMPLE') {
  const tenant = await ports.tenants.createTenant({ name: `Dup ${mode}`, slug: `dup-${mode}-${crypto.randomUUID()}` })
  const ctx: PersistenceContext = { tenantId: tenant.id, actorUserId: null, actorKind: 'SYSTEM', globalGroup: 'ADMIN' }
  const user = await ports.identity.createUser(ctx, { email: `dup-${crypto.randomUUID()}@test.local`, passwordHash: 'h', name: 'Dup', globalGroup: 'ADMIN' })
  const scope: PersistenceContext = { tenantId: tenant.id, actorUserId: user.id, actorKind: 'USER', globalGroup: 'ADMIN' }
  const mut = { ...scope, mutation: { origin: 'REST', actorType: 'HUMAN' as const, actorSource: 'REST' as const, actorLabel: null } }
  const project = await ports.unitOfWork.createProjectAggregate(mut, {
    project: { name: `Dup ${mode}`, boardMode: mode }, defaultColumns: [{ name: 'Backlog', baseStatus: 'NOT_STARTED' }], defaultModuleName: 'G', simpleStoryTitle: 'Fixada',
  })
  const operations = mode === 'SIMPLE'
    ? [
        { tool: 'create_task' as const, ref: 'task', title: 'Task', type: 'TASK' as const, points: 3 },
        { tool: 'create_task' as const, ref: 'sub', title: 'Sub', type: 'BUG' as const, parentRef: 'task' },
      ]
    : [
        { tool: 'create_task' as const, ref: 'epic', title: 'Epic', type: 'EPIC' as const, moduleName: 'G' },
        { tool: 'create_task' as const, ref: 'story', title: 'Story', type: 'STORY' as const, parentRef: 'epic' },
        { tool: 'create_task' as const, ref: 'task', title: 'Task', type: 'TASK' as const, parentRef: 'story', points: 3 },
        { tool: 'create_task' as const, ref: 'sub', title: 'Sub', type: 'BUG' as const, parentRef: 'task' },
      ]
  const batch = await ports.unitOfWork.createItemsBatch(mut, project.id, operations, { atomic: true })
  const refs = ['epic', 'story', 'task', 'sub']
  const ids: Record<string, string> = {}
  batch.results.forEach((result, index) => { if (result.data) ids[refs[mode === 'SIMPLE' ? index + 2 : index]!] = result.data.id })
  const sourceRootId = mode === 'SIMPLE' ? project.simpleStoryId! : ids.story!
  const destinationParentId = mode === 'SIMPLE' ? project.simpleStoryId! : ids.epic!
  const checklist = await ports.checklists.createChecklist(mut, project.id, ids.task!, 'L')
  await ports.checklists.createChecklistItem(mut, project.id, ids.task!, checklist.id, { text: 'done', checked: true, dueDate: '2026-10-20', description: 'd' })
  await ports.itemLinks.create(mut, project.id, ids.story ?? sourceRootId, { name: 'ref', url: 'https://x.test/a' })
  const sprint = await ports.planning.createSprint(scope, project.id, { name: 'S', startDate: '2026-10-01', endDate: '2026-10-31', status: 'OPEN' })
  await ports.planning.addItemSprint(scope, project.id, ids.task!, sprint.id)
  const projectRecord = await ports.projects.getProject(scope, project.id)
  const plan = await buildDuplicationPlanForTest(ports, scope, projectRecord!, sourceRootId, destinationParentId)
  const idempotent = { ...mut, idempotency: { namespace: COMMAND_NAMESPACES.duplicateStructure, projectScope: project.id, key: `k-${tenant.id}`, payloadHash: 'hash', expiresAt: new Date(Date.now() + 3_600_000).toISOString() } }
  const result = await ports.unitOfWork.duplicateStructure(idempotent, plan)
  let replay: unknown = null
  try { await ports.unitOfWork.duplicateStructure(idempotent, plan) } catch (error) { if (isIdempotentReplay(error)) replay = parseEnvelope(error.record.responseJson)?.body ?? null }
  const copies = await Promise.all(result.createdItemIds.map(id => ports.items.getItem(scope, project.id, id)))
  const copiedTaskId = result.itemMap.find(entry => entry.sourceId === ids.task!)?.copyId
  const copiedStoryId = result.itemMap.find(entry => entry.sourceId === (mode === 'SIMPLE' ? sourceRootId : ids.story!))?.copyId
  const copiedChecklists = copiedTaskId ? await ports.checklists.listChecklists(scope, project.id, copiedTaskId) : []
  const copiedLinks = copiedStoryId ? await ports.itemLinks.list(scope, project.id, copiedStoryId) : []
  const copiedTaskLogs = copiedTaskId ? await ports.workLogs.listItemLogs(scope, project.id, copiedTaskId, { page: 1, limit: 10 }) : { total: 0 }
  const relationsAfter = new Map((await ports.items.listItemsWithRelations(scope, project.id)).map(row => [row.id, row]))
  return {
    mode, project, sourceRootId, destinationParentId, ids, result, replay, scope, mut,
    copiedSprintCount: result.createdItemIds.reduce((count, id) => count + (relationsAfter.get(id)?.itemSprints.length ?? 0), 0),
    // Sem IDs físicos e ordenado de forma estável: a ordem de irmãos criados
    // depende de UUIDs aleatórios, então a paridade compara forma, não ordem.
    copies: copies
      .map(item => item && ({ type: item.type, status: item.status, points: item.points, versionId: item.versionId, assigneeId: item.assigneeId, hasColumn: item.columnId !== null, hasParent: item.parentId !== null }))
      .sort((a, b) => `${a?.type}|${a?.points}|${a?.hasParent}`.localeCompare(`${b?.type}|${b?.points}|${b?.hasParent}`)),
    copiedChecklists: copiedChecklists
      .map(list => ({ name: list.name, steps: list.items.map(step => ({ text: step.text, checked: step.checked, dueDate: step.dueDate, description: step.description })) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    copiedLinks: copiedLinks.map(link => ({ name: link.name, url: link.url })).sort((a, b) => a.url.localeCompare(b.url)),
    copiedTaskLogCount: copiedTaskLogs.total,
    copyIds: result.createdItemIds,
  }
}

async function setupSqlite(): Promise<{ ports: PersistencePorts; cleanup: () => void }> {
  const sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  // Aplicar schema SQLite mínimo para testes
  const migrationsDir = join(import.meta.dir, '..', 'migrations')
  const journal = JSON.parse(readFileSync(join(migrationsDir, 'meta', '_journal.json'), 'utf8'))
  for (const entry of journal.entries) {
    const sql = readFileSync(join(migrationsDir, `${entry.tag}.sql`), 'utf8')
    sqlite.exec(sql)
  }
  const db = drizzle(sqlite, { schema })
  const ports = createSqlitePersistencePorts(db, sqlite)
  return { ports, cleanup: () => sqlite.close() }
}

async function setupPostgres(): Promise<{ ports: PersistencePorts; pool: Pool; cleanup: () => Promise<void> }> {
  const { Pool } = await import('pg')
  const setupPool = new Pool({ connectionString: PG_URL })
  await setupPool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
  const migrationsDir = join(import.meta.dir, 'migrations')
  // Aplica TODAS as migrations do dialect, em ordem, para não manter lista fixa.
  const migrationFiles = readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()
  for (const file of migrationFiles) {
    await runPgMigrations(setupPool, [readFileSync(join(migrationsDir, file), 'utf8')])
  }
  await setupPool.end()
  const pool = new Pool({ connectionString: PG_URL })
  const ports = createPostgresPersistencePorts(pool)
  return { ports, pool, cleanup: () => pool.end() }
}

describe.skipIf(!runPostgres)('Paridade SIMPLE ↔ ADVANCED', () => {
  test('modelos do agente têm a mesma ordem, disponibilidade e revogação nos dois adapters', async () => {
    const sqlite = await setupSqlite()
    const pg = await setupPostgres()
    try {
      const tenantSqlite = await sqlite.ports.tenants.createTenant({ name: 'Tenant Modelos', slug: 'tenant-modelos' })
      const tenantPg = await pg.ports.tenants.createTenant({ name: 'Tenant Modelos', slug: 'tenant-modelos' })
      const userSqlite = await sqlite.ports.identity.createUser({ tenantId: tenantSqlite.id, actorUserId: null, actorKind: 'SYSTEM' }, { email: 'models@test.local', passwordHash: 'hash', name: 'Root', globalGroup: 'ROOT' })
      const userPg = await pg.ports.identity.createUser({ tenantId: tenantPg.id, actorUserId: null, actorKind: 'SYSTEM' }, { email: 'models@test.local', passwordHash: 'hash', name: 'Root', globalGroup: 'ROOT' })
      const makeModel = async (ports: PersistencePorts, tenantId: string, userId: string, suffix: string, position: number) => {
        const context = { tenantId, actorUserId: userId, actorKind: 'USER' as const }
        const now = new Date().toISOString(), credentialId = crypto.randomUUID()
        await ports.agent.createCredential(context, { id: credentialId, provider: 'OPENAI', ciphertext: `cipher-${suffix}`, ciphertextVersion: 1, keyPrefix: `sk-${suffix}...`, createdBy: userId, createdAt: now })
        await ports.agent.createModelConfig(context, { id: `model-${suffix}`, provider: 'OPENAI', model: `gpt-${suffix}`, credentialId, position, enabled: true, validationStatus: 'VALID', validatedAt: now, createdAt: now, updatedAt: now })
        return credentialId
      }
      await Promise.all([
        makeModel(sqlite.ports, tenantSqlite.id, userSqlite.id, 'primary', 0),
        makeModel(pg.ports, tenantPg.id, userPg.id, 'primary', 0),
      ])
      const [credentialSqlite, credentialPg] = await Promise.all([
        makeModel(sqlite.ports, tenantSqlite.id, userSqlite.id, 'fallback', 1),
        makeModel(pg.ports, tenantPg.id, userPg.id, 'fallback', 1),
      ])
      const read = async (ports: PersistencePorts, tenantId: string, userId: string) => {
        const context = { tenantId, actorUserId: userId, actorKind: 'USER' as const }
        return {
          models: (await ports.agent.listModelConfigs(context)).map(model => [model.id, model.model, model.position, model.enabled]),
          primary: (await ports.agent.getSettings(context))?.model,
        }
      }
      expect(await read(sqlite.ports, tenantSqlite.id, userSqlite.id)).toEqual(await read(pg.ports, tenantPg.id, userPg.id))

      const now = new Date().toISOString()
      await Promise.all([
        sqlite.ports.agent.reorderModelConfigs({ tenantId: tenantSqlite.id, actorUserId: userSqlite.id, actorKind: 'USER' }, ['model-fallback', 'model-primary'], now),
        pg.ports.agent.reorderModelConfigs({ tenantId: tenantPg.id, actorUserId: userPg.id, actorKind: 'USER' }, ['model-fallback', 'model-primary'], now),
      ])
      expect((await read(sqlite.ports, tenantSqlite.id, userSqlite.id)).primary).toBe('gpt-fallback')
      expect((await read(pg.ports, tenantPg.id, userPg.id)).primary).toBe('gpt-fallback')
      await Promise.all([
        sqlite.ports.agent.updateModelConfig({ tenantId: tenantSqlite.id, actorUserId: userSqlite.id, actorKind: 'USER' }, 'model-fallback', { enabled: false, updatedAt: now }),
        pg.ports.agent.updateModelConfig({ tenantId: tenantPg.id, actorUserId: userPg.id, actorKind: 'USER' }, 'model-fallback', { enabled: false, updatedAt: now }),
      ])
      expect((await read(sqlite.ports, tenantSqlite.id, userSqlite.id)).primary).toBe('gpt-primary')
      expect((await read(pg.ports, tenantPg.id, userPg.id)).primary).toBe('gpt-primary')
      await Promise.all([
        sqlite.ports.agent.deleteModelConfig({ tenantId: tenantSqlite.id, actorUserId: userSqlite.id, actorKind: 'USER' }, 'model-fallback', now),
        pg.ports.agent.deleteModelConfig({ tenantId: tenantPg.id, actorUserId: userPg.id, actorKind: 'USER' }, 'model-fallback', now),
      ])
      expect(await sqlite.ports.agent.getActiveCredential({ tenantId: tenantSqlite.id, actorUserId: null, actorKind: 'SYSTEM' }, credentialSqlite)).toBeNull()
      expect(await pg.ports.agent.getActiveCredential({ tenantId: tenantPg.id, actorUserId: null, actorKind: 'SYSTEM' }, credentialPg)).toBeNull()
    } finally {
      sqlite.cleanup()
      await pg.cleanup()
    }
  })

  test('criação de tenant, usuário e projeto produz resultados equivalentes', async () => {
    const sqlite = await setupSqlite()
    const pg = await setupPostgres()
    try {
      const ctx = makeContext('tenant-1')
      const mutCtx = makeMutationContext('tenant-1')

      // Criar tenant
      const tenantSqlite = await sqlite.ports.tenants.createTenant({ name: 'Test', slug: 'test' })
      const tenantPg = await pg.ports.tenants.createTenant({ name: 'Test', slug: 'test' })
      expect(tenantSqlite.name).toBe(tenantPg.name)
      expect(tenantSqlite.slug).toBe(tenantPg.slug)

      // Criar usuário
      const userSqlite = await sqlite.ports.identity.createUser({ ...ctx, tenantId: tenantSqlite.id }, {
        email: 'test@example.com', passwordHash: 'hash', name: 'Test User', globalGroup: 'ADMIN',
      })
      const userPg = await pg.ports.identity.createUser({ ...ctx, tenantId: tenantPg.id }, {
        email: 'test@example.com', passwordHash: 'hash', name: 'Test User', globalGroup: 'ADMIN',
      })
      expect(userSqlite.email).toBe(userPg.email)
      expect(userSqlite.globalGroup).toBe(userPg.globalGroup)

      // Criar projeto
      const projectSqlite = await sqlite.ports.unitOfWork.createProjectAggregate(
        { ...mutCtx, tenantId: tenantSqlite.id, actorUserId: userSqlite.id },
        { project: { name: 'Projeto', boardMode: 'SIMPLE' }, defaultColumns: [{ name: 'A Fazer', baseStatus: 'NOT_STARTED' }], defaultModuleName: 'Geral', simpleStoryTitle: 'Fluxo' },
      )
      const projectPg = await pg.ports.unitOfWork.createProjectAggregate(
        { ...mutCtx, tenantId: tenantPg.id, actorUserId: userPg.id },
        { project: { name: 'Projeto', boardMode: 'SIMPLE' }, defaultColumns: [{ name: 'A Fazer', baseStatus: 'NOT_STARTED' }], defaultModuleName: 'Geral', simpleStoryTitle: 'Fluxo' },
      )
      expect(projectSqlite.name).toBe(projectPg.name)
      expect(projectSqlite.boardMode).toBe(projectPg.boardMode)

      // Listar projetos
      const projectsSqlite = await sqlite.ports.projects.listProjects({ ...ctx, tenantId: tenantSqlite.id }, { includeHidden: false })
      const projectsPg = await pg.ports.projects.listProjects({ ...ctx, tenantId: tenantPg.id }, { includeHidden: false })
      expect(projectsSqlite.length).toBe(projectsPg.length)

      // Listar colunas
      const columnsSqlite = await sqlite.ports.projects.listColumns({ ...ctx, tenantId: tenantSqlite.id }, projectSqlite.id)
      const columnsPg = await pg.ports.projects.listColumns({ ...ctx, tenantId: tenantPg.id }, projectPg.id)
      expect(columnsSqlite.length).toBe(columnsPg.length)
      expect(columnsSqlite[0]?.name).toBe(columnsPg[0]?.name)
    } finally {
      sqlite.cleanup()
      pg.cleanup()
    }
  })

  test('criação de item com relações produz resultados equivalentes', async () => {
    const sqlite = await setupSqlite()
    const pg = await setupPostgres()
    try {
      const ctx = makeContext('tenant-1')
      const mutCtx = makeMutationContext('tenant-1')

      // Setup
      const tenantSqlite = await sqlite.ports.tenants.createTenant({ name: 'T', slug: 't' })
      const tenantPg = await pg.ports.tenants.createTenant({ name: 'T', slug: 't' })
      const userSqlite = await sqlite.ports.identity.createUser({ ...ctx, tenantId: tenantSqlite.id }, { email: 'a@a.com', passwordHash: 'h', name: 'A', globalGroup: 'ADMIN' })
      const userPg = await pg.ports.identity.createUser({ ...ctx, tenantId: tenantPg.id }, { email: 'a@a.com', passwordHash: 'h', name: 'A', globalGroup: 'ADMIN' })
      const projectSqlite = await sqlite.ports.unitOfWork.createProjectAggregate(
        { ...mutCtx, tenantId: tenantSqlite.id, actorUserId: userSqlite.id },
        { project: { name: 'P', boardMode: 'SIMPLE' }, defaultColumns: [{ name: 'To Do', baseStatus: 'NOT_STARTED' }], defaultModuleName: 'G', simpleStoryTitle: 'S' },
      )
      const projectPg = await pg.ports.unitOfWork.createProjectAggregate(
        { ...mutCtx, tenantId: tenantPg.id, actorUserId: userPg.id },
        { project: { name: 'P', boardMode: 'SIMPLE' }, defaultColumns: [{ name: 'To Do', baseStatus: 'NOT_STARTED' }], defaultModuleName: 'G', simpleStoryTitle: 'S' },
      )

      // Criar item
      const itemSqlite = await sqlite.ports.unitOfWork.createItemWithRelations(
        { ...mutCtx, tenantId: tenantSqlite.id, actorUserId: userSqlite.id },
        { projectId: projectSqlite.id, type: 'TASK', title: 'Minha Task', priority: 'HIGH', points: 5 },
        { activity: 'Criado' },
      )
      const itemPg = await pg.ports.unitOfWork.createItemWithRelations(
        { ...mutCtx, tenantId: tenantPg.id, actorUserId: userPg.id },
        { projectId: projectPg.id, type: 'TASK', title: 'Minha Task', priority: 'HIGH', points: 5 },
        { activity: 'Criado' },
      )
      expect(itemSqlite.title).toBe(itemPg.title)
      expect(itemSqlite.type).toBe(itemPg.type)
      expect(itemSqlite.priority).toBe(itemPg.priority)
      expect(itemSqlite.points).toBe(itemPg.points)
      expect(itemSqlite.status).toBe(itemPg.status)

      const childSqlite = await sqlite.ports.unitOfWork.createItemWithRelations(
        { ...mutCtx, tenantId: tenantSqlite.id, actorUserId: userSqlite.id },
        { projectId: projectSqlite.id, type: 'BUG', parentId: itemSqlite.id, title: 'Filho' },
      )
      const childPg = await pg.ports.unitOfWork.createItemWithRelations(
        { ...mutCtx, tenantId: tenantPg.id, actorUserId: userPg.id },
        { projectId: projectPg.id, type: 'BUG', parentId: itemPg.id, title: 'Filho' },
      )
      const newParentSqlite = await sqlite.ports.unitOfWork.createItemWithRelations(
        { ...mutCtx, tenantId: tenantSqlite.id, actorUserId: userSqlite.id },
        { projectId: projectSqlite.id, type: 'TASK', parentId: projectSqlite.simpleStoryId, ancestryPath: JSON.stringify([{ id: projectSqlite.simpleStoryId!, title: 'S', type: 'STORY' }]), title: 'Novo pai' },
      )
      const newParentPg = await pg.ports.unitOfWork.createItemWithRelations(
        { ...mutCtx, tenantId: tenantPg.id, actorUserId: userPg.id },
        { projectId: projectPg.id, type: 'TASK', parentId: projectPg.simpleStoryId, ancestryPath: JSON.stringify([{ id: projectPg.simpleStoryId!, title: 'S', type: 'STORY' }]), title: 'Novo pai' },
      )
      const secondParentSqlite = await sqlite.ports.unitOfWork.createItemWithRelations(
        { ...mutCtx, tenantId: tenantSqlite.id, actorUserId: userSqlite.id },
        { projectId: projectSqlite.id, type: 'TASK', parentId: projectSqlite.simpleStoryId, ancestryPath: JSON.stringify([{ id: projectSqlite.simpleStoryId!, title: 'S', type: 'STORY' }]), title: 'Segundo pai' },
      )
      const secondParentPg = await pg.ports.unitOfWork.createItemWithRelations(
        { ...mutCtx, tenantId: tenantPg.id, actorUserId: userPg.id },
        { projectId: projectPg.id, type: 'TASK', parentId: projectPg.simpleStoryId, ancestryPath: JSON.stringify([{ id: projectPg.simpleStoryId!, title: 'S', type: 'STORY' }]), title: 'Segundo pai' },
      )
      expect(await sqlite.ports.items.hasChildren({ ...ctx, tenantId: tenantSqlite.id }, projectSqlite.id, itemSqlite.id)).toBe(true)
      expect(await pg.ports.items.hasChildren({ ...ctx, tenantId: tenantPg.id }, projectPg.id, itemPg.id)).toBe(true)
      expect((await sqlite.ports.items.listSubtree({ ...ctx, tenantId: tenantSqlite.id }, projectSqlite.id, itemSqlite.id)).map(row => row.id))
        .toEqual([itemSqlite.id, childSqlite.id])
      expect((await pg.ports.items.listSubtree({ ...ctx, tenantId: tenantPg.id }, projectPg.id, itemPg.id)).map(row => row.id))
        .toEqual([itemPg.id, childPg.id])
      expect(await pg.ports.items.listSubtree({ ...ctx, tenantId: 'other-tenant' }, projectPg.id, itemPg.id)).toEqual([])
      await expect(pg.ports.items.listSubtree({ ...ctx, tenantId: tenantPg.id }, projectPg.id, itemPg.id, 0))
        .rejects.toThrow('MAX_ANCESTRY_DEPTH')
      await sqlite.ports.unitOfWork.reparentSubtree({ ...mutCtx, tenantId: tenantSqlite.id, actorUserId: userSqlite.id }, projectSqlite.id, itemSqlite.id, newParentSqlite.id)
      await pg.ports.unitOfWork.reparentSubtree({ ...mutCtx, tenantId: tenantPg.id, actorUserId: userPg.id }, projectPg.id, itemPg.id, newParentPg.id)
      const movedSqlite = await sqlite.ports.items.listSubtree({ ...ctx, tenantId: tenantSqlite.id }, projectSqlite.id, itemSqlite.id)
      const movedPg = await pg.ports.items.listSubtree({ ...ctx, tenantId: tenantPg.id }, projectPg.id, itemPg.id)
      const displayPath = (path: string) => (JSON.parse(path) as Array<{ id: string; title: string; type: string }>).map(node => [node.title, node.type])
      expect(movedSqlite.map(row => displayPath(row.ancestryPath))).toEqual(movedPg.map(row => displayPath(row.ancestryPath)))
      expect((JSON.parse(movedPg[1]!.ancestryPath) as Array<{ id: string }>).map(node => node.id))
        .toEqual([projectPg.simpleStoryId!, newParentPg.id, itemPg.id])
      await sqlite.ports.unitOfWork.updateItemWithRelations(
        { ...mutCtx, tenantId: tenantSqlite.id, actorUserId: userSqlite.id }, projectSqlite.id, itemSqlite.id, { parentId: secondParentSqlite.id },
      )
      await pg.ports.unitOfWork.updateItemWithRelations(
        { ...mutCtx, tenantId: tenantPg.id, actorUserId: userPg.id }, projectPg.id, itemPg.id, { parentId: secondParentPg.id },
      )
      const updatedSqlite = await sqlite.ports.items.getItem({ ...ctx, tenantId: tenantSqlite.id }, projectSqlite.id, childSqlite.id)
      const updatedPg = await pg.ports.items.getItem({ ...ctx, tenantId: tenantPg.id }, projectPg.id, childPg.id)
      expect(displayPath(updatedSqlite!.ancestryPath)).toEqual(displayPath(updatedPg!.ancestryPath))
      // Listar itens
      const itemsSqlite = await sqlite.ports.items.listItems({ ...ctx, tenantId: tenantSqlite.id }, projectSqlite.id)
      const itemsPg = await pg.ports.items.listItems({ ...ctx, tenantId: tenantPg.id }, projectPg.id)
      expect(itemsSqlite.length).toBe(itemsPg.length)
      expect(await pg.ports.unitOfWork.deleteItemSubtree(
        { ...mutCtx, tenantId: tenantPg.id, actorUserId: userPg.id }, projectPg.id, itemPg.id,
      )).toEqual([itemPg.id, childPg.id])
      expect((await pg.ports.items.listItems({ ...ctx, tenantId: tenantPg.id }, projectPg.id)).map(row => row.id))
        .not.toContain(itemPg.id)
    } finally {
      sqlite.cleanup()
      pg.cleanup()
    }
  })

  test('PostgreSQL carrega subárvore profunda em número constante de leituras', async () => {
    const pg = await setupPostgres()
    try {
      const tenant = await pg.ports.tenants.createTenant({ name: 'Tenant query-count', slug: 'tenant-query-count' })
      const ctx = makeContext(tenant.id)
      const mutation = makeMutationContext(tenant.id)
      const user = await pg.ports.identity.createUser(ctx, { email: 'query-count@example.test', name: 'Query count', passwordHash: 'hash', globalGroup: 'ADMIN' })
      const project = await pg.ports.unitOfWork.createProjectAggregate({ ...mutation, actorUserId: user.id }, {
        project: { name: 'Árvore profunda', boardMode: 'SIMPLE' },
        defaultColumns: [], defaultModuleName: 'Geral', simpleStoryTitle: 'Raiz',
      })
      const rootId = project.simpleStoryId!
      const now = new Date().toISOString()
      let parentId = rootId
      for (let depth = 1; depth <= 40; depth += 1) {
        const id = `query-node-${depth}`
        await pg.pool.query(
          `INSERT INTO items (id, tenant_id, project_id, type, parent_id, ancestry_path, title, status, priority, position, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, '[]', $6, 'NOT_STARTED', 'MEDIUM', $7, $8, $8)`,
          [id, tenant.id, project.id, depth % 2 ? 'TASK' : 'BUG', parentId, id, depth, now],
        )
        parentId = id
      }

      let queryCount = 0
      const instrumented = pg.pool as unknown as { query: (...args: unknown[]) => Promise<unknown> }
      const originalQuery = instrumented.query.bind(pg.pool)
      instrumented.query = async (...args: unknown[]) => {
        queryCount += 1
        return originalQuery(...args)
      }
      const subtree = await pg.ports.items.listSubtree(ctx, project.id, rootId)
      expect(subtree).toHaveLength(41)
      expect(queryCount).toBeLessThanOrEqual(2)

      queryCount = 0
      expect(await pg.ports.items.hasChildren(ctx, project.id, rootId)).toBe(true)
      expect(queryCount).toBe(1)
    } finally {
      await pg.cleanup()
    }
  })

  test('abrir sprint PostgreSQL captura folhas com número constante de queries', async () => {
    const pg = await setupPostgres()
    try {
      const tenant = await pg.ports.tenants.createTenant({ name: 'Tenant sprint-batch', slug: 'tenant-sprint-batch' })
      const ctx = makeContext(tenant.id)
      const mutation = makeMutationContext(tenant.id)
      const user = await pg.ports.identity.createUser(ctx, { email: 'sprint-batch@example.test', name: 'Sprint batch', passwordHash: 'hash', globalGroup: 'ADMIN' })
      const project = await pg.ports.unitOfWork.createProjectAggregate({ ...mutation, actorUserId: user.id }, {
        project: { name: 'Sprint batch', boardMode: 'SIMPLE' },
        defaultColumns: [], defaultModuleName: 'Geral', simpleStoryTitle: 'Raiz',
      })
      const sprint = await pg.ports.planning.createSprint(ctx, project.id, {
        name: 'Abertura set-based', startDate: '2026-01-01', endDate: '2026-01-14', status: 'PROPOSED',
      })
      const now = new Date().toISOString()
      const leafIds: string[] = []
      for (let index = 0; index < 30; index += 1) {
        const itemId = `sprint-batch-${index}`
        leafIds.push(itemId)
        await pg.pool.query(
          `INSERT INTO items (id, tenant_id, project_id, type, parent_id, ancestry_path, title, status, priority, position, created_at, updated_at)
           VALUES ($1, $2, $3, 'TASK', $4, '[]', $1, 'NOT_STARTED', 'MEDIUM', $5, $6, $6)`,
          [itemId, tenant.id, project.id, project.simpleStoryId, index + 1, now],
        )
        await pg.ports.planning.addItemSprint(ctx, project.id, itemId, sprint.id)
      }
      const parentId = 'sprint-batch-parent'
      const childId = 'sprint-batch-child'
      await pg.pool.query(
        `INSERT INTO items (id, tenant_id, project_id, type, parent_id, ancestry_path, title, status, priority, position, created_at, updated_at)
         VALUES ($1, $2, $3, 'TASK', $4, '[]', 'Parent', 'NOT_STARTED', 'MEDIUM', 40, $5, $5),
                ($6, $2, $3, 'BUG', $1, '[]', 'Child', 'NOT_STARTED', 'MEDIUM', 41, $5, $5)`,
        [parentId, tenant.id, project.id, project.simpleStoryId, now, childId],
      )
      await pg.ports.planning.addItemSprint(ctx, project.id, parentId, sprint.id)
      await pg.ports.planning.addItemSprint(ctx, project.id, childId, sprint.id)

      await pg.ports.planning.transitionSprint(ctx, project.id, sprint.id, 'OPEN')
      const rows = await pg.pool.query('SELECT item_id FROM sprint_cycle_items WHERE tenant_id = $1 AND project_id = $2', [tenant.id, project.id])
      const captured = (rows.rows as Array<{ item_id: string }>).map(row => row.item_id)
      expect(captured.sort()).toEqual([...leafIds, childId].sort())
      expect(captured).not.toContain(parentId)
    } finally {
      await pg.cleanup()
    }
  })

  test('consulta de lacunas produz o mesmo total e grupos nos dois adapters e isola o resultado por ator', async () => {
    const sqlite = await setupSqlite()
    const pg = await setupPostgres()
    try {
      const where = { field: null, operator: 'ANY' as const, value: null, conditions: [
        { field: 'dueDate' as const, operator: 'IS_EMPTY' as const, value: null, conditions: null },
        { field: 'points' as const, operator: 'IS_EMPTY' as const, value: null, conditions: null },
      ] }
      const seed = async (ports: PersistencePorts, tenantId: string, userId: string, suffix: string) => {
        const ctx = { tenantId, actorUserId: userId, actorKind: 'USER' as const }
        const mut = { ...ctx, mutation: { origin: 'REST', actorType: 'HUMAN' as const, actorSource: 'REST' as const, actorLabel: null } }
        const project = await ports.unitOfWork.createProjectAggregate(mut, {
          project: { name: `P-${suffix}`, boardMode: 'SIMPLE' }, defaultColumns: [{ name: 'To Do', baseStatus: 'NOT_STARTED' }], defaultModuleName: 'G', simpleStoryTitle: 'S',
        })
        const empty = await ports.unitOfWork.createItemWithRelations(mut, { projectId: project.id, type: 'TASK', title: 'empty' })
        const zero = await ports.unitOfWork.createItemWithRelations(mut, { projectId: project.id, type: 'TASK', title: 'zero', points: 0 })
        await ports.unitOfWork.updateItemWithRelations(mut, project.id, zero.id, { dueDate: '2026-10-20' })
        const half = await ports.unitOfWork.createItemWithRelations(mut, { projectId: project.id, type: 'BUG', title: 'half' })
        await ports.unitOfWork.updateItemWithRelations(mut, project.id, half.id, { dueDate: '2026-10-20' })
        const snapshot = await ports.planningGapSnapshots.capture(ctx, { projectId: project.id, scope: null, where, limit: 50, referenceDate: null, timeZone: null })
        return { ctx, project, snapshot, ids: [empty.id, zero.id, half.id].sort() }
      }
      const tenantSqlite = await sqlite.ports.tenants.createTenant({ name: 'T', slug: `t-${crypto.randomUUID()}` })
      const tenantPg = await pg.ports.tenants.createTenant({ name: 'T', slug: `t-${crypto.randomUUID()}` })
      const userSqlite = await sqlite.ports.identity.createUser({ tenantId: tenantSqlite.id, actorUserId: null, actorKind: 'SYSTEM' }, { email: 'gaps@test.local', passwordHash: 'h', name: 'A', globalGroup: 'ADMIN' })
      const userPg = await pg.ports.identity.createUser({ tenantId: tenantPg.id, actorUserId: null, actorKind: 'SYSTEM' }, { email: 'gaps@test.local', passwordHash: 'h', name: 'A', globalGroup: 'ADMIN' })
      const left = await seed(sqlite.ports, tenantSqlite.id, userSqlite.id, 'sqlite')
      const right = await seed(pg.ports, tenantPg.id, userPg.id, 'pg')

      expect(left.snapshot.totalDistinct).toBe(2)
      expect(right.snapshot.totalDistinct).toBe(2)
      expect(left.snapshot.groups).toEqual(right.snapshot.groups)
      expect(left.snapshot.items.map(item => item.title).sort()).toEqual(right.snapshot.items.map(item => item.title).sort())

      // O resultado é vinculado ao ator: outro usuário não o acessa.
      const other = await pg.ports.identity.createUser({ tenantId: tenantPg.id, actorUserId: null, actorKind: 'SYSTEM' }, { email: 'other@test.local', passwordHash: 'h', name: 'B', globalGroup: 'ADMIN' })
      const otherCtx = { tenantId: tenantPg.id, actorUserId: other.id, actorKind: 'USER' as const }
      expect(await pg.ports.planningGapSnapshots.get(otherCtx, right.project.id, right.snapshot.resultId)).toBeNull()
      // E o acesso revogado de tenant distinto também não expõe o resultado.
      expect(await pg.ports.planningGapSnapshots.get({ ...otherCtx, tenantId: 'other-tenant' }, right.project.id, right.snapshot.resultId)).toBeNull()
    } finally {
      sqlite.cleanup()
      await pg.cleanup()
    }
  })

  test('duplicação HIERARCHICAL copia a subárvore limpa, sem defaults, e replay devolve os mesmos IDs', async () => {
    const sqlite = await setupSqlite()
    const pg = await setupPostgres()
    try {
      const left = await seedDuplication(sqlite.ports, 'HIERARCHICAL')
      const right = await seedDuplication(pg.ports, 'HIERARCHICAL')
      // Equivalência de forma entre adapters (IDs diferem por natureza).
      expect(left.copies).toEqual(right.copies)
      expect(left.copiedChecklists).toEqual(right.copiedChecklists)
      expect(left.copiedLinks).toEqual(right.copiedLinks)
      expect(left.result.createdItemIds).toHaveLength(3)
      expect(left.copies.every(copy => copy?.status === 'NOT_STARTED')).toBe(true)
      expect(left.copies.every(copy => copy?.hasColumn === true)).toBe(true)
      expect(left.copiedTaskLogCount).toBe(0)
      // Sprint CLEAR: nenhum vínculo de sprint foi copiado mesmo com sprint vigente.
      expect(left.copiedSprintCount).toBe(0)
      // Checklist reiniciada, mantendo descrição e limpando data/estado.
      expect(left.copiedChecklists[0]?.steps[0]).toEqual({ text: 'done', checked: false, dueDate: null, description: 'd' })
      // Links copiados como metadados.
      expect(left.copiedLinks).toEqual([{ name: 'ref', url: 'https://x.test/a' }])
      // Replay idempotente devolve o mesmo mapa sem criar estrutura nova.
      expect((left.replay as typeof left.result).itemMap).toEqual(left.result.itemMap)
    } finally {
      sqlite.cleanup()
      await pg.cleanup()
    }
  })

  test('duplicação SIMPLE copia descendentes para a STORY fixa sem criar nova história', async () => {
    const sqlite = await setupSqlite()
    const pg = await setupPostgres()
    try {
      const left = await seedDuplication(sqlite.ports, 'SIMPLE')
      const right = await seedDuplication(pg.ports, 'SIMPLE')
      expect(left.copies).toEqual(right.copies)
      expect(left.result.createdItemIds).toHaveLength(2)
      expect(left.copies.every(copy => copy?.type !== 'STORY' && copy?.type !== 'EPIC')).toBe(true)
      expect(left.copies.every(copy => copy?.hasParent === true)).toBe(true)
    } finally {
      sqlite.cleanup()
      await pg.cleanup()
    }
  })

  test('transição de sprint é equivalente entre adapters (carry-over aditivo + fechamento)', async () => {
    const sqlite = await setupSqlite()
    const pg = await setupPostgres()
    try {
      const run = async (ports: PersistencePorts) => {
        const tenant = await ports.tenants.createTenant({ name: 'Tr', slug: `tr-${crypto.randomUUID()}` })
        const system: PersistenceContext = { tenantId: tenant.id, actorUserId: null, actorKind: 'SYSTEM', globalGroup: 'ADMIN' }
        const user = await ports.identity.createUser(system, { email: `tr-${crypto.randomUUID()}@test.local`, passwordHash: 'h', name: 'T', globalGroup: 'ADMIN' })
        const scope: PersistenceContext = { tenantId: tenant.id, actorUserId: user.id, actorKind: 'USER', globalGroup: 'ADMIN' }
        const mut = { ...scope, mutation: { origin: 'REST', actorType: 'HUMAN' as const, actorSource: 'REST' as const, actorLabel: null } }
        const project = await ports.unitOfWork.createProjectAggregate(mut, { project: { name: 'Tr', boardMode: 'SIMPLE' }, defaultColumns: [{ name: 'Backlog', baseStatus: 'NOT_STARTED' }], defaultModuleName: 'G', simpleStoryTitle: 'S' })
        let source = await ports.planning.createSprint(scope, project.id, { name: 'Atual', startDate: '2026-10-01', endDate: '2026-10-14', status: 'PROPOSED' })
        const destination = await ports.planning.createSprint(scope, project.id, { name: 'Próxima', startDate: '2026-10-15', endDate: '2026-10-28', status: 'PROPOSED' })
        const third = await ports.planning.createSprint(scope, project.id, { name: 'Terceira', startDate: '2026-11-01', endDate: '2026-11-14', status: 'PROPOSED' })
        await ports.planning.transitionSprint(scope, project.id, source.id, 'OPEN')
        source = (await ports.planning.listSprints(scope, project.id)).find(candidate => candidate.id === source.id)!
        const batch = await ports.unitOfWork.createItemsBatch(mut, project.id, [
          { tool: 'create_task', ref: 'blocked', title: 'Bloqueado', type: 'TASK', points: 3 },
          { tool: 'create_task', ref: 'done', title: 'Concluído', type: 'TASK', points: 5 },
        ], { atomic: true })
        const blocked = batch.results[0]!.data!.id
        const done = batch.results[1]!.data!.id
        await ports.planning.addItemSprint(scope, project.id, blocked, source.id)
        await ports.planning.addItemSprint(scope, project.id, blocked, third.id)
        await ports.planning.addItemSprint(scope, project.id, done, source.id)
        await ports.unitOfWork.updateItemWithRelations(mut, project.id, blocked, { status: 'BLOCKED' })
        await ports.unitOfWork.updateItemWithRelations(mut, project.id, done, { status: 'DONE' })
        const items = await ports.items.listItemsWithRelations(scope, project.id)
        const parentIds = new Set(items.map(item => item.parentId).filter(Boolean) as string[])
        const candidates = items.filter(item => item.itemSprints.some(link => link.sprintId === source.id)).filter(item => isEligibleCandidate(item, !parentIds.has(item.id), true)).map(candidateFromItem).sort((a, b) => a.itemId.localeCompare(b.itemId))
        const cycle = (await ports.dashboard.listSprintCycles(scope, project.id)).find(item => item.sprintId === source.id && item.endedAt === null)!
        const plan = buildSprintTransitionPlan({ projectId: project.id, source, sourceCycleId: cycle.id, destination, candidates, excluded: { done: 1, cancelled: 0, archived: 0, aggregators: 0 } })
        const result = await ports.unitOfWork.applySprintTransition(mut, plan)
        const relations = new Map((await ports.items.listItemsWithRelations(scope, project.id)).map(row => [row.id, row]))
        const sprints = await ports.planning.listSprints(scope, project.id)
        return {
          appliedCount: result.appliedItemIds.length,
          blockedLinks: relations.get(blocked)!.itemSprints.map(link => link.sprintId).sort(),
          doneLinks: relations.get(done)!.itemSprints.map(link => link.sprintId),
          sourceStatus: sprints.find(s => s.id === source.id)!.status,
          destinationStatus: sprints.find(s => s.id === destination.id)!.status,
          activeCycle: (await ports.dashboard.listSprintCycles(scope, project.id)).some(c => c.sprintId === source.id && c.endedAt === null),
        }
      }
      const left = await run(sqlite.ports)
      const right = await run(pg.ports)
      expect(left.appliedCount).toBe(1)
      expect(left.blockedLinks).toHaveLength(3)
      expect(left.doneLinks).toHaveLength(1)
      expect(left.sourceStatus).toBe('CLOSED')
      expect(left.destinationStatus).toBe('PROPOSED')
      expect(left.activeCycle).toBe(false)
      expect({ ...left, blockedLinks: left.blockedLinks.length, doneLinks: left.doneLinks.length }).toEqual({ ...right, blockedLinks: right.blockedLinks.length, doneLinks: right.doneLinks.length })
    } finally {
      sqlite.cleanup()
      await pg.cleanup()
    }
  })

  test('mudança na origem após a prévia retorna conflito sem criar itens', async () => {
    const sqlite = await setupSqlite()
    try {
      const scenario = await seedDuplicationPlanOnly(sqlite.ports)
      await sqlite.ports.unitOfWork.updateItemWithRelations(scenario.mut, scenario.project.id, scenario.ids.task!, { title: 'Alterado' })
      await expect(sqlite.ports.unitOfWork.duplicateStructure(scenario.mut, scenario.plan)).rejects.toThrow('DUPLICATION_SOURCE_CHANGED')
      const items = await sqlite.ports.items.listItems(scenario.scope, scenario.project.id)
      expect(items.filter(item => item.title === 'Alterado')).toHaveLength(1)
    } finally {
      sqlite.cleanup()
    }
  })
})

async function seedDuplicationPlanOnly(ports: PersistencePorts) {
  const tenant = await ports.tenants.createTenant({ name: 'Plan only', slug: `plan-${crypto.randomUUID()}` })
  const ctx: PersistenceContext = { tenantId: tenant.id, actorUserId: null, actorKind: 'SYSTEM', globalGroup: 'ADMIN' }
  const user = await ports.identity.createUser(ctx, { email: `plan-${crypto.randomUUID()}@test.local`, passwordHash: 'h', name: 'P', globalGroup: 'ADMIN' })
  const scope: PersistenceContext = { tenantId: tenant.id, actorUserId: user.id, actorKind: 'USER', globalGroup: 'ADMIN' }
  const mut = { ...scope, mutation: { origin: 'REST', actorType: 'HUMAN' as const, actorSource: 'REST' as const, actorLabel: null } }
  const project = await ports.unitOfWork.createProjectAggregate(mut, {
    project: { name: 'Plan only', boardMode: 'HIERARCHICAL' }, defaultColumns: [{ name: 'Backlog', baseStatus: 'NOT_STARTED' }], defaultModuleName: 'G', simpleStoryTitle: 'S',
  })
  const batch = await ports.unitOfWork.createItemsBatch(mut, project.id, [
    { tool: 'create_task', ref: 'epic', title: 'Epic', type: 'EPIC', moduleName: 'G' },
    { tool: 'create_task', ref: 'story', title: 'Story', type: 'STORY', parentRef: 'epic' },
    { tool: 'create_task', ref: 'task', title: 'Task', type: 'TASK', parentRef: 'story' },
  ], { atomic: true })
  const ids = { epic: batch.results[0]!.data!.id, story: batch.results[1]!.data!.id, task: batch.results[2]!.data!.id }
  const projectRecord = await ports.projects.getProject(scope, project.id)
  const plan = await buildDuplicationPlanForTest(ports, scope, projectRecord!, ids.story, ids.epic)
  return { scope, mut, project, ids, plan }
}
