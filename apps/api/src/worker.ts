// [T37] Entrada dedicada do worker de runs do agente (perfil ADVANCED / SEPARATE).
// Compõe o runtime (T36) SEM listener HTTP e SEM chamar startServer(): a API
// apenas enfileira/consulta/aprova/cancela; este processo é o consumidor da fila.

import { bootstrapRuntime } from './persistence/runtime'
import { resolveObservabilityConfig } from './config/observability'
import { configureLogger, logger } from './services/logger'
import { initOpenTelemetry } from './services/telemetry'
import { createErrorTracker, type ErrorTracker } from './services/errorTracker'
import { resolveAgentWorkerMode } from './config/workerMode'
import { startAgentWorker } from './services/agentWorker'
import { executeAssistantRun } from './services/assistantRunExecutor'

const obsConfig = resolveObservabilityConfig()
configureLogger(obsConfig)

export let errorTracker: ErrorTracker = createErrorTracker(obsConfig)
let stopWorker: (() => Promise<void>) | null = null
let runtime: Awaited<ReturnType<typeof bootstrapRuntime>> | null = null

/** Inicia o processo de worker: observabilidade, runtime (T36) e consumo da fila. */
export async function startAgentWorkerProcess(): Promise<void> {
  await initOpenTelemetry(obsConfig)
  errorTracker = createErrorTracker(obsConfig)
  await errorTracker.init()

  runtime = await bootstrapRuntime()
  const mode = resolveAgentWorkerMode(runtime.config.profile)
  if (mode !== 'SEPARATE') {
    throw new Error(`worker dedicado exige modo SEPARATE (atual: ${mode}).`)
  }

  stopWorker = startAgentWorker({ executeRun: executeAssistantRun })
  logger.info('agent-worker-process: iniciado', { profile: runtime.config.profile, pid: process.pid })
}

if (import.meta.main) {
  // Shutdown gracioso: para claims/aborta a execução (T37) e fecha só os
  // recursos deste processo, sem afetar a API nem outro worker.
  const shutdown = () => {
    void Promise.resolve()
      .then(() => stopWorker?.())
      .catch(error => logger.error('agent-worker-process: erro no shutdown', { error: error instanceof Error ? error.message : String(error) }))
      .finally(async () => { await runtime?.close(); process.exit(0) })
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  startAgentWorkerProcess().catch(error => {
    logger.error('agent-worker-process: falha ao iniciar', { error: error instanceof Error ? error.message : String(error) })
    process.exit(1)
  })
}
