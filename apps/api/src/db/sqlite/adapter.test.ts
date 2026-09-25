import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from '../schema'
import { createSqlitePersistencePorts } from './adapter'
import type { PersistenceContext } from '../../persistence/models'

const migrationsFolder = new URL('../migrations', import.meta.url).pathname

function setup() {
  const sqlite = new Database(':memory:')
  const database = drizzle(sqlite, { schema })
  migrate(database, { migrationsFolder })
  sqlite.exec('PRAGMA foreign_keys = ON')
  const now = new Date().toISOString()
  sqlite.query('INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)').run('tenant-a', 'Tenant A', 'tenant-a', now)
  sqlite.query('INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)').run('tenant-b', 'Tenant B', 'tenant-b', now)
  return { sqlite, ports: createSqlitePersistencePorts(database, sqlite) }
}

const context: PersistenceContext = { tenantId: 'tenant-a', actorUserId: null, actorKind: 'SYSTEM' }

describe('adapter SQLite dos ports', () => {
  test('normaliza e-mail canônico e escopa lookup de usuário por tenant', async () => {
    const { sqlite, ports } = setup()
    const user = await ports.identity.createUser(context, { email: '  User@Example.COM ', name: 'Usuário', passwordHash: 'hash', globalGroup: 'TEAM_MEMBER' })

    expect(user.email).toBe('user@example.com')
    expect((await ports.identity.findUserByCanonicalEmail('USER@example.com'))?.id).toBe(user.id)
    expect(await ports.identity.findUser({ ...context, tenantId: 'tenant-b' }, user.id)).toBeNull()
    sqlite.close()
  })

  test('cria e consulta projetos/itens pelo contexto explícito', async () => {
    const { sqlite, ports } = setup()
    const project = await ports.projects.createProject(context, { name: 'Projeto', boardMode: 'SIMPLE' })
    const item = await ports.unitOfWork.createItemWithRelations({
      ...context,
      mutation: { origin: 'TEST', actorType: 'SYSTEM', actorSource: 'SYSTEM', actorLabel: null },
    }, { projectId: project.id, type: 'TASK', title: 'Item' })

    expect((await ports.projects.getProject(context, project.id))?.id).toBe(project.id)
    expect((await ports.items.getItem(context, project.id, item.id))?.title).toBe('Item')
    expect(await ports.items.getItem({ ...context, tenantId: 'tenant-b' }, project.id, item.id)).toBeNull()
    expect((await ports.items.listItems(context, project.id, { types: ['TASK'] })).map(row => row.id)).toEqual([item.id])
    sqlite.close()
  })

  test('cria agregado de projeto com defaults em uma operação atômica', async () => {
    const { sqlite, ports } = setup()
    const owner = await ports.identity.createUser(context, {
      email: 'project-owner@example.com', name: 'Owner', passwordHash: 'hash', globalGroup: 'MANAGER',
    })
    const mutation = {
      ...context, actorUserId: owner.id,
      mutation: { origin: 'REST', actorType: 'HUMAN' as const, actorSource: 'REST' as const, actorLabel: null },
    }
    const project = await ports.unitOfWork.createProjectAggregate(mutation, {
      project: { name: 'Projeto simples', boardMode: 'SIMPLE' },
      defaultColumns: [
        { name: 'A Fazer', baseStatus: 'NOT_STARTED' },
        { name: 'Concluídas', baseStatus: 'DONE' },
      ],
      defaultModuleName: 'Geral',
      simpleStoryTitle: 'Fluxo contínuo',
    })

    expect(project.simpleStoryId).toBeTruthy()
    expect((await ports.projects.getMembership(context, project.id, owner.id))?.role).toBe('ADMIN')
    expect((await ports.projects.listColumns(context, project.id)).map(column => column.name)).toEqual(['A Fazer', 'Concluídas'])
    expect(sqlite.query('SELECT project_id FROM project_analytics_coverage WHERE project_id = ?').get(project.id)).toEqual({ project_id: project.id })
    expect(sqlite.query('SELECT id FROM items WHERE id = ? AND type = ?').get(project.simpleStoryId, 'STORY')).toBeTruthy()

    const failedMutation = { ...mutation, actorUserId: 'missing-user' }
    expect(() => ports.unitOfWork.createProjectAggregate(failedMutation, {
      project: { name: 'Não persistir', boardMode: 'HIERARCHICAL' },
      defaultColumns: [], defaultModuleName: 'Geral', simpleStoryTitle: 'Fluxo contínuo',
    })).toThrow()
    expect(sqlite.query("SELECT id FROM projects WHERE name = 'Não persistir'").all()).toEqual([])
    sqlite.close()
  })

  test('ports de tenant, API key e tentativas de login mantêm isolamento e filtro canônico', async () => {
    const { sqlite, ports } = setup()
    const tenant = await ports.tenants.createTenant({ name: 'Tenant C', slug: 'tenant-c' })
    expect((await ports.tenants.getTenant(tenant.id))?.slug).toBe('tenant-c')

    const user = await ports.identity.createUser(context, {
      email: 'owner@example.com', name: 'Owner', passwordHash: 'hash', globalGroup: 'TEAM_MEMBER',
    })
    const ownerContext = { ...context, actorUserId: user.id }
    const key = await ports.apiKeys.create(ownerContext, {
      ownerId: user.id, name: 'Key', keyHash: 'unique-hash', projectScope: '["project-a"]',
    })
    expect((await ports.apiKeys.findByHash('unique-hash'))?.id).toBe(key.id)
    expect((await ports.apiKeys.listOwned(ownerContext)).map(row => row.id)).toEqual([key.id])
    await ports.apiKeys.updateLastUsed(ownerContext, key.id, '2026-09-23T00:00:00.000Z')
    expect((await ports.apiKeys.findByHash('unique-hash'))?.lastUsedAt).toBe('2026-09-23T00:00:00.000Z')
    expect(await ports.apiKeys.revokeOwned({ ...ownerContext, tenantId: 'tenant-b' }, key.id, '2026-09-23T00:01:00.000Z')).toBe(false)
    expect(await ports.apiKeys.revokeOwned(ownerContext, key.id, '2026-09-23T00:01:00.000Z')).toBe(true)

    const now = '2026-09-23T00:02:00.000Z'
    await ports.loginAttempts.record({ ip: '127.0.0.1', emailCanonical: 'owner@example.com', outcome: 'FAILURE', createdAt: now })
    await ports.loginAttempts.record({ ip: '127.0.0.1', emailCanonical: 'owner@example.com', outcome: 'SUCCESS', createdAt: now })
    expect(await ports.loginAttempts.getCounts({ ip: '127.0.0.1', emailCanonical: 'owner@example.com', since: '2026-09-22T00:00:00.000Z' }))
      .toEqual({ ipCount: 2, ipOldest: now, identityFailureCount: 1, identityFailureOldest: now })
    await ports.loginAttempts.resetIdentityFailures('owner@example.com')
    expect((await ports.loginAttempts.getCounts({ ip: '127.0.0.1', emailCanonical: 'owner@example.com', since: '2026-09-22T00:00:00.000Z' })).identityFailureCount).toBe(0)
    sqlite.close()
  })

  test('anexos, avatares e outbox de storage respeitam escopo e atomicidade', async () => {
    const { sqlite, ports } = setup()
    const project = await ports.projects.createProject(context, { name: 'Projeto anexos', boardMode: 'SIMPLE' })
    const item = await ports.items.createItem(context, { projectId: project.id, type: 'TASK', title: 'Item' })

    const attachment = await ports.files.createAttachment(context, project.id, item.id, {
      fileName: 'stored.bin', originalName: 'relatorio.txt', mimeType: 'text/plain', sizeBytes: 5, storagePath: 'tenant-a/item/stored.bin',
    })
    expect((await ports.files.listAttachments(context, project.id, item.id)).map(file => file.id)).toEqual([attachment.id])
    expect(await ports.files.getAttachment({ ...context, tenantId: 'tenant-b' }, project.id, item.id, attachment.id)).toBeNull()

    const removed = await ports.files.deleteAttachmentWithCleanup(context, project.id, item.id, attachment.id)
    expect(removed?.originalName).toBe('relatorio.txt')
    expect(await ports.files.getAttachment(context, project.id, item.id, attachment.id)).toBeNull()
    expect((await ports.storageCleanup.listDue(new Date().toISOString(), 10)).map(job => job.storagePath)).toEqual(['tenant-a/item/stored.bin'])

    const user = await ports.identity.createUser(context, { email: 'avatar@example.com', name: 'Avatar', passwordHash: 'hash', globalGroup: 'TEAM_MEMBER' })
    await ports.avatars.save({ tenantId: 'tenant-a', userId: user.id, mimeType: 'image/png', width: 256, height: 256, contentHash: 'hash-1', data: Buffer.from('img') })
    expect((await ports.avatars.get('tenant-a', user.id))?.contentHash).toBe('hash-1')
    expect(await ports.avatars.get('tenant-b', user.id)).toBeNull()
    await ports.avatars.remove('tenant-a', user.id)
    expect(await ports.avatars.get('tenant-a', user.id)).toBeNull()
    sqlite.close()
  })

  test('paridade: erros, rollback de transação e autorização entre tenants', async () => {
    const { sqlite, ports } = setup()
    const projectA = await ports.projects.createProject(context, { name: 'Projeto A', boardMode: 'SIMPLE' })
    const projectB = await ports.projects.createProject({ ...context, tenantId: 'tenant-b' }, { name: 'Projeto B', boardMode: 'SIMPLE' })
    const itemA = await ports.items.createItem(context, { projectId: projectA.id, type: 'TASK', title: 'Item A', parentId: projectA.simpleStoryId })

    // Isolamento: outro tenant não enxerga nem altera o recurso.
    expect(await ports.items.getItem({ ...context, tenantId: 'tenant-b' }, projectA.id, itemA.id)).toBeNull()
    expect(await ports.unitOfWork.updateItemWithRelations(
      { ...context, tenantId: 'tenant-b', mutation: { origin: 'TEST', actorType: 'SYSTEM', actorSource: 'SYSTEM', actorLabel: null } },
      projectA.id, itemA.id, { title: 'Invadido' },
    )).toBeNull()
    expect((await ports.items.getItem(context, projectA.id, itemA.id))?.title).toBe('Item A')

    // Rollback: criação com pai inexistente reverte e não deixa item órfão.
    await expect(ports.unitOfWork.createItemWithRelations(
      { ...context, mutation: { origin: 'TEST', actorType: 'SYSTEM', actorSource: 'SYSTEM', actorLabel: null } },
      { projectId: projectA.id, type: 'TASK', title: 'Órfão', parentId: 'parent-inexistente' },
    )).rejects.toThrow()
    expect((await ports.items.listItems(context, projectA.id)).some(item => item.title === 'Órfão')).toBe(false)

    // Erro de unicidade: e-mail global duplicado propaga e não cria segunda identidade.
    await ports.identity.createUser(context, { email: 'dup@example.com', name: 'Dup', passwordHash: 'hash', globalGroup: 'TEAM_MEMBER' })
    await expect(ports.identity.createUser({ ...context, tenantId: 'tenant-b' }, { email: 'dup@example.com', name: 'Dup 2', passwordHash: 'hash', globalGroup: 'TEAM_MEMBER' })).rejects.toThrow()

    // Checklist escopado por tenant: checklist de outro tenant não é encontrado.
    const itemB = await ports.items.createItem({ ...context, tenantId: 'tenant-b' }, { projectId: projectB.id, type: 'TASK', title: 'Item B', parentId: projectB.simpleStoryId })
    const checklistB = await ports.checklists.createChecklist({ ...context, tenantId: 'tenant-b' }, projectB.id, itemB.id, 'Checklist B')
    expect(await ports.checklists.getChecklist(context, projectA.id, itemA.id, checklistB.id)).toBeNull()
    sqlite.close()
  })
})
