import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { eq } from 'drizzle-orm'
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
  return { sqlite, database, ports: createSqlitePersistencePorts(database, sqlite) }
}

const context: PersistenceContext = { tenantId: 'tenant-a', actorUserId: null, actorKind: 'SYSTEM' }

describe('adapter SQLite dos ports', () => {
  test('gerencia modelos do agente em ordem e revoga credenciais sem referências', async () => {
    const { sqlite, database, ports } = setup()
    const now = new Date().toISOString()
    const ownerId = crypto.randomUUID()
    await database.insert(schema.users).values({
      id: ownerId, tenantId: 'tenant-a', email: `${ownerId}@test.local`, passwordHash: 'hash', name: 'Root',
      globalGroup: 'ROOT', createdAt: now, theme: 'light', lightShellTheme: 'petroleum', language: 'pt-BR',
    })
    await database.insert(schema.assistantCredentials).values({
      id: 'credential-shared', tenantId: 'tenant-a', provider: 'OPENAI', credentialMode: 'API_KEY',
      ciphertext: 'ciphertext', ciphertextVersion: 1, keyPrefix: 'sk-test...', scopesJson: '[]',
      revokedAt: null, createdBy: ownerId, createdAt: now,
    })
    await ports.agent.createModelConfig(context, {
      id: 'model-primary', provider: 'OPENAI', model: 'gpt-primary', credentialId: 'credential-shared',
      position: 50, enabled: true, validationStatus: 'VALID', validatedAt: now, createdAt: now, updatedAt: now,
    })
    await ports.agent.createModelConfig(context, {
      id: 'model-fallback', provider: 'OPENAI', model: 'gpt-fallback', credentialId: 'credential-shared',
      position: 50, enabled: true, validationStatus: 'VALID', validatedAt: now, createdAt: now, updatedAt: now,
    })

    expect((await ports.agent.listModelConfigs(context)).map(model => [model.id, model.position, model.keyPrefix]))
      .toEqual([['model-primary', 0, 'sk-test...'], ['model-fallback', 1, 'sk-test...']])
    expect((await ports.agent.getSettings(context))?.model).toBe('gpt-primary')
    expect(await ports.agent.listModelConfigs({ ...context, tenantId: 'tenant-b' })).toEqual([])

    expect(await ports.agent.reorderModelConfigs(context, ['model-fallback', 'model-primary'], now)).toBe(true)
    expect((await ports.agent.getSettings(context))?.model).toBe('gpt-fallback')
    expect(await ports.agent.updateModelConfig(context, 'model-fallback', { enabled: false, updatedAt: now })).toBe(true)
    expect((await ports.agent.getSettings(context))?.model).toBe('gpt-primary')

    expect(await ports.agent.deleteModelConfig(context, 'model-fallback', now)).toBe(true)
    expect((await database.query.assistantCredentials.findFirst({ where: eq(schema.assistantCredentials.id, 'credential-shared') }))?.revokedAt).toBeNull()
    expect(await ports.agent.deleteModelConfig(context, 'model-primary', now)).toBe(true)
    expect((await database.query.assistantCredentials.findFirst({ where: eq(schema.assistantCredentials.id, 'credential-shared') }))?.revokedAt).toBe(now)
    expect((await ports.agent.getSettings(context))?.credentialId).toBeNull()
    expect(sqlite.query('PRAGMA foreign_key_check').all()).toEqual([])
    sqlite.close()
  })

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

  test('listSubtree e hasChildren são tenant/projeto-scoped e ordenados por profundidade', async () => {
    const { sqlite, ports } = setup()
    const project = await ports.projects.createProject(context, { name: 'Árvore A', boardMode: 'HIERARCHICAL' })
    const otherProject = await ports.projects.createProject(context, { name: 'Árvore B', boardMode: 'HIERARCHICAL' })
    const otherTenantProject = await ports.projects.createProject({ ...context, tenantId: 'tenant-b' }, { name: 'Árvore tenant B', boardMode: 'HIERARCHICAL' })
    const now = new Date().toISOString()
    const insert = sqlite.query('INSERT INTO items (id, tenant_id, project_id, type, parent_id, ancestry_path, title, status, priority, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    insert.run('root-a', 'tenant-a', project.id, 'STORY', null, '[]', 'Raiz', 'NOT_STARTED', 'MEDIUM', 0, now, now)
    insert.run('child-a', 'tenant-a', project.id, 'TASK', 'root-a', '[{"id":"root-a","title":"Raiz","type":"STORY"}]', 'Filho', 'NOT_STARTED', 'MEDIUM', 1, now, now)
    insert.run('grandchild-a', 'tenant-a', project.id, 'BUG', 'child-a', '[{"id":"root-a","title":"Raiz","type":"STORY"},{"id":"child-a","title":"Filho","type":"TASK"}]', 'Neto', 'NOT_STARTED', 'MEDIUM', 2, now, now)
    // Relação parent_id malformada entre projetos do mesmo tenant: a CTE não atravessa project_id.
    insert.run('foreign-project-child', 'tenant-a', otherProject.id, 'TASK', 'root-a', '[]', 'Outro projeto', 'NOT_STARTED', 'MEDIUM', 0, now, now)
    insert.run('foreign-tenant-root', 'tenant-b', otherTenantProject.id, 'STORY', null, '[]', 'Outro tenant', 'NOT_STARTED', 'MEDIUM', 0, now, now)

    expect(await ports.items.hasChildren(context, project.id, 'root-a')).toBe(true)
    expect(await ports.items.hasChildren(context, project.id, 'grandchild-a')).toBe(false)
    expect((await ports.items.listSubtree(context, project.id, 'root-a')).map(item => item.id))
      .toEqual(['root-a', 'child-a', 'grandchild-a'])
    await expect(ports.items.listSubtree(context, project.id, 'root-a', 1)).rejects.toThrow('MAX_ANCESTRY_DEPTH')
    expect(await ports.items.listSubtree({ ...context, tenantId: 'tenant-b' }, project.id, 'root-a')).toEqual([])
    sqlite.close()
  })

  test('renomear ancestry não dispara SELECT por descendente', async () => {
    const { sqlite, ports } = setup()
    const project = await ports.projects.createProject(context, { name: 'Query count', boardMode: 'HIERARCHICAL' })
    const now = new Date().toISOString()
    const insert = sqlite.query('INSERT INTO items (id, tenant_id, project_id, type, parent_id, ancestry_path, title, status, priority, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    insert.run('root', 'tenant-a', project.id, 'STORY', null, '[]', 'Root', 'NOT_STARTED', 'MEDIUM', 0, now, now)
    let parentId = 'root'
    let ancestry = [{ id: 'root', title: 'Root', type: 'STORY' }]
    for (let depth = 1; depth <= 40; depth += 1) {
      const id = `node-${depth}`
      insert.run(id, 'tenant-a', project.id, depth % 2 ? 'TASK' : 'BUG', parentId, JSON.stringify(ancestry), id, 'NOT_STARTED', 'MEDIUM', depth, now, now)
      ancestry = [...ancestry, { id, title: id, type: depth % 2 ? 'TASK' : 'BUG' }]
      parentId = id
    }

    let reads = 0
    const originalQuery = sqlite.query.bind(sqlite)
    sqlite.query = ((statement: string) => {
      if (/^\s*(SELECT|WITH\s+RECURSIVE)/i.test(statement)) reads += 1
      return originalQuery(statement)
    }) as typeof sqlite.query
    await ports.unitOfWork.updateItemWithRelations({
      ...context,
      mutation: { origin: 'TEST', actorType: 'SYSTEM', actorSource: 'SYSTEM', actorLabel: null },
    }, project.id, 'root', { title: 'Renamed root' })

    expect(reads).toBeLessThan(20)
    expect(JSON.parse((await ports.items.getItem(context, project.id, 'node-40'))!.ancestryPath)[0]).toEqual({ id: 'root', title: 'Renamed root', type: 'STORY' })
    sqlite.close()
  })

  test('excluir subárvore não faz SELECT por item ou nível', async () => {
    const { sqlite, ports } = setup()
    const project = await ports.projects.createProject(context, { name: 'Delete query count', boardMode: 'HIERARCHICAL' })
    const now = new Date().toISOString()
    const insert = sqlite.query('INSERT INTO items (id, tenant_id, project_id, type, parent_id, ancestry_path, title, status, priority, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    insert.run('root', 'tenant-a', project.id, 'STORY', null, '[]', 'Root', 'NOT_STARTED', 'MEDIUM', 0, now, now)
    let parentId = 'root'
    let ancestry = [{ id: 'root', title: 'Root', type: 'STORY' }]
    for (let depth = 1; depth <= 40; depth += 1) {
      const id = `delete-${depth}`
      insert.run(id, 'tenant-a', project.id, depth % 2 ? 'TASK' : 'BUG', parentId, JSON.stringify(ancestry), id, 'NOT_STARTED', 'MEDIUM', depth, now, now)
      ancestry = [...ancestry, { id, title: id, type: depth % 2 ? 'TASK' : 'BUG' }]
      parentId = id
    }

    let reads = 0
    const originalQuery = sqlite.query.bind(sqlite)
    sqlite.query = ((statement: string) => {
      if (/^\s*(SELECT|WITH\s+RECURSIVE)/i.test(statement)) reads += 1
      return originalQuery(statement)
    }) as typeof sqlite.query
    const deleted = await ports.unitOfWork.deleteItemSubtree({
      ...context,
      mutation: { origin: 'TEST', actorType: 'SYSTEM', actorSource: 'SYSTEM', actorLabel: null },
    }, project.id, 'root')

    expect(deleted).toHaveLength(41)
    expect(reads).toBeLessThan(20)
    sqlite.close()
  })

  test('abrir sprint materializa folhas com SELECTs limitados em vez de dois por item', async () => {
    const { sqlite, ports } = setup()
    const project = await ports.projects.createProject(context, { name: 'Sprint query count', boardMode: 'SIMPLE' })
    const now = new Date().toISOString()
    const sprintId = 'sprint-query-count'
    sqlite.query('INSERT INTO sprints (id, tenant_id, project_id, name, status, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(sprintId, 'tenant-a', project.id, 'Sprint Q', 'PROPOSED', '2026-01-01', '2026-01-14', now)
    const insertItem = sqlite.query('INSERT INTO items (id, tenant_id, project_id, type, parent_id, ancestry_path, title, status, priority, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    insertItem.run('story-root', 'tenant-a', project.id, 'STORY', null, '[]', 'Story', 'NOT_STARTED', 'MEDIUM', 0, now, now)
    const itemIds = Array.from({ length: 40 }, (_, index) => `sprint-leaf-${index}`)
    for (const [index, itemId] of itemIds.entries()) {
      insertItem.run(itemId, 'tenant-a', project.id, 'TASK', 'story-root', '[]', itemId, 'NOT_STARTED', 'MEDIUM', index + 1, now, now)
    }
    insertItem.run('sprint-parent', 'tenant-a', project.id, 'TASK', 'story-root', '[]', 'Parent', 'NOT_STARTED', 'MEDIUM', 50, now, now)
    insertItem.run('sprint-child', 'tenant-a', project.id, 'BUG', 'sprint-parent', '[]', 'Child', 'NOT_STARTED', 'MEDIUM', 51, now, now)
    const insertLink = sqlite.query('INSERT INTO item_sprints (tenant_id, item_id, sprint_id) VALUES (?, ?, ?)')
    for (const itemId of [...itemIds, 'sprint-parent', 'sprint-child']) insertLink.run('tenant-a', itemId, sprintId)

    let reads = 0
    const originalQuery = sqlite.query.bind(sqlite)
    sqlite.query = ((statement: string) => {
      if (/^\s*(SELECT|WITH\s+RECURSIVE)/i.test(statement)) reads += 1
      return originalQuery(statement)
    }) as typeof sqlite.query
    await ports.planning.transitionSprint(context, project.id, sprintId, 'OPEN')
    const cycle = sqlite.query<{ id: string }, [string, string, string]>(
      'SELECT id FROM sprint_cycles WHERE tenant_id = ? AND project_id = ? AND sprint_id = ?',
    ).get('tenant-a', project.id, sprintId)!
    const captured = sqlite.query<{ item_id: string }, [string]>(
      'SELECT item_id FROM sprint_cycle_items WHERE cycle_id = ?',
    ).all(cycle.id).map(row => row.item_id)
    expect(captured).toHaveLength(41)
    expect(captured).not.toContain('sprint-parent')
    // Duas leituras de estado + leitura final do sprint; não escala com 42 itens.
    expect(reads).toBeLessThanOrEqual(5)
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
      label: 'Relatório mensal', referenceDate: '2026-09-30', description: 'Fechamento de setembro',
    })
    expect((await ports.files.listAttachments(context, project.id, item.id)).map(file => file.id)).toEqual([attachment.id])
    expect(attachment).toMatchObject({ label: 'Relatório mensal', referenceDate: '2026-09-30', description: 'Fechamento de setembro' })
    expect(await ports.files.getAttachment({ ...context, tenantId: 'tenant-b' }, project.id, item.id, attachment.id)).toBeNull()

    // T10: patch parcial preserva campos ausentes, null limpa e o escopo de tenant é respeitado
    const patched = await ports.files.updateAttachment(context, project.id, item.id, attachment.id, { label: 'Relatório final' })
    expect(patched).toMatchObject({ label: 'Relatório final', referenceDate: '2026-09-30', description: 'Fechamento de setembro' })
    const cleared = await ports.files.updateAttachment(context, project.id, item.id, attachment.id, { description: null })
    expect(cleared).toMatchObject({ label: 'Relatório final', description: null })
    expect(await ports.files.updateAttachment({ ...context, tenantId: 'tenant-b' }, project.id, item.id, attachment.id, { label: 'invasão' })).toBeNull()
    const noop = await ports.files.updateAttachment(context, project.id, item.id, attachment.id, {})
    expect(noop?.label).toBe('Relatório final')

    // Metadados ausentes no create persistem nulos (defaults são materializados na rota)
    const plain = await ports.files.createAttachment(context, project.id, item.id, {
      fileName: 'stored2.bin', originalName: 'simples.txt', mimeType: 'text/plain', sizeBytes: 3, storagePath: 'tenant-a/item/stored2.bin',
    })
    expect(plain).toMatchObject({ label: null, referenceDate: null, description: null })

    const removed = await ports.files.deleteAttachmentWithCleanup(context, project.id, item.id, attachment.id)
    expect(removed?.originalName).toBe('relatorio.txt')
    expect(removed?.label).toBe('Relatório final')
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
