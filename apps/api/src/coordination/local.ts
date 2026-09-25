import type { CoordinationPort, RateLimitDecision } from './ports'

/**
 * Coordenação local para o perfil SIMPLE.
 * Rate limiting in-memory (Map) e pub/sub local (EventEmitter).
 * Não abre conexões externas; perde estado em restart.
 */
export function createLocalCoordination(): CoordinationPort {
  const rateLimits = new Map<string, { count: number; resetAt: number }>()
  const subscribers = new Map<string, Set<(message: string) => void>>()

  return {
    async checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
      const now = Date.now()
      const entry = rateLimits.get(key)
      if (!entry || entry.resetAt <= now) {
        rateLimits.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
      }
      if (entry.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt }
      }
      entry.count++
      return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
    },

    async publish(channel: string, message: string): Promise<void> {
      const handlers = subscribers.get(channel)
      if (!handlers) return
      for (const handler of handlers) {
        try { handler(message) } catch { /* handler error is non-fatal */ }
      }
    },

    async subscribe(channel: string, handler: (message: string) => void): Promise<() => Promise<void>> {
      if (!subscribers.has(channel)) subscribers.set(channel, new Set())
      subscribers.get(channel)!.add(handler)
      return async () => {
        subscribers.get(channel)?.delete(handler)
        if (subscribers.get(channel)?.size === 0) subscribers.delete(channel)
      }
    },

    async isReady(): Promise<boolean> {
      return true // Local sempre disponível
    },

    async close(): Promise<void> {
      rateLimits.clear()
      subscribers.clear()
    },
  }
}
