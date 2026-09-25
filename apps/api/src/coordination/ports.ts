/**
 * Port de coordenação transitória: rate limiting e pub/sub do board.
 * SIMPLE usa implementação local (in-memory); ADVANCED usa Redis-compatível.
 * Redis/pub-sub NÃO é persistência de fila nem replay de eventos.
 */

export interface RateLimitDecision {
  allowed: boolean
  remaining: number
  resetAt: number
}

export interface CoordinationPort {
  /** Verifica e consome um slot de rate limit. Falha fechado se não puder verificar. */
  checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitDecision>

  /** Publica evento de broadcast para um tenant/projeto. */
  publish(channel: string, message: string): Promise<void>

  /** Assina canal de broadcast. Retorna função de cleanup. */
  subscribe(channel: string, handler: (message: string) => void): Promise<() => Promise<void>>

  /** Verifica se o serviço está disponível (readiness). */
  isReady(): Promise<boolean>

  /** Fecha conexões. */
  close(): Promise<void>
}
