// Agent worker: polls the job queue, claims runs, executes them via AssistantHarness,
// and manages heartbeat/lease. Runs in-process for SIMPLE profile or as a separate
// process for ADVANCED.

import { randomUUID } from 'node:crypto'
import { persistence } from '../persistence/runtime'
import { logger } from './logger'
import {
  claimNextRun,
  heartbeatRun,
  releaseRun,
  isCancelRequested,
  HEARTBEAT_INTERVAL_MS,
} from './agentJobQueue'
import { isOtelInitialized, getOtelMeter } from './telemetry'

// Métricas OTel para o worker
let activeRunsGauge: import('@opentelemetry/api').Gauge | null = null
let leaseExpirationCounter: import('@opentelemetry/api').Counter | null = null

async function initWorkerMetrics() {
  if (activeRunsGauge || !isOtelInitialized()) return
  const meter = await getOtelMeter('azyboard-agent-worker')
  if (!meter) return

  activeRunsGauge = meter.createGauge('agent.worker.active_runs', {
    description: 'Number of runs currently being executed by this worker',
  })
  leaseExpirationCounter = meter.createCounter('agent.worker.lease_expirations', {
    description: 'Number of lease expirations detected by this worker',
  })
}

// Polling interval: how often the worker checks for new runs
const POLL_INTERVAL_MS = 5_000

// Execute function: runs the harness for a claimed run
export type ExecuteRunFn = (runId: string, tenantId: string, workerId: string) => Promise<void>

/**
 * AgentWorker: polls the queue and executes runs.
 * Pattern follows storageCleanup's startStorageCleanupWorker.
 */
export class AgentWorker {
  private workerId: string
  private tenantId: string | undefined
  private executeRun: ExecuteRunFn
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private activeRun: { runId: string; tenantId: string } | null = null
  private stopped = false

  constructor(options: {
    workerId?: string
    tenantId?: string
    executeRun: ExecuteRunFn
  }) {
    this.workerId = options.workerId ?? `worker-${randomUUID().slice(0, 8)}`
    this.tenantId = options.tenantId
    this.executeRun = options.executeRun
  }

  /** Starts the worker polling loop. */
  start(): void {
    if (this.pollTimer) return
    this.stopped = false

    // Initial poll
    void this.poll()

    // Poll for new runs
    this.pollTimer = setInterval(() => void this.poll(), POLL_INTERVAL_MS)
    this.pollTimer.unref?.()

    // Heartbeat for active run
    this.heartbeatTimer = setInterval(() => void this.heartbeat(), HEARTBEAT_INTERVAL_MS)
    this.heartbeatTimer.unref?.()

    logger.info('agent-worker: started', { workerId: this.workerId, tenantId: this.tenantId })
  }

  /** Stops the worker gracefully. */
  stop(): void {
    this.stopped = true
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    logger.info('agent-worker: stopped', { workerId: this.workerId })
  }

  /** Polls for a new run and executes it. */
  private async poll(): Promise<void> {
    if (this.stopped || this.activeRun) return

    try {
      const claimed = await claimNextRun(this.workerId, this.tenantId)
      if (!claimed) return

      this.activeRun = { runId: claimed.runId, tenantId: claimed.tenantId }

      try {
        await this.executeRun(claimed.runId, claimed.tenantId, this.workerId)
        // Execute completed successfully (run is already in terminal state via harness)
        logger.info('agent-worker: run completed', { runId: claimed.runId, workerId: this.workerId })
      } catch (error) {
        // Execution failed: check if it's a cancellation or a real error
        const cancelled = await isCancelRequested(claimed.runId, claimed.tenantId)
        if (cancelled) {
          await persistence.agent.updateRun(claimed.runId, claimed.tenantId, {
            status: 'CANCELLED',
            finishedAt: new Date().toISOString(),
            claimedBy: null,
            claimExpiresAt: null,
          })
          logger.info('agent-worker: run cancelled', { runId: claimed.runId, workerId: this.workerId })
        } else {
          // Release with retry backoff
          const result = await releaseRun(claimed.runId, claimed.tenantId, this.workerId, true)
          logger.warn('agent-worker: run execution failed', {
            runId: claimed.runId,
            workerId: this.workerId,
            error: error instanceof Error ? error.message : String(error),
            result,
          })
        }
      } finally {
        this.activeRun = null
      }
    } catch (error) {
      logger.error('agent-worker: poll error', {
        workerId: this.workerId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /** Extends the lease for the active run. */
  private async heartbeat(): Promise<void> {
    await initWorkerMetrics()

    if (!this.activeRun) {
      activeRunsGauge?.record(0)
      return
    }

    activeRunsGauge?.record(1)

    try {
      const { runId, tenantId } = this.activeRun
      const extended = await heartbeatRun(runId, tenantId, this.workerId)
      if (!extended) {
        // Lost the lease (shouldn't happen normally)
        leaseExpirationCounter?.add(1)
        logger.warn('agent-worker: heartbeat failed, lease lost', { runId, workerId: this.workerId })
        this.activeRun = null
      }
    } catch (error) {
      logger.error('agent-worker: heartbeat error', {
        workerId: this.workerId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

/**
 * Starts an in-process agent worker (SIMPLE profile).
 * Returns a stop function.
 */
export function startAgentWorker(options: {
  tenantId?: string
  executeRun: ExecuteRunFn
}): () => void {
  const worker = new AgentWorker(options)
  worker.start()
  return () => worker.stop()
}
