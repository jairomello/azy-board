import type { Context, Next } from 'hono'
import type { HonoEnv } from '../types/hono'

// Bun `serve` expõe requestIP no segundo argumento do fetch, injetado no Hono
// como `c.env.server`.
type BunServerLike = { requestIP?: (req: Request) => { address?: string | null } | null }

// [SECURITY] X-Forwarded-For só é considerado quando o operador declara que há
// um proxy confiável na frente (ex.: Nginx Proxy Manager). Sem isso, um cliente
// poderia forjar o header e burlar o limite por IP.
function trustProxy(): boolean {
  return process.env.TRUST_PROXY === 'true'
}

export function resolveClientIp(c: Context<HonoEnv>): string {
  const server = (c.env as { server?: BunServerLike } | undefined)?.server
  const direct = server?.requestIP?.(c.req.raw)?.address ?? null

  if (trustProxy()) {
    const header = c.req.header('x-forwarded-for')
    const parts = header?.split(',').map((part) => part.trim()).filter(Boolean) ?? []
    // A última entrada é a anexada pelo proxy imediato confiável.
    if (parts.length > 0) return parts[parts.length - 1]!
  }

  return direct ?? 'unknown'
}

export async function clientIpMiddleware(c: Context<HonoEnv>, next: Next) {
  c.set('clientIp', resolveClientIp(c))
  await next()
}
