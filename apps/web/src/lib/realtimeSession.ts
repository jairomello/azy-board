import type { WsControlMessage, WsEvent, WsServerMessage } from '@azy-board/realtime-contracts'
import { WS_LIVE_BUFFER_MAX } from '@azy-board/realtime-contracts'
import { advanceBarrier, classifySequence, createRefetchBarrier, decideBarrier } from './realtimeReconciliation'

// [T39] Máquina de estados de consumo do canal WebSocket, extraída do hook para
// ser testável sem DOM/timers reais. O hook injeta IO (envio de controle, refetch,
// status, agendamento de retry); a sessão concentra cursor, buffer de lacunas,
// geração de conexão e a barreira de refetch.

export type SyncStatus = 'connecting' | 'syncing' | 'synced' | 'offline'

export interface RealtimeSessionDeps {
  projectId: string
  /** Envia um controle ao servidor (ex.: REFETCH_COMPLETE com o token pendente). */
  sendControl: (type: WsControlMessage['type'], token: string | null) => void
  /** Aplica um evento de domínio contíguo ao cache/handlers do cliente. */
  applyEvent: (event: WsEvent) => void
  /** Indica se há handler de refetch disponível (onResync). */
  hasRefetch: () => boolean
  /** Executa o refetch das consultas ativas (onResync). */
  refetch: () => Promise<void> | void
  /** Atualiza o estado de sincronização exibido. */
  setStatus: (status: SyncStatus) => void
  /** Agenda nova tentativa de refetch (backoff implementado pelo chamador). */
  scheduleRetry: (fn: () => void) => void
}

export class RealtimeSession {
  projectId: string
  private readonly deps: RealtimeSessionDeps
  private cursor: number | null = null
  private highest = 0
  private readonly buffered = new Map<number, WsEvent>()
  private replayComplete = false
  private barrierInFlight = false
  private barrierToken: string | null = null
  private generation = 0

  constructor(deps: RealtimeSessionDeps) {
    this.deps = deps
    this.projectId = deps.projectId
  }

  get appliedCursor(): number | null {
    return this.cursor
  }

  get generationId(): number {
    return this.generation
  }

  /** Nova conexão/geração: descarta respostas antigas e re-bufferiza até o replay. */
  newGeneration(): void {
    this.generation += 1
    this.replayComplete = false
    this.buffered.clear()
    this.barrierInFlight = false
  }

  /** Troca de projeto: zera cursor/geração (sem herdar progresso anterior). */
  resetProject(): void {
    this.cursor = null
    this.highest = 0
    this.newGeneration()
  }

  onMessage(message: WsServerMessage): void {
    // [TENANT] Evento de outro projeto nunca é aplicado.
    if (message.projectId !== this.projectId) return
    if ((message as WsControlMessage).kind === 'control') {
      this.onControl(message as WsControlMessage)
      return
    }
    this.onEvent(message as WsEvent)
  }

  private onControl(message: WsControlMessage): void {
    switch (message.type) {
      case 'HEARTBEAT':
        return // só mantém a conexão viva
      case 'REPLAY_COMPLETE': {
        const watermark = typeof message.watermark === 'number' ? message.watermark : message.sequence
        this.cursor = Math.max(this.cursor ?? 0, watermark)
        this.highest = Math.max(this.highest, watermark)
        this.replayComplete = true
        this.drainBuffered()
        this.deps.setStatus('synced')
        return
      }
      case 'RESYNC_REQUIRED':
        // Replay impossível: refaz as consultas ativas sob barreira de revisão.
        this.cursor = null
        this.replayComplete = false
        this.buffered.clear()
        this.refetch(message.token ?? null)
        return
      default:
        return
    }
  }

  private onEvent(event: WsEvent): void {
    this.highest = Math.max(this.highest, event.sequence)
    // Carga inicial/concorrência: bufferiza até a reconciliação concluir.
    if (!this.replayComplete || this.cursor === null) {
      this.bufferEvent(event)
      return
    }
    const classification = classifySequence(this.cursor, event.sequence)
    if (classification === 'duplicate') return
    if (classification === 'contiguous') {
      this.apply(event)
      this.drainBuffered()
      return
    }
    // Lacuna: não aplica fora de ordem; volta a syncing e reconcilia.
    this.refetch(null)
  }

  private bufferEvent(event: WsEvent): void {
    if (this.buffered.has(event.sequence)) return
    this.buffered.set(event.sequence, event)
    if (this.buffered.size > WS_LIVE_BUFFER_MAX) {
      // Overflow: descarta buffer e exige reconciliação por refetch.
      this.buffered.clear()
      this.refetch(null)
    }
  }

  private apply(event: WsEvent): void {
    this.cursor = event.sequence
    this.deps.applyEvent(event)
  }

  private drainBuffered(): void {
    let cursor = this.cursor
    while (cursor !== null && this.buffered.has(cursor + 1)) {
      const next = this.buffered.get(cursor + 1)!
      this.buffered.delete(cursor + 1)
      this.apply(next)
      cursor = this.cursor
    }
  }

  // Refetch com barreira de revisão: só conclui quando a revisão observada para
  // de avançar. Falha/handler ausente mantém syncing e retenta (nunca "synced"
  // após catch). Respostas de geração antiga são descartadas.
  private refetch(token: string | null): void {
    this.barrierToken = token ?? this.barrierToken
    this.deps.setStatus('syncing')
    if (this.barrierInFlight) return
    this.barrierInFlight = true
    const generation = this.generation
    void (async () => {
      let barrier = createRefetchBarrier(this.barrierToken, this.highest)
      while (generation === this.generation) {
        if (!this.deps.hasRefetch()) {
          this.scheduleRetry()
          return
        }
        try {
          await this.deps.refetch()
        } catch {
          this.scheduleRetry()
          return
        }
        if (generation !== this.generation) return
        const outcome = decideBarrier(barrier, this.highest)
        if (outcome === 'complete') {
          this.deps.sendControl('REFETCH_COMPLETE', barrier.token)
          this.replayComplete = true
          // O refetch reflete o snapshot até `highest`; eventos bufferizados
          // durante a barreira já estão cobertos e não são reaplicados.
          this.cursor = Math.max(this.cursor ?? 0, this.highest)
          this.buffered.clear()
          this.barrierInFlight = false
          this.deps.setStatus('synced')
          return
        }
        if (outcome === 'exhausted') {
          this.scheduleRetry()
          return
        }
        barrier = advanceBarrier(barrier, this.highest)
      }
    })()
  }

  private scheduleRetry(): void {
    this.barrierInFlight = false
    this.deps.scheduleRetry(() => this.refetch(this.barrierToken))
  }
}
