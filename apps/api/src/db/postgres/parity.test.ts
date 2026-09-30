import { describe, expect, test } from 'bun:test'
import { Client, type Pool } from 'pg'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from '../schema'
import { createSqlitePersistencePorts } from '../sqlite/adapter'
import { createPostgresPersistencePorts } from './adapter'
import { runPgMigrations } from './index'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PersistencePorts } from '../../persistence/ports'
import type { MutationContext, PersistenceContext } from '../../persistence/models'

const PG_URL = process.env.TEST_PG_URL ?? 'postgresql://postgres:postgres@localhost:5432/azyboard_parity'

function makeContext(tenantId: string): PersistenceContext {
  return { tenantId, actorUserId: 'user-1', actorKind: 'USER', globalGroup: 'ADMIN' }
}

function makeMutationContext(tenantId: string): MutationContext {
  return {
    ...makeContext(tenantId),
    mutation: { origin: 'REST', actorType: 'HUMAN', actorSource: 'REST', actorLabel: null },
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
  for (const file of ['0000_pale_warlock.sql', '0001_composite_fks.sql', '0003_items_tenant_project_parent_index.sql']) {
    await runPgMigrations(setupPool, [readFileSync(join(migrationsDir, file), 'utf8')])
  }
  await setupPool.end()
  const pool = new Pool({ connectionString: PG_URL })
  const ports = createPostgresPersistencePorts(pool)
  return { ports, pool, cleanup: () => pool.end() }
}

describe('Paridade SIMPLE ↔ ADVANCED', () => {
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
})
