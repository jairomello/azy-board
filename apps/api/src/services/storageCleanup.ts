import { and, asc, eq, lte } from 'drizzle-orm'
import { db } from '../db/index'
import { storageCleanupJobs } from '../db/schema'
import { storage, type StorageAdapter } from './storage'
import { generateId } from '../utils/id'

// [DB-SWAP] Em PostgreSQL os mesmos inserts/updates valem; trocar apenas o driver.

// Orçamento de tentativas: após esgotar, o job fica FAILED e só a auditoria/
// reintegração manual resolve. Backoff exponencial limitado a ~30 min.
const MAX_ATTEMPTS = 8
const BASE_BACKOFF_MS = 30_000
const MAX_BACKOFF_MS = 30 * 60_000

export type StorageCleanupTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

function backoffFor(attempt: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1), MAX_BACKOFF_MS)
}

// Enfileira caminhos para limpeza pós-commit. Deve ser chamado DENTRO da
// transação que remove os metadados, garantindo atomicidade (outbox).
// Idempotente: o índice parcial UNIQUE (tenant_id, storage_path) WHERE
// status='PENDING' deduplica enfileiramentos repetidos.
export async function enqueueStorageCleanup(
  tx: StorageCleanupTx,
  tenantId: string,
  entries: Array<{ storagePath: string; resourceType?: 'ATTACHMENT' }>,
): Promise<number> {
  if (entries.length === 0) return 0
  const now = new Date().toISOString()
  // [TENANT] job sempre vinculado ao tenant do anexo excluído
  const ORIGIN = 'ATTACHMENT' as const
  await tx.insert(storageCleanupJobs).values(entries.map(entry => ({
    id: generateId(),
    tenantId,
    storagePath: entry.storagePath,
    resourceType: entry.resourceType ?? ORIGIN,
    status: 'PENDING' as const,
    attempts: 0,
    availableAt: now,
  }))).onConflictDoNothing()
  return entries.length
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
  const limit = options.limit ?? 50
  const adapter = options.adapter ?? storage
  const now = options.now ?? new Date()
  const nowIso = now.toISOString()

  const due = await db.select()
    .from(storageCleanupJobs)
    .where(and(eq(storageCleanupJobs.status, 'PENDING'), lte(storageCleanupJobs.availableAt, nowIso)))
    .orderBy(asc(storageCleanupJobs.availableAt))
    .limit(limit)

  const result: CleanupProcessResult = { processed: due.length, done: 0, retried: 0, failed: 0 }
  for (const job of due) {
    try {
      await adapter.delete(job.storagePath)
      await db.update(storageCleanupJobs).set({
        status: 'DONE',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastError: null,
      }).where(and(eq(storageCleanupJobs.id, job.id), eq(storageCleanupJobs.tenantId, job.tenantId)))
      result.done += 1
    } catch (error) {
      const attempts = job.attempts + 1
      const message = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500)
      const exhausted = attempts >= MAX_ATTEMPTS
      const nextAttemptAt = new Date(now.getTime() + backoffFor(attempts)).toISOString()
      // [TENANT] update escopado por (id, tenant_id)
      await db.update(storageCleanupJobs).set({
        status: exhausted ? 'FAILED' : 'PENDING',
        attempts,
        lastError: message,
        availableAt: exhausted ? job.availableAt : nextAttemptAt,
        updatedAt: new Date().toISOString(),
      }).where(and(eq(storageCleanupJobs.id, job.id), eq(storageCleanupJobs.tenantId, job.tenantId)))
      if (exhausted) {
        result.failed += 1
        console.error('[storage-cleanup] job marcado como FAILED', { jobId: job.id, attempts, error: message })
      } else {
        result.retried += 1
        console.error('[storage-cleanup] falha ao remover objeto, agendando retry', { jobId: job.id, attempts, nextAttemptAt, error: message })
      }
    }
  }
  return result
}

// Disparo pós-commit: roda fora da requisição; erros são registrados e não
// afetam a resposta HTTP. Usado após exclusões que enfileiram limpeza.
export function triggerStorageCleanupAfterCommit(): void {
  void processPendingStorageCleanup({ limit: 200 }).catch((error) => {
    console.error('[storage-cleanup] processamento pós-commit falhou', error instanceof Error ? error.message : error)
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
