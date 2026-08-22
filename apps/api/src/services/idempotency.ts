import { and, eq, lt } from 'drizzle-orm'
import { db } from '../db/index'
import { idempotencyRecords } from '../db/schema'
import { generateId } from '../utils/id'

const RETENTION_MS = 24 * 60 * 60 * 1000

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export async function payloadHash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(value)))
  return Buffer.from(digest).toString('hex')
}

export async function getIdempotent(ctx: { tenantId: string; userId: string }, tool: string, key: string, payload: unknown) {
  const now = new Date().toISOString()
  await db.delete(idempotencyRecords).where(lt(idempotencyRecords.expiresAt, now))
  const record = await db.query.idempotencyRecords.findFirst({
    where: (r) => and(eq(r.tenantId, ctx.tenantId), eq(r.ownerId, ctx.userId), eq(r.tool, tool), eq(r.idempotencyKey, key)),
  })
  if (!record) return null
  const hash = await payloadHash(payload)
  if (record.payloadHash !== hash) throw new Error('IDEMPOTENCY_CONFLICT')
  return JSON.parse(record.responseJson) as unknown
}

export async function saveIdempotent(ctx: { tenantId: string; userId: string }, tool: string, key: string, payload: unknown, response: unknown) {
  const now = new Date()
  await db.insert(idempotencyRecords).values({
    id: generateId(), tenantId: ctx.tenantId, ownerId: ctx.userId, tool, idempotencyKey: key,
    payloadHash: await payloadHash(payload), responseJson: JSON.stringify(response),
    createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + RETENTION_MS).toISOString(),
  }).onConflictDoNothing()
}
