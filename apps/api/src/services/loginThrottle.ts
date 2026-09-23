import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { db } from '../db'
import { loginAttempts } from '../db/schema'
import { generateId } from '../utils/id'

export type LoginAttemptOutcome = 'SUCCESS' | 'FAILURE' | 'THROTTLED'

// Limites configuráveis por ambiente para permitir testes determinísticos e
// ajuste operacional sem recompilar. Valores padrão refletem o design.
function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

const windowMs = () => envInt('LOGIN_WINDOW_MS', 15 * 60_000)
const maxAttemptsPerIp = () => envInt('LOGIN_MAX_ATTEMPTS_PER_IP', 30)
const maxFailuresPerIdentity = () => envInt('LOGIN_MAX_FAILURES_PER_IDENTITY', 5)
const progressiveDelayMs = () => envInt('LOGIN_PROGRESSIVE_DELAY_MS', 250)
const maxDelayMs = () => envInt('LOGIN_MAX_DELAY_MS', 2_000)
const retentionMs = () => envInt('LOGIN_RETENTION_MS', 30 * 24 * 60 * 60_000)

const PRUNE_INTERVAL_MS = 60 * 60_000
let lastPruneAt = 0

function earlierThanWindow(now: number): string {
  return new Date(now - windowMs()).toISOString()
}

// Poda oportunista de registros antigos, no máximo uma vez por hora.
async function pruneOldAttempts(now: number): Promise<void> {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return
  lastPruneAt = now
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(now - retentionMs()).toISOString()))
}

function retryAfterSeconds(oldestIso: string, now: number): number {
  const remaining = new Date(oldestIso).getTime() + windowMs() - now
  return Math.max(1, Math.ceil(remaining / 1000))
}

export type LoginThrottleDecision = {
  blocked: boolean
  retryAfterSeconds: number
  delayMs: number
}

/**
 * Avalia o estado de throttling para um par (IP, identidade) antes de verificar
 * a senha. Bloqueia quando o IP ou a identidade excede o limite na janela.
 */
export async function evaluateLoginThrottle(params: { ip: string; emailCanonical: string }): Promise<LoginThrottleDecision> {
  const now = Date.now()
  await pruneOldAttempts(now)
  const since = earlierThanWindow(now)

  const [ipRows, identityRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)`, oldest: sql<string | null>`min(${loginAttempts.createdAt})` })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.ip, params.ip), gte(loginAttempts.createdAt, since))),
    db.select({ count: sql<number>`count(*)`, oldest: sql<string | null>`min(${loginAttempts.createdAt})` })
      .from(loginAttempts)
      .where(and(
        eq(loginAttempts.emailCanonical, params.emailCanonical),
        eq(loginAttempts.outcome, 'FAILURE'),
        gte(loginAttempts.createdAt, since),
      )),
  ])

  const ipCount = Number(ipRows[0]?.count ?? 0)
  const ipOldest = ipRows[0]?.oldest ?? null
  if (ipCount >= maxAttemptsPerIp() && ipOldest) {
    return { blocked: true, retryAfterSeconds: retryAfterSeconds(ipOldest, now), delayMs: 0 }
  }

  const failureCount = Number(identityRows[0]?.count ?? 0)
  const failureOldest = identityRows[0]?.oldest ?? null
  if (failureCount >= maxFailuresPerIdentity() && failureOldest) {
    return { blocked: true, retryAfterSeconds: retryAfterSeconds(failureOldest, now), delayMs: 0 }
  }

  const delayMs = failureCount > 0 ? Math.min(progressiveDelayMs() * failureCount, maxDelayMs()) : 0
  return { blocked: false, retryAfterSeconds: 0, delayMs }
}

export async function recordLoginAttempt(ip: string, emailCanonical: string, outcome: LoginAttemptOutcome): Promise<void> {
  await db.insert(loginAttempts).values({
    id: generateId(),
    ip,
    emailCanonical,
    outcome,
    createdAt: new Date().toISOString(),
  })
}

/** Login bem-sucedido zera as falhas da identidade. */
export async function resetIdentityFailures(emailCanonical: string): Promise<void> {
  await db.delete(loginAttempts).where(and(
    eq(loginAttempts.emailCanonical, emailCanonical),
    eq(loginAttempts.outcome, 'FAILURE'),
  ))
}
