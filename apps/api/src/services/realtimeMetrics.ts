import type { Counter, Gauge } from '@opentelemetry/api'
import type { ResyncReason } from '@azy-board/realtime-contracts'
import { getOtelMeter, isOtelInitialized } from './telemetry'

// [T39] Métricas de consumo entre instâncias. Labels são limitados a valores
// enumerados (motivo de RESYNC); tenant/projeto NUNCA viram label, evitando
// cardinalidade ilimitada.
let dedupCounter: Counter | null = null
let gapCounter: Counter | null = null
let resyncCounter: Counter | null = null
let lagGauge: Gauge | null = null
let refetchCounter: Counter | null = null
let ensuring = false
let initialized = false

async function ensureRealtimeMetrics(): Promise<void> {
  if (initialized || ensuring || !isOtelInitialized()) return
  ensuring = true
  try {
    const meter = await getOtelMeter('azyboard-realtime')
    if (!meter) return
    dedupCounter = meter.createCounter('realtime.delivery.dedup', { description: 'Eventos descartados por deduplicação' })
    gapCounter = meter.createCounter('realtime.gap.detected', { description: 'Lacunas de sequência detectadas no consumo' })
    resyncCounter = meter.createCounter('realtime.resync', { description: 'Ressincronizações exigidas, por motivo' })
    lagGauge = meter.createGauge('realtime.lag_seconds', { description: 'Idade do evento confirmado mais antigo ainda não entregue', unit: 's' })
    refetchCounter = meter.createCounter('realtime.refetch.confirmed', { description: 'Confirmações de barreira de refetch recebidas' })
    initialized = true
  } finally {
    ensuring = false
  }
}

export function recordRealtimeDedup(): void {
  void ensureRealtimeMetrics()
  dedupCounter?.add(1)
}

export function recordRealtimeGap(): void {
  void ensureRealtimeMetrics()
  gapCounter?.add(1)
}

export function recordRealtimeResync(reason: ResyncReason): void {
  void ensureRealtimeMetrics()
  resyncCounter?.add(1, { reason })
}

export function recordRealtimeLag(seconds: number): void {
  void ensureRealtimeMetrics()
  lagGauge?.record(Math.max(0, seconds))
}

export function recordRealtimeRefetchConfirmed(): void {
  void ensureRealtimeMetrics()
  refetchCounter?.add(1)
}
