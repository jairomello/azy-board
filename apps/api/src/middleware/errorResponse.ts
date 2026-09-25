import type { Context, Next } from 'hono'

export type ErrorDetails = Record<string, unknown> | unknown[] | null

export interface ErrorPayload {
  error: {
    code: string
    message: string
    retryable: boolean
    details: ErrorDetails
  }
}

const statusCode = (status: number) => {
  if (status === 400 || status === 422) return 'INVALID_REQUEST'
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'RESOURCE_NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status === 413) return 'PAYLOAD_TOO_LARGE'
  if (status === 429) return 'RATE_LIMITED'
  return 'INTERNAL_ERROR'
}

const statusMessage = (status: number) => status >= 500 ? 'Não foi possível processar a solicitação' : 'A requisição não pôde ser processada'

function safeDetails(value: unknown): ErrorDetails {
  if (value === null || Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return null
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    if (/password|secret|token|authorization|stack|sql|query/i.test(key)) continue
    if (typeof item === 'string' && /password|secret|token|bearer|sqlite|postgres| at \//i.test(item)) continue
    if (item === null || ['string', 'number', 'boolean'].includes(typeof item)) result[key] = item
    else if (Array.isArray(item)) result[key] = item.slice(0, 100)
  }
  return result
}

export function normalizeErrorPayload(body: unknown, status: number): ErrorPayload {
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
  const nested = source.error && typeof source.error === 'object' && !Array.isArray(source.error)
    ? source.error as Record<string, unknown>
    : null
  const rawMessage = nested?.message ?? source.error ?? source.message
  const message = typeof rawMessage === 'string' && rawMessage.length > 0 && status < 500
    ? rawMessage
    : statusMessage(status)
  const code = typeof nested?.code === 'string' ? nested.code : typeof source.code === 'string' ? source.code : statusCode(status)
  const retryable = typeof nested?.retryable === 'boolean'
    ? nested.retryable
    : typeof source.retryable === 'boolean' ? source.retryable : status === 408 || status === 429 || status === 502 || status === 503 || status === 504
  const details = safeDetails(nested?.details ?? source.details ?? (Array.isArray(source.errors) ? { errors: source.errors } : null))
  return { error: { code, message, retryable, details } }
}

// [INTEGRIDADE] Traduz falhas de constraint do banco em erros de domínio,
// evitando HTTP 500 em conflitos previsíveis (unicidade, FK, CHECK, NOT NULL).
export function classifyDatabaseError(error: unknown): { status: 409 | 422; code: string } | null {
  const code = databaseErrorCode(error)
  // SQLSTATE PostgreSQL. O adapter SQLite continua classificado pela mensagem/código nativo abaixo.
  if (code === '23505' || code === '23503' || code === '23P01' || code === '40001' || code === '40P01') {
    return { status: 409, code: 'CONFLICT' }
  }
  if (code === '23514' || code === '23502' || code === '22001' || code === '22P02') {
    return { status: 422, code: 'INVALID_REQUEST' }
  }

  const message = error instanceof Error ? error.message : String(error)
  if (/UNIQUE constraint failed/i.test(message)) return { status: 409, code: 'CONFLICT' }
  if (/FOREIGN KEY constraint failed/i.test(message)) return { status: 409, code: 'CONFLICT' }
  if (/CHECK constraint failed/i.test(message)) return { status: 422, code: 'INVALID_REQUEST' }
  if (/NOT NULL constraint failed/i.test(message)) return { status: 422, code: 'INVALID_REQUEST' }
  return null
}

function databaseErrorCode(error: unknown): string | null {
  let current: unknown = error
  const visited = new Set<object>()
  for (let depth = 0; depth < 4 && current && typeof current === 'object' && !visited.has(current); depth += 1) {
    visited.add(current)
    const candidate = current as { code?: unknown; cause?: unknown }
    if (typeof candidate.code === 'string') return candidate.code
    current = candidate.cause
  }
  return null
}

export async function errorResponseMiddleware(c: Context, next: Next) {
  await next()
  if (c.res.status < 400 || !c.res.headers.get('content-type')?.includes('application/json')) return
  const body = await c.res.json().catch(() => null)
  const normalized = normalizeErrorPayload(body, c.res.status)
  // Preserva Retry-After informado pela rota ou aplica o padrão de 60s em 429.
  const retryAfter = c.res.headers.get('Retry-After')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (c.res.status === 429) headers['Retry-After'] = retryAfter ?? '60'
  c.res = new Response(JSON.stringify(normalized), {
    status: c.res.status,
    headers,
  })
}
