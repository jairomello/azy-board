// change member-batch-add-grid — testes de unidade do adapter SQLite para a grade de
// candidatos a membro (busca/paginação no banco) e para a adição em lote transacional.
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

async function seedUsers(ports: ReturnType<typeof setup>['ports'], tenantId: string, names: string[]) {
  const created = []
  for (const name of names) {
    const slug = name.normalize('NFD').replace(/[^a-zA-Z]+/g, '.').toLowerCase()
    created.push(await ports.identity.createUser(
      { ...context, tenantId },
      { email: `${slug}@empresa.com`, name, passwordHash: 'hash', globalGroup: 'TEAM_MEMBER' },
    ))
  }
  return created
}

describe('listMemberCandidates (SQLite)', () => {
  test('busca por nome e por e-mail dobrando acentos e maiúsculas', async () => {
    const { sqlite, ports } = setup()
    const project = await ports.projects.createProject(context, { name: 'Projeto', boardMode: 'SIMPLE' })
    await seedUsers(ports, 'tenant-a', ['Álvaro Nunes', 'Bruno Lima', 'Carla Dias'])

    const byName = await ports.projects.listMemberCandidates(context, project.id, { q: 'alvaro', limit: 50, offset: 0 })
    expect(byName.items.map(item => item.name)).toEqual(['Álvaro Nunes'])
    expect(byName.total).toBe(1)

    const byAccent = await ports.projects.listMemberCandidates(context, project.id, { q: 'ÁLVARO', limit: 50, offset: 0 })
    expect(byAccent.items.map(item => item.name)).toEqual(['Álvaro Nunes'])

    const byEmail = await ports.projects.listMemberCandidates(context, project.id, { q: 'carla.dias@', limit: 50, offset: 0 })
    expect(byEmail.items.map(item => item.name)).toEqual(['Carla Dias'])

    // Curingas do LIKE no termo são literais: "ana%souza" não casa com "Ana Souza".
    const withWildcard = await ports.projects.listMemberCandidates(context, project.id, { q: 'ana%souza', limit: 50, offset: 0 })
    expect(withWildcard.items).toEqual([])
    sqlite.close()
  })

  test('ordena por nome no critério pt-BR e pagina de forma estável', async () => {
    const { sqlite, ports } = setup()
    const project = await ports.projects.createProject(context, { name: 'Projeto', boardMode: 'SIMPLE' })
    await seedUsers(ports, 'tenant-a', ['Zeca Prado', 'Álvaro Nunes', 'Bruno Lima', 'Érica Sá'])

    const first = await ports.projects.listMemberCandidates(context, project.id, { limit: 2, offset: 0 })
    const second = await ports.projects.listMemberCandidates(context, project.id, { limit: 2, offset: 2 })
    expect([...first.items, ...second.items].map(item => item.name))
      .toEqual(['Álvaro Nunes', 'Bruno Lima', 'Érica Sá', 'Zeca Prado'])
    expect(first.total).toBe(4)
    expect(second.total).toBe(4)
    sqlite.close()
  })

  test('eligibleOnly omite quem já é membro e isMember sinaliza quando desligado', async () => {
    const { sqlite, ports } = setup()
    const project = await ports.projects.createProject(context, { name: 'Projeto', boardMode: 'SIMPLE' })
    const [ana, bruno] = await seedUsers(ports, 'tenant-a', ['Ana Souza', 'Bruno Lima'])
    await ports.projects.addProjectMember(context, project.id, { userId: ana!.id, role: 'MEMBER' })

    const all = await ports.projects.listMemberCandidates(context, project.id, { limit: 50, offset: 0 })
    expect(all.total).toBe(2)
    expect(all.items.map(item => [item.name, item.isMember])).toEqual([['Ana Souza', true], ['Bruno Lima', false]])

    const eligible = await ports.projects.listMemberCandidates(context, project.id, { limit: 50, offset: 0, eligibleOnly: true })
    expect(eligible.total).toBe(1)
    expect(eligible.items.map(item => item.id)).toEqual([bruno!.id])
    sqlite.close()
  })

  test('não expõe usuários de outro tenant', async () => {
    const { sqlite, ports } = setup()
    const project = await ports.projects.createProject(context, { name: 'Projeto', boardMode: 'SIMPLE' })
    await seedUsers(ports, 'tenant-a', ['Ana Souza'])
    await seedUsers(ports, 'tenant-b', ['Zeca Prado'])

    const page = await ports.projects.listMemberCandidates(context, project.id, { limit: 50, offset: 0 })
    expect(page.total).toBe(1)
    expect(page.items.map(item => item.name)).toEqual(['Ana Souza'])
    sqlite.close()
  })
})

describe('addProjectMembers (SQLite)', () => {
  test('cria várias memberships em uma única chamada', async () => {
    const { sqlite, ports } = setup()
    const project = await ports.projects.createProject(context, { name: 'Projeto', boardMode: 'SIMPLE' })
    const squad = await ports.projects.createSquad(context, project.id, { name: 'Squad Alfa' })
    const users = await seedUsers(ports, 'tenant-a', ['Ana Souza', 'Bruno Lima'])

    const created = await ports.projects.addProjectMembers(context, project.id, [
      { userId: users[0]!.id, role: 'MEMBER', squadId: squad.id },
      { userId: users[1]!.id, role: 'VIEWER' },
    ])

    expect(created).toEqual([users[0]!.id, users[1]!.id])
    const members = await ports.projects.listProjectMembers(context, project.id)
    expect(members.map(member => [member.name, member.role, member.squadName]).sort())
      .toEqual([['Ana Souza', 'MEMBER', 'Squad Alfa'], ['Bruno Lima', 'VIEWER', null]])
    sqlite.close()
  })

  test('ignora quem já é membro sem duplicar vínculo', async () => {
    const { sqlite, ports } = setup()
    const project = await ports.projects.createProject(context, { name: 'Projeto', boardMode: 'SIMPLE' })
    const [ana, bruno] = await seedUsers(ports, 'tenant-a', ['Ana Souza', 'Bruno Lima'])
    await ports.projects.addProjectMember(context, project.id, { userId: ana!.id, role: 'VIEWER' })

    const created = await ports.projects.addProjectMembers(context, project.id, [
      { userId: ana!.id, role: 'ADMIN' },
      { userId: bruno!.id, role: 'MEMBER' },
    ])

    expect(created).toEqual([bruno!.id])
    const members = await ports.projects.listProjectMembers(context, project.id)
    expect(members.find(member => member.userId === ana!.id)?.role).toBe('VIEWER')
    sqlite.close()
  })

  test('squad fora do projeto aborta o lote inteiro sem membership parcial', async () => {
    const { sqlite, ports } = setup()
    const project = await ports.projects.createProject(context, { name: 'Projeto', boardMode: 'SIMPLE' })
    const other = await ports.projects.createProject(context, { name: 'Outro', boardMode: 'SIMPLE' })
    const squad = await ports.projects.createSquad(context, other.id, { name: 'Squad de outro projeto' })
    const users = await seedUsers(ports, 'tenant-a', ['Ana Souza', 'Bruno Lima'])

    await expect(ports.projects.addProjectMembers(context, project.id, [
      { userId: users[0]!.id, role: 'MEMBER' },
      { userId: users[1]!.id, role: 'MEMBER', squadId: squad.id },
    ])).rejects.toThrow('SQUAD_NOT_IN_PROJECT')

    expect(await ports.projects.listProjectMembers(context, project.id)).toEqual([])
    sqlite.close()
  })
})
