import { afterEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  databaseFingerprint,
  ensureInstallationMarkers,
  INSTALLATION_MARKER_FILENAME,
  preflightInstallationMarkers,
  preflightVolumeMarker,
  sqliteInstallationMarkerStore,
  type InstallationMarker,
  type InstallationMarkerStore,
  type UnmarkedDatabaseState,
} from './installationMarkers'
import type { InstallProfileConfig } from './installProfile'
import * as schema from './schema'

const directories: string[] = []

async function setup(profile: InstallProfileConfig['profile'] = 'SIMPLE', state: UnmarkedDatabaseState = 'EMPTY') {
  const instanceDir = await mkdtemp(join(tmpdir(), 'azy-install-marker-'))
  directories.push(instanceDir)
  const config: InstallProfileConfig = profile === 'SIMPLE'
    ? { profile, databaseUrl: join(instanceDir, 'board.db'), instanceDir }
    : { profile, databaseUrl: 'postgresql://user:secret@db.example.test/azy', redisUrl: 'redis://redis.test:6379/0', instanceDir }
  let stored: InstallationMarker | null = null
  let audits = 0
  const store: InstallationMarkerStore = {
    read: async () => stored,
    write: async marker => { stored = marker },
    inspectUnmarked: async () => state,
    auditLegacySimple: async () => { audits += 1 },
  }
  return {
    config,
    store,
    get stored() { return stored },
    get audits() { return audits },
    setStored(next: InstallationMarker | null) { stored = next },
    setState(next: UnmarkedDatabaseState) { state = next },
  }
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('marcadores de perfil por instalação', () => {
  test('instalação nova grava o mesmo marcador no volume e no banco', async () => {
    const context = await setup()
    const marker = await ensureInstallationMarkers(context.config, context.store)
    const onDisk = JSON.parse(await readFile(join(context.config.instanceDir, INSTALLATION_MARKER_FILENAME), 'utf8'))

    expect(context.stored?.instanceId).toBe(marker.instanceId)
    expect(context.stored?.databaseFingerprint).toBe(marker.databaseFingerprint)
    expect(onDisk).toEqual(marker)
    expect(marker.profile).toBe('SIMPLE')
    expect(marker.databaseFingerprint).toBe(databaseFingerprint('SIMPLE', context.config.databaseUrl))
  })

  test('SQLite legado só é registrado como SIMPLE depois da auditoria', async () => {
    const context = await setup('SIMPLE', 'LEGACY_SIMPLE')
    await ensureInstallationMarkers(context.config, context.store)
    expect(context.audits).toBe(1)
    expect(context.stored?.profile).toBe('SIMPLE')
  })

  test('não adota dados SQLite legados para ADVANCED', async () => {
    const context = await setup('ADVANCED', 'LEGACY_SIMPLE')
    await expect(ensureInstallationMarkers(context.config, context.store)).rejects.toThrow('LEGACY_SQLITE_REQUIRES_NEW_INSTALLATION')
    expect(context.stored).toBeNull()
  })

  test('recusa troca de perfil na mesma instância', async () => {
    const context = await setup()
    const original = await ensureInstallationMarkers(context.config, context.store)
    const advanced: InstallProfileConfig = {
      profile: 'ADVANCED',
      databaseUrl: 'postgresql://user:secret@db.example.test/azy',
      redisUrl: 'redis://redis.test:6379/0',
      instanceDir: context.config.instanceDir,
    }
    await expect(ensureInstallationMarkers(advanced, context.store)).rejects.toThrow('INSTALL_PROFILE_MISMATCH')
    expect(context.stored).toEqual(original)
  })

  test('recusa trocar DATABASE_URL mesmo apontando para um banco vazio', async () => {
    const context = await setup()
    await ensureInstallationMarkers(context.config, context.store)
    const changed: InstallProfileConfig = { ...context.config, databaseUrl: join(context.config.instanceDir, 'other.db') }
    await expect(ensureInstallationMarkers(changed, context.store)).rejects.toThrow('INSTALL_DATABASE_MISMATCH')
    expect(() => preflightVolumeMarker(changed)).toThrow('INSTALL_DATABASE_MISMATCH')
  })

  test('não trata perda do marcador do volume como instalação nova', async () => {
    const context = await setup()
    await ensureInstallationMarkers(context.config, context.store)
    await rm(join(context.config.instanceDir, INSTALLATION_MARKER_FILENAME))
    await expect(ensureInstallationMarkers(context.config, context.store)).rejects.toThrow('INSTALLATION_VOLUME_MARKER_MISSING')
  })

  test('recupera inicialização interrompida somente para o mesmo destino vazio', async () => {
    const context = await setup()
    const marker = await ensureInstallationMarkers(context.config, context.store)
    // Simula queda depois da gravação do arquivo e antes do INSERT no banco.
    context.setStored(null)
    await ensureInstallationMarkers(context.config, context.store)
    expect(context.stored).toEqual(marker)
  })

  test('recusa dados não classificados sem marcadores', async () => {
    const context = await setup('SIMPLE', 'UNCLASSIFIED_DATA')
    await expect(ensureInstallationMarkers(context.config, context.store)).rejects.toThrow('INSTALLATION_MARKER_MISSING')
    expect(context.stored).toBeNull()
  })

  test('fingerprint PostgreSQL não contém usuário, senha nem query', () => {
    const a = databaseFingerprint('ADVANCED', 'postgresql://alice:secret-a@db.example.test:5432/azy?sslmode=require')
    const b = databaseFingerprint('ADVANCED', 'postgresql://bob:secret-b@db.example.test:5432/azy?sslmode=disable')
    expect(a).toBe(b)
    expect(a.includes('secret')).toBe(false)
    expect(a.length).toBe(64)
  })

  test('persiste marcador na tabela SQLite e reconhece instalação SIMPLE legada após auditoria', async () => {
    const context = await setup()
    const sqlite = new Database(':memory:')
    sqlite.exec('PRAGMA foreign_keys = ON;')
    try {
      const database = drizzle(sqlite, { schema })
      await migrate(database, { migrationsFolder: new URL('./migrations', import.meta.url).pathname })
      const store = sqliteInstallationMarkerStore(sqlite)
      await database.insert(schema.tenants).values({ id: 'legacy-tenant', name: 'Legado', slug: 'legado' })

      const marker = await ensureInstallationMarkers(context.config, store)
      expect(marker.profile).toBe('SIMPLE')
      expect(await store.read()).toEqual(marker)
      expect(await readFile(join(context.config.instanceDir, INSTALLATION_MARKER_FILENAME), 'utf8')).toContain(marker.instanceId)
    } finally {
      sqlite.close()
    }
  })

  test('preflight detecta divergência entre marcador do volume e do banco', async () => {
    const context = await setup()
    const sqlite = new Database(':memory:')
    sqlite.exec('PRAGMA foreign_keys = ON;')
    try {
      const database = drizzle(sqlite, { schema })
      await migrate(database, { migrationsFolder: new URL('./migrations', import.meta.url).pathname })
      const store = sqliteInstallationMarkerStore(sqlite)
      await ensureInstallationMarkers(context.config, store)
      sqlite.query(`UPDATE installation_metadata SET profile = 'ADVANCED' WHERE id = 1`).run()

      expect(() => preflightInstallationMarkers(context.config, sqlite)).toThrow('INSTALLATION_MARKER_MISMATCH')
    } finally {
      sqlite.close()
    }
  })

  test('preflight recusa banco marcado quando sumiu o marcador do volume', async () => {
    const context = await setup()
    const sqlite = new Database(':memory:')
    sqlite.exec('PRAGMA foreign_keys = ON;')
    try {
      const database = drizzle(sqlite, { schema })
      await migrate(database, { migrationsFolder: new URL('./migrations', import.meta.url).pathname })
      const store = sqliteInstallationMarkerStore(sqlite)
      await ensureInstallationMarkers(context.config, store)
      await rm(join(context.config.instanceDir, INSTALLATION_MARKER_FILENAME))

      expect(() => preflightInstallationMarkers(context.config, sqlite)).toThrow('INSTALLATION_VOLUME_MARKER_MISSING')
    } finally {
      sqlite.close()
    }
  })
})
