import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { eq } from 'drizzle-orm'

process.env.DATABASE_URL = ':memory:'
const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
const { db } = await import('../db/index')
const { tenants, users, assistantConversations, assistantRuns } = await import('../db/schema')
const { claimNextRun, heartbeatRun, releaseRun, isCancelRequested, requestCancel } = await import('./agentJobQueue')
const { AgentWorker } = await import('./agentWorker')
const { persistence } = await import('../persistence/runtime')

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
  recoveryAttempts: number
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
    recoveryAttempts: overrides.recoveryAttempts ?? 0,
    createdAt: now,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  })
  return runId
}

describe('Agent job queue', () => {
  test('worker inicia polling e executa callback da run reivindicada', async () => {
    const runId = await createRun()
    let worker!: InstanceType<typeof AgentWorker>
    const executed = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Worker não consumiu a run')), 1_000)
      worker = new AgentWorker({ tenantId, executeRun: async (claimedId, claimedTenantId) => {
        clearTimeout(timer)
        expect(claimedTenantId).toBe(tenantId)
        await db.update(assistantRuns).set({ status: 'COMPLETED', finishedAt: new Date().toISOString() }).where(eq(assistantRuns.id, claimedId))
        resolve(claimedId)
      } })
      worker.start()
    })
    try { expect(await executed).toBe(runId) } finally { await worker.stop() }
    expect((await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, runId) }))?.status).toBe('COMPLETED')
  })

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

    // Release with retry (simulating transient error), fenced pela geração obtida.
    const result = await releaseRun(runId, tenantId, worker, claimed!.generation, true)
    expect(result).toBe('released')

    // Run should be back in QUEUED with nextAttemptAt in the future
    const run = await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, runId) })
    expect(run!.status).toBe('QUEUED')
    expect(run!.attempts).toBe(1) // [T37] attempts só incrementa no claim
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

    // Extend lease (fenced pela geração vigente)
    const extended = await heartbeatRun(runId, tenantId, worker, claimed!.generation)
    expect(extended).toBe(true)
  })

  test('releaseRun: falha após max recuperações sem progresso → FAILED WORKER_LOST', async () => {
    const worker = 'worker-max'
    // [T37] budget de recuperação usa recoveryAttempts (não o histórico attempts)
    const runId = await createRun({ recoveryAttempts: 2 })

    // Claim increda recoveryAttempts para 3
    const claimed = await claimNextRun(worker, tenantId)
    expect(claimed).not.toBeNull()

    const result = await releaseRun(runId, tenantId, worker, claimed!.generation, true)
    expect(result).toBe('failed')

    const run = await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, runId) })
    expect(run!.status).toBe('FAILED')
    expect(run!.errorCode).toBe('WORKER_LOST')
  })

  test('[T37] checkpoint confirmado reinicia o budget de recuperação', async () => {
    const worker = 'worker-checkpoint-reset'
    const runId = await createRun()
    const claimed = await claimNextRun(worker, tenantId)
    let run = await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, runId) })
    expect(run!.recoveryAttempts).toBe(1)

    // Persistir checkpoint (executionContextJson) reseta o contador.
    expect(await persistence.agent.updateRunFenced(runId, tenantId, worker, claimed!.generation, { executionContextJson: '{"step":1}' })).toBe(true)
    run = await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, runId) })
    expect(run!.recoveryAttempts).toBe(0)
  })

  test('[T37] heartbeat de geração obsoleta é rejeitado', async () => {
    const worker = 'worker-fence'
    const runId = await createRun()
    const claimed = await claimNextRun(worker, tenantId)
    expect(claimed!.generation).toBe(1)

    // Geração errada não renova o lease.
    expect(await heartbeatRun(runId, tenantId, worker, claimed!.generation + 1)).toBe(false)
    // Geração vigente renova.
    expect(await heartbeatRun(runId, tenantId, worker, claimed!.generation)).toBe(true)
  })

  test('[T37] release de proprietário substituído não repõe a run', async () => {
    const worker1 = 'worker-old'
    const worker2 = 'worker-new'
    const runId = await createRun()
    const first = await claimNextRun(worker1, tenantId)
    expect(first!.generation).toBe(1)

    // Simula lease vencido + run devolvida à fila (recuperação): worker2 assume nova geração.
    await db.update(assistantRuns).set({ status: 'QUEUED', claimExpiresAt: new Date(Date.now() - 120_000).toISOString() }).where(eq(assistantRuns.id, runId))
    const second = await claimNextRun(worker2, tenantId)
    expect(second!.runId).toBe(runId)
    expect(second!.generation).toBe(2)

    // Release/heartbeat da geração antiga são rejeitados sem alterar a run vigente.
    expect(await releaseRun(runId, tenantId, worker1, first!.generation, true)).toBe('lost')
    expect(await heartbeatRun(runId, tenantId, worker1, first!.generation)).toBe(false)

    const run = await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, runId) })
    expect(run!.status).toBe('RUNNING')
    expect(run!.claimedBy).toBe(worker2)
    expect(run!.leaseGeneration).toBe(2)
  })

  test('[T37] finishRunFenced exige geração vigente e cancelamento para CANCELLED', async () => {
    const worker = 'worker-finish'
    const runId = await createRun()
    const claimed = await claimNextRun(worker, tenantId)
    expect(claimed!.generation).toBe(1)

    // Geração obsoleta não finaliza.
    expect(await persistence.agent.finishRunFenced(runId, tenantId, worker, claimed!.generation + 1, { status: 'COMPLETED', finishedAt: new Date().toISOString() })).toBe(false)
    // CANCELLED sem cancelRequested é rejeitado.
    expect(await persistence.agent.finishRunFenced(runId, tenantId, worker, claimed!.generation, { status: 'CANCELLED', finishedAt: new Date().toISOString() }, { requireCancelRequested: true })).toBe(false)

    await requestCancel(runId, tenantId)
    // CANCELLED com cancelamento presente e geração vigente é aceito.
    expect(await persistence.agent.finishRunFenced(runId, tenantId, worker, claimed!.generation, { status: 'CANCELLED', finishedAt: new Date().toISOString() }, { requireCancelRequested: true })).toBe(true)

    const run = await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, runId) })
    expect(run!.status).toBe('CANCELLED')
    expect(run!.claimedBy).toBeNull()
  })

  test('[T37] updateRunFenced rejeita geração obsoleta e aceita a vigente', async () => {
    const worker = 'worker-checkpoint'
    const runId = await createRun()
    const claimed = await claimNextRun(worker, tenantId)

    // Geração obsoleta não escreve checkpoint.
    expect(await persistence.agent.updateRunFenced(runId, tenantId, worker, claimed!.generation + 1, { currentCursor: 5 })).toBe(false)
    // Geração vigente grava.
    expect(await persistence.agent.updateRunFenced(runId, tenantId, worker, claimed!.generation, { currentCursor: 5 })).toBe(true)

    const run = await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, runId) })
    expect(run!.currentCursor).toBe(5)
  })

  test('[T37] requestCancel é repetível e recusa run terminal', async () => {
    const queued = await createRun()
    expect(await requestCancel(queued, tenantId)).toBe(true)
    // Repetido: estado coerente, sem alterar a run.
    expect(await requestCancel(queued, tenantId)).toBe(true)
    const cancelled = await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, queued) })
    expect(cancelled!.status).toBe('CANCELLED')

    const completed = await createRun({ status: 'COMPLETED' })
    expect(await requestCancel(completed, tenantId)).toBe(false)
  })

  test('[T37] findMessageByRunId deduplica a mensagem terminal', async () => {
    const runId = await createRun()
    const scope = { tenantId, actorUserId: userId, actorKind: 'USER' as const }
    expect(await persistence.agent.findMessageByRunId(scope, runId)).toBeNull()
    await persistence.agent.createMessage(scope, {
      conversationId, userId, role: 'ASSISTANT', content: 'pronto',
      metadataJson: JSON.stringify({ runId }), createdAt: new Date().toISOString(),
    })
    const found = await persistence.agent.findMessageByRunId(scope, runId)
    expect(found?.content).toBe('pronto')
  })

  test('[T37] countQueuedRuns reflete a profundidade real da fila', async () => {
    const now = new Date().toISOString()
    await createRun()
    await createRun()
    expect(await persistence.agent.countQueuedRuns(tenantId, now)).toBe(2)
    await claimNextRun('worker-depth', tenantId)
    expect(await persistence.agent.countQueuedRuns(tenantId, now)).toBe(1)
  })

  test('[T37] hasRunEvent permite dedup do evento terminal', async () => {
    const runId = await createRun()
    const scope = { tenantId, actorUserId: null, actorKind: 'SYSTEM' as const }
    expect(await persistence.agent.hasRunEvent(tenantId, runId, 'RUN_COMPLETED')).toBe(false)
    await persistence.agent.insertEvent(scope, runId, 'RUN_COMPLETED', '{}', new Date().toISOString())
    expect(await persistence.agent.hasRunEvent(tenantId, runId, 'RUN_COMPLETED')).toBe(true)
    expect(await persistence.agent.hasRunEvent(tenantId, runId, 'RUN_FAILED')).toBe(false)
  })

  test('[T37] stop drena execução ativa antes do prazo', async () => {
    const runId = await createRun()
    let aborted = false
    let finished = false
    const worker = new AgentWorker({ tenantId, executeRun: async (_id, _t, _w, ctx) => {
      ctx.signal.addEventListener('abort', () => { aborted = true })
      await new Promise(resolve => setTimeout(resolve, 40))
      finished = true
      await db.update(assistantRuns).set({ status: 'COMPLETED' }).where(eq(assistantRuns.id, runId))
    } })
    worker.start()
    for (let i = 0; i < 100; i++) {
      const run = await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, runId) })
      if (run?.startedAt) break
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    await worker.stop(2_000)
    expect(finished).toBe(true)
    expect(aborted).toBe(false)
  })

  test('[T37] stop aborta execução que excede o prazo', async () => {
    const runId = await createRun()
    let aborted = false
    const worker = new AgentWorker({ tenantId, executeRun: async (_id, _t, _w, ctx) => {
      await new Promise<void>((resolve) => {
        ctx.signal.addEventListener('abort', () => { aborted = true; resolve() })
      })
    } })
    worker.start()
    for (let i = 0; i < 100; i++) {
      const run = await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, runId) })
      if (run?.startedAt) break
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    await worker.stop(20)
    expect(aborted).toBe(true)
  })

  test('[T37] oldestQueuedAt reflete a idade da fila', async () => {
    const now = new Date().toISOString()
    expect(await persistence.agent.oldestQueuedAt(tenantId, now)).toBeNull()
    await createRun()
    const oldest = await persistence.agent.oldestQueuedAt(tenantId, new Date().toISOString())
    expect(oldest).not.toBeNull()
    expect(oldest! <= new Date().toISOString()).toBe(true)
  })

  test('[T37] sinal abortado impede início da execução (LEASE_LOST)', async () => {
    const { executeAssistantRun } = await import('./assistantRunExecutor')
    const runId = await createRun()
    const controller = new AbortController()
    controller.abort()
    await expect(
      executeAssistantRun(runId, tenantId, 'worker-abort', { generation: 1, signal: controller.signal }),
    ).rejects.toThrow('LEASE_LOST')
  })
})

// Card T16 — autenticação efetiva das tools do worker: a sessão sintética do run
// assina JWT e o authMiddleware autentica (antes de 2026-10-03 o header livre
// X-Worker-Context nunca era aceito e as tools caíam em 401 na fila).
describe('tool API do worker autentica com sessão sintética', () => {
  test('chamada interna lista projetos do tenant do usuário do run', async () => {
    const { createWorkerToolApi, loadRunContext } = await import('./workerContext')
    // Sessão requer registrar o run no banco para idempotência real do worker…
    const runId = id()
    const now = new Date().toISOString()
    await db.insert(assistantRuns).values({
      id: runId, tenantId, conversationId, userId, model: 'test',
      status: 'QUEUED', attempts: 0, nextAttemptAt: now, claimedBy: null, claimExpiresAt: null, cancelRequested: false,
      createdAt: now,
    })
    const loaded = await loadRunContext(runId, tenantId)
    expect(loaded).toBeTruthy()

    const api = await createWorkerToolApi(tenantId, userId)
    const result = await api('/projects') as Array<Record<string, unknown>>
    expect(Array.isArray(result)).toBe(true)
  })
})
