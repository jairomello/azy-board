import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client, type Pool } from 'pg'
import { shouldRunPostgresTests } from './db/postgres/pgTestSupport'
import type { PersistencePorts } from './persistence/ports'

// [T37] Prova multi-worker contra PostgreSQL real: dois workers disputam a mesma
// run; o lease vence e o segundo assume nova geração; todos os efeitos,
// heartbeats, releases e finalizações da geração antiga são rejeitados.
const PG_URL = process.env.TEST_PG_URL ?? 'postgresql://postgres:postgres@localhost:5432/azyboard_advanced_worker'
const runPostgres = await shouldRunPostgresTests(PG_URL)
const instanceDir = mkdtempSync(join(tmpdir(), 'azyboard-advanced-worker-'))

describe.skipIf(!runPostgres)('ADVANCED worker — fencing entre dois workers (PostgreSQL real)', () => {
  let ports: PersistencePorts
  let pool: Pool
  let closeRuntime: () => Promise<void>
  let queue: typeof import('./services/agentJobQueue')
  let tenantId: string
  let userId: string
  let conversationId: string

  beforeAll(async () => {
    process.env.AZYBOARD_INSTALL_PROFILE = 'ADVANCED'
    process.env.DATABASE_URL = PG_URL
    process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379'
    process.env.AZYBOARD_INSTANCE_DIR = instanceDir
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = 'advanced-worker-fence-secret'

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
    ports = runtime.persistence
    queue = await import('./services/agentJobQueue')
    const { ensureInstallationMarkers } = await import('./db/installationMarkers')
    await ensureInstallationMarkers(runtime.installProfile, runtime.createMarkerStore())

    conversationId = crypto.randomUUID()
    const now = new Date().toISOString()
    const tenant = await ports.tenants.createTenant({ name: 'Worker Fence', slug: `wf-${crypto.randomUUID().slice(0, 8)}` })
    tenantId = tenant.id
    const user = await ports.identity.createUser(
      { tenantId, actorUserId: null, actorKind: 'SYSTEM' },
      { email: 'wf-user@advanced.test', passwordHash: 'hash', name: 'WF', globalGroup: 'TEAM_MEMBER' },
    )
    userId = user.id
    await ports.agent.createConversation({ tenantId, actorUserId: userId, actorKind: 'USER' }, {
      id: conversationId, userId, projectId: null, title: 'Fence', now,
    })
  })

  afterAll(async () => {
    await closeRuntime?.()
  })

  async function createRun(): Promise<string> {
    const runId = crypto.randomUUID()
    const now = new Date().toISOString()
    await ports.agent.insertRun({ tenantId, actorUserId: userId, actorKind: 'USER' }, {
      id: runId, conversationId, userId, model: 'test', idempotencyKey: null,
      expiresAt: new Date(Date.now() + 60_000).toISOString(), createdAt: now,
    })
    return runId
  }

  test('segundo worker assume nova geração e efeitos antigos são rejeitados', async () => {
    const runId = await createRun()

    const first = await queue.claimNextRun('worker-1', tenantId)
    expect(first?.runId).toBe(runId)
    expect(first?.generation).toBe(1)
    expect(await queue.heartbeatRun(runId, tenantId, 'worker-1', first!.generation)).toBe(true)

    // Lease vencido + run devolvida à fila (recuperação por outro worker).
    const raw = new Client({ connectionString: PG_URL })
    await raw.connect()
    await raw.query("UPDATE assistant_runs SET status = 'QUEUED', claim_expires_at = $1 WHERE id = $2", [new Date(Date.now() - 120_000).toISOString(), runId])
    await raw.end()

    const second = await queue.claimNextRun('worker-2', tenantId)
    expect(second?.runId).toBe(runId)
    expect(second?.generation).toBe(2)

    // Heartbeat/release/finalização da geração antiga são rejeitados.
    expect(await queue.heartbeatRun(runId, tenantId, 'worker-1', first!.generation)).toBe(false)
    expect(await queue.releaseRun(runId, tenantId, 'worker-1', first!.generation, true)).toBe('lost')
    expect(await ports.agent.finishRunFenced(runId, tenantId, 'worker-1', first!.generation, { status: 'COMPLETED' })).toBe(false)
    expect(await ports.agent.updateRunFenced(runId, tenantId, 'worker-1', first!.generation, { currentCursor: 9 })).toBe(false)

    // A geração vigente conclui normalmente.
    expect(await ports.agent.finishRunFenced(runId, tenantId, 'worker-2', second!.generation, { status: 'COMPLETED', finishedAt: new Date().toISOString() })).toBe(true)

    const scope = { tenantId, actorUserId: null, actorKind: 'SYSTEM' as const }
    const run = await ports.agent.getRun(scope, runId)
    expect(run?.status).toBe('COMPLETED')
    expect(run?.claimedBy).toBeNull()
    expect(run?.leaseGeneration).toBe(2)
  })
})
