import { storage, type StorageAdapter } from './storage'
import { persistence } from '../persistence/runtime'
import { logger } from './logger'
import { isOtelInitialized, getOtelMeter } from './telemetry'

// [DB-SWAP] Em PostgreSQL os mesmos inserts/updates valem; trocar apenas o driver.

// Métricas OTel para a fila de storage cleanup
let pendingGauge: import('@opentelemetry/api').Gauge | null = null
let oldestAgeGauge: import('@opentelemetry/api').Gauge | null = null
let processedCounter: import('@opentelemetry/api').Counter | null = null
let failedCounter: import('@opentelemetry/api').Counter | null = null

async function initMetrics() {
  if (pendingGauge || !isOtelInitialized()) return
  const meter = await getOtelMeter('azyboard-storage-cleanup')
  if (!meter) return

  pendingGauge = meter.createGauge('storage.cleanup.pending', {
    description: 'Itens pendentes na fila de limpeza de storage',
  })
  oldestAgeGauge = meter.createGauge('storage.cleanup.oldest_age_ms', {
    description: 'Idade do item mais antigo na fila em milissegundos',
  })
  processedCounter = meter.createCounter('storage.cleanup.processed', {
    description: 'Itens processados com sucesso',
  })
  failedCounter = meter.createCounter('storage.cleanup.failed', {
    description: 'Itens que falharam após esgotar tentativas',
  })
}

// Orçamento de tentativas: após esgotar, o job fica FAILED e só a auditoria/
// reintegração manual resolve. Backoff exponencial limitado a ~30 min.
const MAX_ATTEMPTS = 8
const BASE_BACKOFF_MS = 30_000
const MAX_BACKOFF_MS = 30 * 60_000

function backoffFor(attempt: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1), MAX_BACKOFF_MS)
}

// Enfileira caminhos para limpeza pós-commit. Deve ser chamado DENTRO da
// transação que remove os metadados, garantindo atomicidade (outbox).
// Idempotente: o índice parcial UNIQUE (tenant_id, storage_path) WHERE
// status='PENDING' deduplica enfileiramentos repetidos.
export async function enqueueStorageCleanup(
  tenantId: string,
  entries: Array<{ storagePath: string; resourceType?: 'ATTACHMENT' }>,
): Promise<number> {
  return persistence.storageCleanup.enqueue(tenantId, entries)
}

export interface CleanupProcessResult {
  processed: number
  done: number
  retried: number
  failed: number
}

// Processa jobs pendentes cujo backoff já venceu. Arquivo inexistente é
// sucesso (o adapter local engole ENOENT); falha real agenda retry com
// backoff e, ao esgotar tentativas, marca FAILED sem interromper a fila.
export async function processPendingStorageCleanup(options: {
  limit?: number
  adapter?: StorageAdapter
  now?: Date
} = {}): Promise<CleanupProcessResult> {
  await initMetrics()

  const limit = options.limit ?? 50
  const adapter = options.adapter ?? storage
  const now = options.now ?? new Date()
  const nowIso = now.toISOString()

  const due = await persistence.storageCleanup.listDue(nowIso, limit)

  // Registrar métricas da fila
  if (pendingGauge) {
    pendingGauge.record(due.length)
  }
  if (oldestAgeGauge && due.length > 0) {
    const oldestCreatedAt = due[0]?.createdAt
    if (oldestCreatedAt) {
      oldestAgeGauge.record(now.getTime() - new Date(oldestCreatedAt).getTime())
    }
  }

  const result: CleanupProcessResult = { processed: due.length, done: 0, retried: 0, failed: 0 }
  for (const job of due) {
    try {
      await adapter.delete(job.storagePath)
      await persistence.storageCleanup.markDone(job.id, job.tenantId, new Date().toISOString())
      result.done += 1
      processedCounter?.add(1)
    } catch (error) {
      const attempts = job.attempts + 1
      const message = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500)
      const exhausted = attempts >= MAX_ATTEMPTS
      const nextAttemptAt = new Date(now.getTime() + backoffFor(attempts)).toISOString()
      const updatedAt = new Date().toISOString()
      if (exhausted) {
        await persistence.storageCleanup.markFailed(job.id, job.tenantId, attempts, message, updatedAt)
        result.failed += 1
        failedCounter?.add(1)
        logger.error('storage-cleanup job marcado como FAILED', { jobId: job.id, attempts, error: message })
      } else {
        await persistence.storageCleanup.markRetry(job.id, job.tenantId, attempts, message, nextAttemptAt, updatedAt)
        result.retried += 1
        logger.warn('storage-cleanup falha ao remover objeto, agendando retry', { jobId: job.id, attempts, nextAttemptAt, error: message })
      }
    }
  }
  return result
}

// Disparo pós-commit: roda fora da requisição; erros são registrados e não
// afetam a resposta HTTP. Usado após exclusões que enfileiram limpeza.
export function triggerStorageCleanupAfterCommit(): void {
  void processPendingStorageCleanup({ limit: 200 }).catch((error) => {
    logger.error('storage-cleanup processamento pós-commit falhou', { error: error instanceof Error ? error.message : String(error) })
  })
}

// Ciclo periódico do processo API (MVP single-instance). [DB-SWAP] Com
// PostgreSQL múltiplas instâncias, mover para worker com FOR UPDATE SKIP LOCKED.
export function startStorageCleanupWorker(intervalMs = 60_000): () => void {
  triggerStorageCleanupAfterCommit()
  const timer = setInterval(triggerStorageCleanupAfterCommit, intervalMs)
  timer.unref?.()
  return () => clearInterval(timer)
}
