import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const DASHBOARD_PAGE_SIZE_DEFAULT = 50
export const DASHBOARD_PAGE_SIZE_MAX = 100

export interface DashboardCursorScope {
  tenantId: string
  projectId: string
  collection: string
  filters: unknown
  order: string
}

type CursorEnvelope = { version: 1; scopeHash: string; position: unknown }

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]))
  }
  return value
}

function hashScope(scope: DashboardCursorScope): string {
  return createHash('sha256').update(JSON.stringify(canonical(scope))).digest('hex')
}

function signingKey(): string {
  return process.env.DASHBOARD_CURSOR_SECRET ?? process.env.JWT_SECRET ?? 'azy-board-dev-secret-change-in-production'
}

function signature(payload: string): Buffer {
  return createHmac('sha256', signingKey()).update(payload).digest()
}

export function parseDashboardPageSize(value: string | undefined): number | null {
  if (value === undefined) return DASHBOARD_PAGE_SIZE_DEFAULT
  if (!/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return parsed >= 1 && parsed <= DASHBOARD_PAGE_SIZE_MAX ? parsed : null
}

export function createDashboardCursor(scope: DashboardCursorScope, position: unknown): string {
  const payload = Buffer.from(JSON.stringify({ version: 1, scopeHash: hashScope(scope), position } satisfies CursorEnvelope)).toString('base64url')
  return `${payload}.${signature(payload).toString('base64url')}`
}

export function readDashboardCursor(scope: DashboardCursorScope, token: string): unknown | null {
  const [payload, encodedSignature, ...extra] = token.split('.')
  if (!payload || !encodedSignature || extra.length) return null
  let actualSignature: Buffer
  try { actualSignature = Buffer.from(encodedSignature, 'base64url') } catch { return null }
  const expectedSignature = signature(payload)
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null
  try {
    const envelope = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<CursorEnvelope>
    if (envelope.version !== 1 || envelope.scopeHash !== hashScope(scope) || !Object.hasOwn(envelope, 'position')) return null
    return envelope.position
  } catch { return null }
}
