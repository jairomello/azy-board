// Agent job queue: persistent queue for Azy Agent runs.
// Uses the assistant_runs table with lease/claim columns for atomic claiming.
// Pattern follows storageCleanup: enqueue → claim → execute → release/retry.

import { randomUUID } from 'node:crypto'
import { persistence } from '../persistence/runtime'
import { logger } from './logger'
import { isOtelInitialized, getOtelMeter } from './telemetry'

// Métricas OTel para a fila do agente
let queueDepthGauge: import('@opentelemetry/api').Gauge | null = null
let claimLatencyHistogram: import('@opentelemetry/api').Histogram | null = null
let leaseExpirationCounter: import('@opentelemetry/api').Counter | null = null

async function initQueueMetrics() {
  if (queueDepthGauge || !isOtelInitialized()) return
  const meter = await getOtelMeter('azyboard-agent-queue')
  if (!meter) return

  queueDepthGauge = meter.createGauge('agent.queue.depth', {
    description: 'Number of runs in QUEUED state waiting for a worker',
  })
  claimLatencyHistogram = meter.createHistogram('agent.queue.claim_latency_ms', {
    description: 'Time from run creation to claim by a worker',
    unit: 'ms',
  })
  leaseExpirationCounter = meter.createCounter('agent.worker.lease_expirations', {
    description: 'Number of lease expirations (worker died or stalled)',
  })
}

// Retry budget: exponential backoff, max attempts before FAILED WORKER_LOST
const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 5_000
const MAX_BACKOFF_MS = 5 * 60_000

function backoffFor(attempt: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1), MAX_BACKOFF_MS)
}

// Lease duration: how long a worker holds a run before it can be reclaimed
const LEASE_MS = 60_000

// Heartbeat interval: how often the worker extends its lease during execution
export const HEARTBEAT_INTERVAL_MS = 15_000

export interface ClaimedRun {
  runId: string
  tenantId: string
  workerId: string
  leaseExpiresAt: string
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

  // List due runs (QUEUED, no active claim, nextAttemptAt passed)
  const dueRuns = await persistence.agent.listDueRuns(tenantId ?? null, nowIso, 1)
  if (dueRuns.length === 0) {
    queueDepthGauge?.record(0)
    return null
  }

  const run = dueRuns[0]!
  const claimed = await persistence.agent.claimRun(run.id, run.tenantId, workerId, leaseExpiresAt, nowIso)

  if (!claimed) return null // Another worker got it

  // Record claim latency (time from creation to claim)
  const claimLatency = now - new Date(run.createdAt).getTime()
  claimLatencyHistogram?.record(claimLatency)

  logger.info('agent-queue: run claimed', { runId: run.id, workerId, tenantId: run.tenantId, attempts: run.attempts + 1 })
  return { runId: run.id, tenantId: run.tenantId, workerId, leaseExpiresAt }
}

/**
 * Extends the lease for a run being actively executed.
 */
export async function heartbeatRun(runId: string, tenantId: string, workerId: string): Promise<boolean> {
  const leaseExpiresAt = new Date(Date.now() + LEASE_MS).toISOString()
  return persistence.agent.heartbeatRun(runId, tenantId, workerId, leaseExpiresAt)
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
  retryWithBackoff: boolean,
): Promise<'released' | 'failed'> {
  // Query the run directly to check attempts
  const { db } = await import('../db/index')
  const { assistantRuns } = await import('../db/schema')
  const { eq } = await import('drizzle-orm')
  const run = await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, runId) })
  if (!run) {
    // Run not found, try to release it anyway
    await persistence.agent.releaseRun(runId, tenantId, workerId, null, false)
    return 'released'
  }

  if (retryWithBackoff && run.attempts + 1 >= MAX_ATTEMPTS) {
    // Exhausted retries → FAILED
    await persistence.agent.updateRun(runId, tenantId, {
      status: 'FAILED',
      errorCode: 'WORKER_LOST',
      finishedAt: new Date().toISOString(),
      claimedBy: null,
      claimExpiresAt: null,
    })
    logger.error('agent-queue: run failed after max attempts', { runId, tenantId, attempts: run.attempts + 1 })
    return 'failed'
  }

  const nextAttemptAt = retryWithBackoff
    ? new Date(Date.now() + backoffFor(run.attempts + 1)).toISOString()
    : null

  await persistence.agent.releaseRun(runId, tenantId, workerId, nextAttemptAt, retryWithBackoff)
  logger.info('agent-queue: run released', { runId, tenantId, workerId, retryWithBackoff, nextAttemptAt })
  return 'released'
}

/**
 * Checks if a run has been requested to cancel.
 */
export async function isCancelRequested(runId: string, tenantId: string): Promise<boolean> {
  // Query the run directly to check cancelRequested flag
  const { db } = await import('../db/index')
  const { assistantRuns } = await import('../db/schema')
  const { eq } = await import('drizzle-orm')
  const run = await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, runId) })
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
  const { db } = await import('../db/index')
  const { assistantRuns } = await import('../db/schema')
  const { eq } = await import('drizzle-orm')
  const run = await db.query.assistantRuns.findFirst({ where: eq(assistantRuns.id, runId) })
  if (run && run.status === 'QUEUED') {
    await persistence.agent.updateRunInStatuses(runId, tenantId, run.userId, ['QUEUED'], {
      status: 'CANCELLED',
      finishedAt: now,
    })
    logger.info('agent-queue: queued run cancelled immediately', { runId, tenantId })
  }

  return requested
}
