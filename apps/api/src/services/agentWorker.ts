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
  LEASE_MS,
} from './agentJobQueue'
import { isOtelInitialized, getOtelMeter } from './telemetry'

// Métricas OTel para o worker
let activeRunsGauge: import('@opentelemetry/api').Gauge | null = null
let leaseExpirationCounter: import('@opentelemetry/api').Counter | null = null
let abortCounter: import('@opentelemetry/api').Counter | null = null
let fenceRejectedCounter: import('@opentelemetry/api').Counter | null = null

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
  // [T37] Abortos cooperativos (expiry/perda de posse) e fences rejeitados.
  abortCounter = meter.createCounter('agent.worker.aborts', {
    description: 'Cooperative aborts due to lease loss/expiry',
  })
  fenceRejectedCounter = meter.createCounter('agent.worker.fence_rejected', {
    description: 'Rejected fenced writes/finalizations from obsolete generations',
  })
}

// Polling interval: how often the worker checks for new runs
const POLL_INTERVAL_MS = 5_000

// [T37] Contexto interno de posse entregue ao executor da run.
export interface RunExecutionContext {
  generation: number
  signal: AbortSignal
}

// Execute function: runs the harness for a claimed run sob fence/abort.
export type ExecuteRunFn = (runId: string, tenantId: string, workerId: string, context: RunExecutionContext) => Promise<void>

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
  private leaseTimer: ReturnType<typeof setTimeout> | null = null
  private activeRun: { runId: string; tenantId: string; generation: number; controller: AbortController } | null = null
  private activeExecution: Promise<void> | null = null
  private polling = false
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

  /**
   * Stops the worker gracefully: para de buscar runs, drena a execução corrente
   * até o prazo e, se ainda ativa, aborta dentro do prazo. Nunca faz release de
   * posse alheia — o abort faz o caminho fenced de release no poll.
   */
  async stop(graceMs = 5_000): Promise<void> {
    this.stopped = true
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    // [T37] Drain: aguarda a execução corrente encerrar sozinha até o prazo.
    if (this.activeExecution) {
      const drained = await Promise.race([
        this.activeExecution.then(() => true).catch(() => true),
        new Promise<boolean>(resolve => {
          const timer = setTimeout(() => resolve(false), graceMs)
          timer.unref?.()
        }),
      ])
      if (!drained) {
        logger.warn('agent-worker: shutdown com execução ativa, abortando', { workerId: this.workerId, graceMs })
        abortCounter?.add(1)
        this.activeRun?.controller.abort()
        await this.activeExecution.catch(() => {})
      }
    }
    this.clearLeaseTimer()
    logger.info('agent-worker: stopped', { workerId: this.workerId })
  }

  private clearLeaseTimer(): void {
    if (this.leaseTimer) {
      clearTimeout(this.leaseTimer)
      this.leaseTimer = null
    }
  }

  /** [T37] Agenda abort local caso o lease atinja o expiry sem heartbeat. */
  private armLeaseTimer(runId: string, generation: number): void {
    this.clearLeaseTimer()
    this.leaseTimer = setTimeout(() => {
      if (this.activeRun?.runId === runId && this.activeRun.generation === generation) {
        logger.warn('agent-worker: lease expiry local, abortando execução', { runId, workerId: this.workerId, generation })
        leaseExpirationCounter?.add(1)
        abortCounter?.add(1)
        this.activeRun.controller.abort()
      }
    }, LEASE_MS)
    this.leaseTimer.unref?.()
  }

  /** Polls for a new run and executes it (single-flight). */
  private async poll(): Promise<void> {
    if (this.stopped || this.activeRun || this.polling) return
    this.polling = true
    await initWorkerMetrics()

    try {
      const claimed = await claimNextRun(this.workerId, this.tenantId)
      if (!claimed) return

      const controller = new AbortController()
      this.activeRun = { runId: claimed.runId, tenantId: claimed.tenantId, generation: claimed.generation, controller }
      this.armLeaseTimer(claimed.runId, claimed.generation)

      const execution = this.executeRun(claimed.runId, claimed.tenantId, this.workerId, { generation: claimed.generation, signal: controller.signal })
      this.activeExecution = execution
      try {
        await execution
        // Execute completed successfully (run is already in terminal state via harness)
        logger.info('agent-worker: run completed', { runId: claimed.runId, workerId: this.workerId, generation: claimed.generation })
      } catch (error) {
        // Execution failed: check if it's a cancellation or a real error
        const cancelled = await isCancelRequested(claimed.runId, claimed.tenantId)
        if (cancelled) {
          // [T37] CANCELLED exige cancelamento presente + posse vigente (CAS).
          const finished = await persistence.agent.finishRunFenced(
            claimed.runId, claimed.tenantId, this.workerId, claimed.generation,
            { status: 'CANCELLED', finishedAt: new Date().toISOString() },
            { requireCancelRequested: true },
          )
          if (!finished) fenceRejectedCounter?.add(1)
          logger.info('agent-worker: run cancelled', { runId: claimed.runId, workerId: this.workerId, generation: claimed.generation, finished })
        } else {
          // Release with retry backoff (fenced por geração).
          const result = await releaseRun(claimed.runId, claimed.tenantId, this.workerId, claimed.generation, true)
          if (result === 'lost') fenceRejectedCounter?.add(1)
          logger.warn('agent-worker: run execution failed', {
            runId: claimed.runId,
            workerId: this.workerId,
            generation: claimed.generation,
            error: error instanceof Error ? error.message : String(error),
            result,
          })
        }
      } finally {
        // [T37] Cleanup só da própria aquisição; não remove posse de geração nova.
        if (this.activeExecution === execution) this.activeExecution = null
        if (this.activeRun?.runId === claimed.runId && this.activeRun.generation === claimed.generation) {
          this.clearLeaseTimer()
          this.activeRun = null
        }
      }
    } catch (error) {
      logger.error('agent-worker: poll error', {
        workerId: this.workerId,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      this.polling = false
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

    const { runId, tenantId, generation } = this.activeRun
    try {
      const extended = await heartbeatRun(runId, tenantId, this.workerId, generation)
      if (extended) {
        this.armLeaseTimer(runId, generation)
        return
      }
      // [T37] Perda de posse: aborta a execução; o fence por geração impede efeitos.
      leaseExpirationCounter?.add(1)
      abortCounter?.add(1)
      logger.warn('agent-worker: heartbeat failed, lease lost', { runId, workerId: this.workerId, generation })
    } catch (error) {
      // [T37] Heartbeat inconclusivo: bloqueia novos efeitos e aborta até prova de posse.
      logger.error('agent-worker: heartbeat error, abortando execução', {
        workerId: this.workerId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    if (this.activeRun?.runId === runId && this.activeRun.generation === generation) {
      this.clearLeaseTimer()
      this.activeRun.controller.abort()
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
}): () => Promise<void> {
  const worker = new AgentWorker(options)
  worker.start()
  return () => worker.stop()
}
