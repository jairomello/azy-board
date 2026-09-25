import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { eq } from 'drizzle-orm'

process.env.DATABASE_URL = ':memory:'
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
const { db } = await import('../db/index')
const { tenants, users, assistantConversations, assistantRuns } = await import('../db/schema')
const { claimNextRun, heartbeatRun, releaseRun, isCancelRequested, requestCancel } = await import('./agentJobQueue')

const id = () => crypto.randomUUID()

await migrate(db, { migrationsFolder: new URL('../db/migrations', import.meta.url).pathname })

let tenantId: string
let userId: string
let conversationId: string

beforeEach(async () => {
  // Create fresh test data for each test
  tenantId = id(); userId = id(); conversationId = id()
  const now = new Date().toISOString()
  await db.insert(tenants).values({ id: tenantId, name: 'QueueTest', slug: `q-${tenantId}`, createdAt: now })
  await db.insert(users).values({ id: userId, tenantId, email: `q-${userId}@test.local`, passwordHash: 'x', name: 'Queue User', createdAt: now })
  await db.insert(assistantConversations).values({ id: conversationId, tenantId, userId, title: 'Queue', createdAt: now, updatedAt: now })
})

async function createRun(overrides: Partial<{
  status: 'QUEUED' | 'RUNNING' | 'WAITING_USER' | 'WAITING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED'
  claimedBy: string | null
  claimExpiresAt: string | null
  attempts: number
  nextAttemptAt: string | null
  cancelRequested: boolean
}> = {}) {
  const runId = id()
  const now = new Date().toISOString()
  await db.insert(assistantRuns).values({
    id: runId, tenantId, conversationId, userId, model: 'test',
    status: overrides.status ?? 'QUEUED',
    claimedBy: overrides.claimedBy ?? null,
    claimExpiresAt: overrides.claimExpiresAt ?? null,
    attempts: overrides.attempts ?? 0,
    nextAttemptAt: overrides.nextAttemptAt ?? null,
    cancelRequested: overrides.cancelRequested ?? false,
    createdAt: now,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  })
  return runId
}

describe('Agent job queue', () => {
  test('claim atômico: dois workers concorrem, apenas um executa', async () => {
    const runId = await createRun()
    const worker1 = 'worker-1'
    const worker2 = 'worker-2'

    const claimed1 = await claimNextRun(worker1, tenantId)
    const claimed2 = await claimNextRun(worker2, tenantId)

    // Only one worker should get the run
    const successCount = [claimed1, claimed2].filter(Boolean).length
    expect(successCount).toBe(1)
  })

  test('lease: worker cai, lease expira, outro worker reivindica', async () => {
    const worker1 = 'worker-1'
    const worker2 = 'worker-2'
    // Create run with expired lease
    const expiredLease = new Date(Date.now() - 120_000).toISOString()
    const runId = await createRun({ claimedBy: worker1, claimExpiresAt: expiredLease, attempts: 1 })

    const claimed = await claimNextRun(worker2, tenantId)
    expect(claimed).not.toBeNull()
    expect(claimed!.runId).toBe(runId)
    expect(claimed!.workerId).toBe(worker2)
  })

  test('retry: erro transitório → backoff → reenfileiramento → nova tentativa', async () => {
    const worker = 'worker-retry'
    const runId = await createRun()

    // Claim the run
    const claimed = await claimNextRun(worker, tenantId)
    expect(claimed).not.toBeNull()

    // Release with retry (simulating transient error)
    const result = await releaseRun(runId, tenantId, worker, true)
    expect(result).toBe('released')

    // Run should be back in QUEUED with nextAttemptAt in the future
    const run = await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, runId) })
    expect(run!.status).toBe('QUEUED')
    expect(run!.attempts).toBe(2) // 1 from claim + 1 from release
    expect(run!.nextAttemptAt).not.toBeNull()
  })

  test('cancelamento: flag persistida → worker interrompe → CANCELLED', async () => {
    const runId = await createRun()

    // Request cancel
    const cancelled = await requestCancel(runId, tenantId)
    expect(cancelled).toBe(true)

    // Run should be CANCELLED immediately (was QUEUED)
    const run = await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, runId) })
    expect(run!.status).toBe('CANCELLED')
  })

  test('cancelamento durante execução: flag persistida, worker detecta', async () => {
    const worker = 'worker-cancel2'
    const runId = await createRun()

    // Claim the run
    const claimed = await claimNextRun(worker, tenantId)
    expect(claimed).not.toBeNull()

    // Request cancel during execution
    await requestCancel(runId, tenantId)

    // Worker should detect the cancel flag
    const cancelled = await isCancelRequested(runId, tenantId)
    expect(cancelled).toBe(true)
  })

  test('expiração: run QUEUED órfão → pode ser reivindicado', async () => {
    const runId = await createRun({ nextAttemptAt: new Date(Date.now() - 60_000).toISOString() })

    // Should be claimable since nextAttemptAt is in the past
    const claimed = await claimNextRun('worker-expire', tenantId)
    expect(claimed).not.toBeNull()
    expect(claimed!.runId).toBe(runId)
  })

  test('heartbeat: worker estende lease durante execução', async () => {
    const worker = 'worker-heartbeat'
    const runId = await createRun()

    // Claim the run
    const claimed = await claimNextRun(worker, tenantId)
    expect(claimed).not.toBeNull()

    // Extend lease
    const extended = await heartbeatRun(runId, tenantId, worker)
    expect(extended).toBe(true)
  })

  test('releaseRun: falha após max tentativas → FAILED WORKER_LOST', async () => {
    const worker = 'worker-max'
    // Create run with attempts already at MAX_ATTEMPTS - 1
    const runId = await createRun({ attempts: 2 })

    // Claim the run (increments attempts to 3)
    const claimed = await claimNextRun(worker, tenantId)
    expect(claimed).not.toBeNull()

    // Release with retry (should fail because attempts >= MAX_ATTEMPTS)
    const result = await releaseRun(runId, tenantId, worker, true)
    expect(result).toBe('failed')

    const run = await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, runId) })
    expect(run!.status).toBe('FAILED')
    expect(run!.errorCode).toBe('WORKER_LOST')
  })
})
