import type { WsEventType } from '@azy-board/realtime-contracts'
import type { DomainEventRecord } from '../persistence/ports'
import { mapDomainEventToWs } from '../persistence/domainEvents'
import { persistence } from '../persistence/runtime'
import { publishDurableEvent } from './websocket'
import { registerDomainEventKick } from './domainEventOutbox'
import { isOtelInitialized, getOtelMeter } from './telemetry'
import { logger } from './logger'

// [T38] Observabilidade da outbox: profundidade, idade, tentativas e falhas.
let outboxPendingGauge: import('@opentelemetry/api').Gauge | null = null
let outboxAttemptsGauge: import('@opentelemetry/api').Gauge | null = null
let outboxOldestGauge: import('@opentelemetry/api').Gauge | null = null
let outboxFailuresCounter: import('@opentelemetry/api').Counter | null = null

async function ensureOutboxMetrics(): Promise<void> {
  if (!isOtelInitialized() || outboxPendingGauge) return
  const meter = await getOtelMeter('azyboard-domain-outbox')
  if (!meter) return
  outboxPendingGauge = meter.createGauge('domain.outbox.pending', { description: 'Eventos de domínio pendentes de publicação' })
  outboxAttemptsGauge = meter.createGauge('domain.outbox.max_attempts', { description: 'Maior número de tentativas entre pendências' })
  outboxOldestGauge = meter.createGauge('domain.outbox.oldest_age_seconds', { description: 'Idade da pendência mais antiga da outbox', unit: 's' })
  outboxFailuresCounter = meter.createCounter('domain.outbox.publish_failures', { description: 'Falhas de publicação por tipo de evento' })
}

async function recordOutboxStats(): Promise<void> {
  const stats = await persistence.domainEvents.pendingStats()
  await ensureOutboxMetrics()
  outboxPendingGauge?.record(stats.pending)
  outboxAttemptsGauge?.record(stats.maxAttempts)
  const ageMs = stats.oldestAvailableAt ? Date.now() - Date.parse(stats.oldestAvailableAt) : 0
  if (outboxOldestGauge) outboxOldestGauge.record(Math.max(0, ageMs / 1000))
  if (stats.pending > 0) {
    logger.warn('domain-event-dispatcher: pendências na outbox', { pending: stats.pending, oldestAgeMs: ageMs, maxAttempts: stats.maxAttempts })
  }
}

// [T38] Dispatcher da outbox de domínio. Consome SOMENTE eventos confirmados,
// reivindica com lease, publica pelo transporte, marca ack/tentativas e
// reagenda com backoff. Entrega at-least-once: repetições conservam eventId e
// sequência para dedup no consumidor. Nunca repete a mutação.

export interface TransportedDomainEvent {
  id: string
  tenantId: string
  projectId: string
  sequence: number
  type: string
  payload: unknown
  schemaVersion: number
}

export type DomainEventTransport = (event: TransportedDomainEvent) => void | Promise<void>

export interface DomainEventDispatcherOptions {
  transport: DomainEventTransport
  workerId: string
  intervalMs?: number
  batchSize?: number
  leaseMs?: number
  maxBackoffMs?: number
  baseBackoffMs?: number
  now?: () => Date
}

export interface DispatchSummary {
  claimed: number
  published: number
  retried: number
  skipped: number
}

/** Transporte local (SIMPLE): publica no canal WebSocket com a sequência durável. */
export function websocketDomainEventTransport(event: TransportedDomainEvent): void {
  publishDurableEvent(
    event.tenantId,
    event.projectId,
    event.sequence,
    { projectId: event.projectId, type: event.type as WsEventType, payload: event.payload },
    { eventId: event.id, schemaVersion: event.schemaVersion },
  )
}

function backoffMs(attempts: number, base: number, max: number): number {
  return Math.min(base * 2 ** Math.max(0, attempts - 1), max)
}

/** Executa um ciclo do dispatcher. Exportado para testes e para o worker. */
export async function dispatchDueEvents(options: DomainEventDispatcherOptions): Promise<DispatchSummary> {
  await ensureOutboxMetrics()
  const clock = options.now ?? (() => new Date())
  const claimed = await persistence.domainEvents.claimDue({
    now: clock().toISOString(),
    limit: options.batchSize ?? 50,
    workerId: options.workerId,
    leaseMs: options.leaseMs ?? 30_000,
  })

  let published = 0
  let retried = 0
  let skipped = 0

  for (const event of claimed) {
    const mapped = mapDomainEventToWs(event.type, event.payload)
    const attempts = event.attempts + 1
    if (!mapped) {
      // Tipo sem transporte conhecido: não descartar; reagenda e mantém visível.
      const availableAt = new Date(clock().getTime() + backoffMs(attempts, options.baseBackoffMs ?? 5_000, options.maxBackoffMs ?? 5 * 60_000)).toISOString()
      await persistence.domainEvents.markRetry(event.id, event.tenantId, { attempts, availableAt })
      skipped += 1
      continue
    }
    try {
      await options.transport({ id: event.id, tenantId: event.tenantId, projectId: event.projectId, sequence: event.sequence, type: mapped.type, payload: mapped.payload, schemaVersion: event.schemaVersion })
      await persistence.domainEvents.markPublished(event.id, event.tenantId, clock().toISOString())
      published += 1
    } catch (error) {
      const availableAt = new Date(clock().getTime() + backoffMs(attempts, options.baseBackoffMs ?? 5_000, options.maxBackoffMs ?? 5 * 60_000)).toISOString()
      await persistence.domainEvents.markRetry(event.id, event.tenantId, { attempts, availableAt })
      retried += 1
      outboxFailuresCounter?.add(1, { type: mapped.type })
      logger.warn('domain-event-dispatcher: falha de publicação', {
        eventId: event.id, tenantId: event.tenantId, projectId: event.projectId,
        attempts, error: error instanceof Error ? error.message : 'unknown',
      })
    }
  }

  return { claimed: claimed.length, published, retried, skipped }
}

/** Worker periódico. Retorna a função de parada (idempotente). */
export function startDomainEventDispatcher(options: DomainEventDispatcherOptions): () => void {
  const intervalMs = options.intervalMs ?? 250
  let stopped = false
  let running = false
  const tick = async () => {
    if (stopped || running) return
    running = true
    try {
      const summary = await dispatchDueEvents(options)
      if (summary.claimed > 0) logger.info('domain-event-dispatcher: ciclo', { ...summary, workerId: options.workerId })
      await recordOutboxStats()
    } catch (error) {
      logger.error('domain-event-dispatcher: ciclo falhou', { error: error instanceof Error ? error.message : 'unknown' })
    } finally {
      running = false
    }
  }
  // Publica logo após um append (emitDomainEvent) sem esperar o próximo ciclo.
  registerDomainEventKick(() => { void tick() })
  const timer = setInterval(() => { void tick() }, intervalMs)
  ;(timer as unknown as { unref?: () => void }).unref?.()
  void tick()
  return () => {
    if (stopped) return
    stopped = true
    clearInterval(timer)
    registerDomainEventKick(null)
  }
}

export type { DomainEventRecord }
