import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from 'pg'
import { shouldRunPostgresTests } from './db/postgres/pgTestSupport'
import { INSTALLATION_MARKER_FILENAME } from './db/installationMarkers'
import type { InstallationMarker } from './db/installationMarkers'

// [ROLLOUT] Ensaios de rollout/rollback do perfil ADVANCED: uma instalação já
// inicializada (schema + marcador + dados) é submetida a um redeploy do mesmo
// schema em processo isolado; o preflight de marcador tem de passar sem
// recriar tenant, reaplicar dados ou sobrescrever o marcador. Réplicas
// múltiplas continuam condicionadas a T37/T38/T39.
const PG_URL = process.env.TEST_PG_URL ?? 'postgresql://postgres:postgres@localhost:5432/azyboard_advanced_rollout'
const REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379'
const runPostgres = await shouldRunPostgresTests(PG_URL)
const API_DIR = new URL('../', import.meta.url).pathname.replace(/\/$/, '')
const instanceDir = mkdtempSync(join(tmpdir(), 'azyboard-advanced-rollout-'))

function readMarker(): InstallationMarker {
  return JSON.parse(readFileSync(join(instanceDir, INSTALLATION_MARKER_FILENAME), 'utf8')) as InstallationMarker
}

describe.skipIf(!runPostgres)('ADVANCED rollout/rollback (PostgreSQL real)', () => {
  let closeRuntime: () => Promise<void>
  let tenantId: string
  let _projectId: string
  let markerBefore: InstallationMarker

  beforeAll(async () => {
    process.env.AZYBOARD_INSTALL_PROFILE = 'ADVANCED'
    process.env.DATABASE_URL = PG_URL
    process.env.REDIS_URL = REDIS_URL
    process.env.AZYBOARD_INSTANCE_DIR = instanceDir
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = 'advanced-rollout-test-secret'

    const setup = new Client({ connectionString: PG_URL })
    await setup.connect()
    await setup.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
    await setup.end()
    const migrationsDir = join(import.meta.dir, 'db', 'postgres', 'migrations')
    const files = readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()
    const client = new Client({ connectionString: PG_URL })
    await client.connect()
    for (const file of files) await client.query(readFileSync(join(migrationsDir, file), 'utf8'))
    await client.end()

    const runtime = await import('./persistence/runtime')
    closeRuntime = runtime.closeRuntime
    const { ensureInstallationMarkers } = await import('./db/installationMarkers')
    await ensureInstallationMarkers(runtime.installProfile, runtime.createMarkerStore())
    markerBefore = readMarker()

    const ports = runtime.persistence
    const tenant = await ports.tenants.createTenant({ name: 'Rollout', slug: `rollout-${crypto.randomUUID().slice(0, 8)}` })
    tenantId = tenant.id
    const user = await ports.identity.createUser(
      { tenantId, actorUserId: null, actorKind: 'SYSTEM' },
      { email: `rollout-${tenantId.slice(0, 8)}@advanced.test`, passwordHash: 'hash', name: 'Rollout', globalGroup: 'ADMIN' },
    )
    const project = await ports.unitOfWork.createProjectAggregate(
      { tenantId, actorUserId: user.id, actorKind: 'USER', mutation: { origin: 'REST', actorType: 'HUMAN', actorSource: 'REST', actorLabel: null } },
      { project: { name: 'Projeto Rollout', boardMode: 'SIMPLE' }, defaultColumns: [{ name: 'A Fazer', baseStatus: 'NOT_STARTED' }], defaultModuleName: 'Geral', simpleStoryTitle: 'Fluxo' },
    )
    _projectId = project.id

    // Simula o encerramento da instância antiga antes do redeploy.
    await closeRuntime()
  })

  afterAll(async () => {
    await closeRuntime?.()
  })

  function runProbe(dir: string) {
    return Bun.spawnSync({
      cmd: ['bun', './src/boot/markerPreflightProbe.ts'],
      cwd: API_DIR,
      env: {
        ...process.env,
        AZYBOARD_INSTALL_PROFILE: 'ADVANCED',
        DATABASE_URL: PG_URL,
        REDIS_URL,
        AZYBOARD_INSTANCE_DIR: dir,
        NODE_ENV: 'test',
        JWT_SECRET: 'advanced-rollout-test-secret',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })
  }

  test('redeploy do mesmo schema mantém marcador, volume e dados', () => {
    const result = runProbe(instanceDir)
    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString()).toContain('MARKER_PREFLIGHT_OK')

    // O preflight não recria a instalação: o marcador permanece o mesmo.
    expect(readMarker().instanceId).toBe(markerBefore.instanceId)
    expect(readMarker().databaseFingerprint).toBe(markerBefore.databaseFingerprint)

    const persisted = new Client({ connectionString: PG_URL })
    return persisted.connect()
      .then(() => persisted.query('SELECT count(*)::int AS cnt FROM projects WHERE tenant_id = $1', [tenantId]))
      .then(row => {
        expect((row.rows[0] as { cnt: number }).cnt).toBeGreaterThan(0)
      })
      .finally(() => persisted.end())
  })

  test('marcador divergente no redeploy é recusado (rollback para estado incompatível)', async () => {
    const mismatchDir = mkdtempSync(join(tmpdir(), 'azyboard-rollout-mismatch-'))
    const tampered: InstallationMarker = { ...markerBefore, databaseFingerprint: 'deadbeef'.repeat(8) }
    await (await import('node:fs/promises')).writeFile(
      join(mismatchDir, INSTALLATION_MARKER_FILENAME),
      JSON.stringify(tampered),
      'utf8',
    )
    const result = runProbe(mismatchDir)
    expect(result.stdout.toString()).not.toContain('MARKER_PREFLIGHT_OK')
    expect(result.exitCode).not.toBe(0)
  })
})
