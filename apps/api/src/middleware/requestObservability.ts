import type { Context, Next } from 'hono'
import type { HonoEnv } from '../types/hono'
import { logger } from '../services/logger'
import { anonymizeTenantId } from '../services/tenantHash'

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/

export function generateRequestId(): string {
  return crypto.randomUUID()
}

function isValidRequestId(value: string): boolean {
  return REQUEST_ID_PATTERN.test(value)
}

function stripQueryString(path: string): string {
  const idx = path.indexOf('?')
  return idx === -1 ? path : path.slice(0, idx)
}

export async function requestObservabilityMiddleware(c: Context<HonoEnv>, next: Next) {
  const start = performance.now()

  // Gerar ou propagar request ID
  const incoming = c.req.header('X-Request-Id')
  const requestId = incoming && isValidRequestId(incoming) ? incoming : generateRequestId()
  c.set('requestId', requestId)

  // Propagar o header em toda resposta
  c.header('X-Request-Id', requestId)

  await next()

  // Log ao final da requisição
  const durationMs = Math.round(performance.now() - start)
  const method = c.req.method
  const route = stripQueryString(c.req.path)
  const status = c.res.status

  // Health endpoints em nível debug
  const isHealth = route.startsWith('/health/')
  const level = isHealth ? 'debug' : status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'

  const tenant = c.get('ctx')?.tenantId ? anonymizeTenantId(c.get('ctx').tenantId) : undefined

  logger[level]('request', {
    requestId,
    method,
    route,
    status,
    durationMs,
    ...(tenant ? { tenant } : {}),
  })
}