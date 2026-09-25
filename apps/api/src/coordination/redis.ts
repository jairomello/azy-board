import { Redis } from 'ioredis'
import type { CoordinationPort, RateLimitDecision } from './ports'

/**
 * Coordenação Redis-compatível para o perfil ADVANCED.
 * Valkey (BSD) é a referência comunitária; cliente ioredis é permissivo (MIT).
 * Rate limiting atômico via INCR/EXPIRE; pub/sub via canais escopados por tenant/projeto.
 * Redis indisponível → falha fechado (não libera mutação protegida).
 */
export function createRedisCoordination(redisUrl: string): CoordinationPort {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 10) return null // Para de tentar após 10 falhas
      return Math.min(times * 100, 2000)
    },
    lazyConnect: false,
  })

  const subscriber = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 10) return null
      return Math.min(times * 100, 2000)
    },
    lazyConnect: false,
  })

  const handlers = new Map<string, Set<(message: string) => void>>()

  subscriber.on('message', (channel: string, message: string) => {
    const channelHandlers = handlers.get(channel)
    if (!channelHandlers) return
    for (const handler of channelHandlers) {
      try { handler(message) } catch { /* handler error is non-fatal */ }
    }
  })

  return {
    async checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
      try {
        const now = Date.now()
        const windowKey = `rl:${key}:${Math.floor(now / windowMs)}`
        const pipeline = client.pipeline()
        pipeline.incr(windowKey)
        pipeline.pexpire(windowKey, windowMs)
        const results = await pipeline.exec()
        if (!results) throw new Error('PIPELINE_FAILED')
        const count = results[0]?.[1] as number
        const resetAt = Math.floor(now / windowMs) * windowMs + windowMs
        return {
          allowed: count <= limit,
          remaining: Math.max(0, limit - count),
          resetAt,
        }
      } catch {
        // Falha fechada: não libera mutação protegida se não puder verificar
        return { allowed: false, remaining: 0, resetAt: Date.now() + windowMs }
      }
    },

    async publish(channel: string, message: string): Promise<void> {
      await client.publish(channel, message)
    },

    async subscribe(channel: string, handler: (message: string) => void): Promise<() => Promise<void>> {
      if (!handlers.has(channel)) {
        handlers.set(channel, new Set())
        await subscriber.subscribe(channel)
      }
      handlers.get(channel)!.add(handler)
      return async () => {
        handlers.get(channel)?.delete(handler)
        if (handlers.get(channel)?.size === 0) {
          handlers.delete(channel)
          await subscriber.unsubscribe(channel)
        }
      }
    },

    async isReady(): Promise<boolean> {
      try {
        const status = await client.ping()
        return status === 'PONG'
      } catch {
        return false
      }
    },

    async close(): Promise<void> {
      handlers.clear()
      await Promise.allSettled([client.quit(), subscriber.quit()])
    },
  }
}
