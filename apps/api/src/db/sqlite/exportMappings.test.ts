import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import * as schema from '../schema'
import { createSqlitePersistencePorts } from './adapter'
import type { MutationContext, PersistenceContext } from '../../persistence/models'

const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url))

function setup() {
  const sqlite = new Database(':memory:')
  const database = drizzle(sqlite, { schema })
  migrate(database, { migrationsFolder })
  sqlite.exec('PRAGMA foreign_keys = ON')
  const now = new Date().toISOString()
  sqlite.query('INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)').run('tenant-a', 'Tenant A', 'tenant-a', now)
  sqlite.query('INSERT INTO tenants (id, name, slug, created_at) VALUES (?, ?, ?, ?)').run('tenant-b', 'Tenant B', 'tenant-b', now)
  sqlite.query('INSERT INTO projects (id, tenant_id, name, created_at) VALUES (?, ?, ?, ?)').run('project-a', 'tenant-a', 'Projeto A', now)
  sqlite.query('INSERT INTO projects (id, tenant_id, name, created_at) VALUES (?, ?, ?, ?)').run('project-b', 'tenant-b', 'Projeto B', now)
  return { sqlite, ports: createSqlitePersistencePorts(database, sqlite) }
}

const readContext: PersistenceContext = { tenantId: 'tenant-a', actorUserId: 'user-1', actorKind: 'USER', globalGroup: 'TEAM_MEMBER' }
const mutationContext: MutationContext = {
  ...readContext,
  mutation: { origin: 'REST', actorType: 'HUMAN', actorSource: 'REST', actorLabel: null },
}

describe('mapeamentos de exportação no adapter SQLite', () => {
  test('cria, lista, atualiza e exclui mapeamento escopado por projeto', async () => {
    const { ports } = setup()
    const created = await ports.exportMappings.createMapping(mutationContext, 'project-a', {
      name: 'CRM', fields: [{ source: 'title', target: 'assunto' }],
    })
    expect(created.fields).toEqual([{ source: 'title', target: 'assunto' }])

    expect(await ports.exportMappings.listMappings(readContext, 'project-a')).toHaveLength(1)
    expect(await ports.exportMappings.listMappings(readContext, 'project-b')).toHaveLength(0)

    const updated = await ports.exportMappings.updateMapping(mutationContext, 'project-a', created.id, {
      fields: [{ source: 'title', target: 'assunto' }, { source: 'status', target: 'situacao' }],
    })
    expect(updated?.fields.map(field => field.target)).toEqual(['assunto', 'situacao'])

    expect(await ports.exportMappings.deleteMapping(mutationContext, 'project-a', created.id)).toBe(true)
    expect(await ports.exportMappings.getMapping(readContext, 'project-a', created.id)).toBeNull()
  })

  test('mapeamentos são privados do usuário que os criou', async () => {
    const { ports } = setup()
    const otherUser: PersistenceContext = { ...readContext, actorUserId: 'user-2' }
    const created = await ports.exportMappings.createMapping(mutationContext, 'project-a', {
      name: 'Privado', fields: [{ source: 'title', target: 'assunto' }],
    })

    expect(await ports.exportMappings.listMappings(readContext, 'project-a')).toHaveLength(1)
    expect(await ports.exportMappings.listMappings(otherUser, 'project-a')).toHaveLength(0)
    expect(await ports.exportMappings.getMapping(otherUser, 'project-a', created.id)).toBeNull()
    expect(await ports.exportMappings.updateMapping({ ...mutationContext, actorUserId: 'user-2' }, 'project-a', created.id, { name: 'Invasão' })).toBeNull()
    expect(await ports.exportMappings.deleteMapping({ ...mutationContext, actorUserId: 'user-2' }, 'project-a', created.id)).toBe(false)
    expect(await ports.exportMappings.listMappings(readContext, 'project-a')).toHaveLength(1)
  })

  test('não mistura tenants e recusa nome duplicado no mesmo projeto', async () => {
    const { ports } = setup()
    await ports.exportMappings.createMapping(mutationContext, 'project-a', {
      name: 'Planilha', fields: [{ source: 'id', target: 'id' }],
    })
    expect(await ports.exportMappings.listMappings({ ...readContext, tenantId: 'tenant-b' }, 'project-a')).toHaveLength(0)
    await expect(ports.exportMappings.createMapping(mutationContext, 'project-a', {
      name: 'Planilha', fields: [{ source: 'title', target: 'titulo' }],
    })).rejects.toThrow()
  })
})
