import { describe, expect, test } from 'bun:test'
import { Client } from 'pg'
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

async function setupPostgres(): Promise<{ ports: PersistencePorts; cleanup: () => void }> {
  const { Pool } = await import('pg')
  const setupPool = new Pool({ connectionString: PG_URL })
  await setupPool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
  const migrationsDir = join(import.meta.dir, 'migrations')
  for (const file of ['0000_pale_warlock.sql', '0001_composite_fks.sql']) {
    await runPgMigrations(setupPool, [readFileSync(join(migrationsDir, file), 'utf8')])
  }
  await setupPool.end()
  const pool = new Pool({ connectionString: PG_URL })
  const ports = createPostgresPersistencePorts(pool)
  return { ports, cleanup: () => pool.end() }
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

      // Listar itens
      const itemsSqlite = await sqlite.ports.items.listItems({ ...ctx, tenantId: tenantSqlite.id }, projectSqlite.id)
      const itemsPg = await pg.ports.items.listItems({ ...ctx, tenantId: tenantPg.id }, projectPg.id)
      expect(itemsSqlite.length).toBe(itemsPg.length)
    } finally {
      sqlite.cleanup()
      pg.cleanup()
    }
  })
})
