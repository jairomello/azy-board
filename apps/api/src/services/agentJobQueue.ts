// Agent job queue: persistent queue for Azy Agent runs.
// Uses the assistant_runs table with lease/claim columns for atomic claiming.
// Pattern follows storageCleanup: enqueue → claim → execute → release/retry.

import { persistence } from '../persistence/runtime'
import { logger } from './logger'
import { isOtelInitialized, getOtelMeter } from './telemetry'

// Métricas OTel para a fila do agente
let queueDepthGauge: import('@opentelemetry/api').Gauge | null = null
let queueAgeGauge: import('@opentelemetry/api').Gauge | null = null
let claimLatencyHistogram: import('@opentelemetry/api').Histogram | null = null
let claimCounter: import('@opentelemetry/api').Counter | null = null
let claimAttemptsHistogram: import('@opentelemetry/api').Histogram | null = null
let _leaseExpirationCounter: import('@opentelemetry/api').Counter | null = null
let uncertainResultCounter: import('@opentelemetry/api').Counter | null = null

async function initQueueMetrics() {
  if (queueDepthGauge || !isOtelInitialized()) return
  const meter = await getOtelMeter('azyboard-agent-queue')
  if (!meter) return

  queueDepthGauge = meter.createGauge('agent.queue.depth', {
    description: 'Number of runs in QUEUED state waiting for a worker',
  })
  queueAgeGauge = meter.createGauge('agent.queue.age_seconds', {
    description: 'Age in seconds of the oldest eligible run in the queue',
    unit: 's',
  })
  claimLatencyHistogram = meter.createHistogram('agent.queue.claim_latency_ms', {
    description: 'Time from run creation to claim by a worker',
    unit: 'ms',
  })
  claimCounter = meter.createCounter('agent.queue.claims', {
    description: 'Number of runs claimed by a worker',
  })
  claimAttemptsHistogram = meter.createHistogram('agent.queue.claim_attempts', {
    description: 'Historical attempts count at the moment of claim',
  })
  _leaseExpirationCounter = meter.createCounter('agent.worker.lease_expirations', {
    description: 'Number of lease expirations (worker died or stalled)',
  })
  // [T37] Efeitos externos potencialmente incertos (tool em RUNNING ao perder posse).
  uncertainResultCounter = meter.createCounter('agent.worker.uncertain_results', {
    description: 'Runs abandoned with an in-flight tool call (uncertain external effect)',
  })
}

// [T37] Budget de recuperação: no máximo 3 aquisições do mesmo checkpoint sem
// progresso confirmado (checkpoint persistido reinicia o contador); separado do
// contador histórico `attempts`. Backoff exponencial 5s → 5min.
const MAX_RECOVERY_ATTEMPTS = 3
const BASE_BACKOFF_MS = 5_000
const MAX_BACKOFF_MS = 5 * 60_000

function backoffFor(attempt: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1), MAX_BACKOFF_MS)
}

// Lease duration: how long a worker holds a run before it can be reclaimed
export const LEASE_MS = 60_000

// Heartbeat interval: how often the worker extends its lease during execution
export const HEARTBEAT_INTERVAL_MS = 15_000

export interface ClaimedRun {
  runId: string
  tenantId: string
  workerId: string
  leaseExpiresAt: string
  /** [T37] Geração de lease obtida no claim; exigida em heartbeat/release. */
  generation: number
}

/**
 * Claims the next available run from the queue.
 * Uses atomic UPDATE CAS to ensure only one worker gets each run.
 */
export async function claimNextRun(workerId: string, tenantId?: string): Promise<ClaimedRun | null> {
  await initQueueMetrics()

  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const leaseExpiresAt = new Date(now + LEASE_MS).toISOString()

  // [T37] Profundidade e idade reais por agregação (não inferidas do polling).
  const depth = await persistence.agent.countQueuedRuns(tenantId ?? null, nowIso)
  queueDepthGauge?.record(depth)
  if (depth === 0) return null
  const oldest = await persistence.agent.oldestQueuedAt(tenantId ?? null, nowIso)
  if (oldest) queueAgeGauge?.record(Math.max(0, (now - new Date(oldest).getTime()) / 1000))

  // List due runs (QUEUED, no active claim, nextAttemptAt passed)
  const dueRuns = await persistence.agent.listDueRuns(tenantId ?? null, nowIso, 1)
  if (dueRuns.length === 0) return null

  const run = dueRuns[0]!
  const generation = await persistence.agent.claimRun(run.id, run.tenantId, workerId, leaseExpiresAt, nowIso)

  if (generation === null) return null // Another worker got it

  // Record claim latency (time from creation to claim)
  const claimLatency = now - new Date(run.createdAt).getTime()
  claimLatencyHistogram?.record(claimLatency)
  // [T37] Tentativas e volume de claims observáveis por run.
  claimCounter?.add(1)
  claimAttemptsHistogram?.record(run.attempts + 1)

  logger.info('agent-queue: run claimed', { runId: run.id, workerId, tenantId: run.tenantId, generation, attempts: run.attempts + 1 })
  return { runId: run.id, tenantId: run.tenantId, workerId, leaseExpiresAt, generation }
}

/**
 * Extends the lease for a run being actively executed.
 * [T37] Só renova se proprietário E geração vigente conferem e o lease não venceu.
 */
export async function heartbeatRun(runId: string, tenantId: string, workerId: string, generation: number): Promise<boolean> {
  const leaseExpiresAt = new Date(Date.now() + LEASE_MS).toISOString()
  return persistence.agent.heartbeatRun(runId, tenantId, workerId, generation, leaseExpiresAt)
}

/**
 * Releases a run back to the queue with optional retry backoff.
 * If retryWithBackoff is true, increments attempts and sets nextAttemptAt.
 * If attempts exceeded MAX_ATTEMPTS, marks as FAILED with WORKER_LOST.
 */
export async function releaseRun(
  runId: string,
  tenantId: string,
  workerId: string,
  generation: number,
  retryWithBackoff: boolean,
): Promise<'released' | 'failed' | 'lost'> {
  await initQueueMetrics()
  // [TENANT] A run é consultada por tenant + ID via port, sem importar o driver.
  const run = await persistence.agent.getRun({ tenantId, actorUserId: null, actorKind: 'SYSTEM' }, runId)
  if (!run) {
    // Run not found: ainda assim tenta release fenced (no-op se geração/pertencimento divergem).
    await persistence.agent.releaseRun(runId, tenantId, workerId, generation, null, false)
    return 'released'
  }

  // [T37] attempts só incrementa no claim; o budget usa a recuperação desde o
  // último checkpoint confirmado (não o total histórico de aquisições).
  if (retryWithBackoff && run.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
    // Exhausted retries → FAILED, finalização CAS por proprietário+geração.
    const finished = await persistence.agent.finishRunFenced(
      runId, tenantId, workerId, generation,
      { status: 'FAILED', errorCode: 'WORKER_LOST', finishedAt: new Date().toISOString() },
      { requireCancelRequested: false },
    )
    if (!finished) {
      logger.warn('agent-queue: finalização WORKER_LOST rejeitada, posse perdida', { runId, tenantId, workerId, generation })
      return 'lost'
    }
    logger.error('agent-queue: run failed after max recovery attempts', { runId, tenantId, generation, attempts: run.attempts, recoveryAttempts: run.recoveryAttempts })
    return 'failed'
  }

  const nextAttemptAt = retryWithBackoff
    ? new Date(Date.now() + backoffFor(run.recoveryAttempts)).toISOString()
    : null

  const released = await persistence.agent.releaseRun(runId, tenantId, workerId, generation, nextAttemptAt, false)
  if (!released) {
    // Perdemos a posse (nova geração assumiu) — não repõe em fila nem incrementa attempts.
    // Se havia tool em RUNNING, o efeito externo pode ser incerto (nunca retry cego).
    const systemScope = { tenantId, actorUserId: null, actorKind: 'SYSTEM' as const }
    const inFlight = (await persistence.agent.listToolCalls(systemScope, runId)).some(call => call.status === 'RUNNING')
    if (inFlight) uncertainResultCounter?.add(1)
    logger.warn('agent-queue: release rejected, lease ownership lost', { runId, tenantId, workerId, generation, uncertain: inFlight })
    return 'lost'
  }
  logger.info('agent-queue: run released', { runId, tenantId, workerId, generation, retryWithBackoff, nextAttemptAt })
  return 'released'
}

/**
 * Checks if a run has been requested to cancel.
 */
export async function isCancelRequested(runId: string, tenantId: string): Promise<boolean> {
  // [TENANT] O worker sempre consulta a run pelo par tenant + ID.
  const run = await persistence.agent.getRun({ tenantId, actorUserId: null, actorKind: 'SYSTEM' }, runId)
  return run?.cancelRequested ?? false
}

/**
 * Requests cancellation of a run (cross-process).
 * If the run is QUEUED, immediately marks it as CANCELLED.
 */
export async function requestCancel(runId: string, tenantId: string): Promise<boolean> {
  const now = new Date().toISOString()
  const requested = await persistence.agent.requestCancel(runId, tenantId, now)

  // If run is QUEUED (not yet claimed), immediately cancel it
  // [TENANT] Never resolve a run by its ID without the tenant scope.
  const run = await persistence.agent.getRun({ tenantId, actorUserId: null, actorKind: 'SYSTEM' }, runId)
  if (run && run.status === 'QUEUED') {
    await persistence.agent.updateRunInStatuses(runId, tenantId, run.userId, ['QUEUED'], {
      status: 'CANCELLED',
      finishedAt: now,
    })
    logger.info('agent-queue: queued run cancelled immediately', { runId, tenantId })
  }

  return requested
}
