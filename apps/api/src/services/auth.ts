import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import type { JwtPayload } from '@azy-board/api-contracts'
import type { GlobalGroup } from '@azy-board/domain'

export const GLOBAL_GROUPS = ['TEAM_MEMBER', 'MANAGER', 'ADMIN', 'ROOT'] as const
export const GLOBAL_GROUP_LEVEL: Record<GlobalGroup, number> = {
  TEAM_MEMBER: 1,
  MANAGER: 2,
  ADMIN: 3,
  ROOT: 4,
}

export function isGlobalGroup(value: unknown): value is GlobalGroup {
  return typeof value === 'string' && (GLOBAL_GROUPS as readonly string[]).includes(value)
}

export function hasGlobalGroup(group: GlobalGroup, minimum: GlobalGroup): boolean {
  return GLOBAL_GROUP_LEVEL[group] >= GLOBAL_GROUP_LEVEL[minimum]
}

const configuredSecret = process.env.JWT_SECRET
if (!configuredSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET é obrigatório em produção.')
}

const JWT_SECRET = new TextEncoder().encode(
  configuredSecret ?? 'azy-board-dev-secret-change-in-production'
)

// Card T45 — segredo reutilizado para assinar o cookie efêmero do fluxo OAuth
// (state + PKCE verifier), sem expor o payload a adulteração.
export function oauthCookieSecret(): string {
  return configuredSecret ?? 'azy-board-dev-secret-change-in-production'
}

// [SESSION] Nome do cookie de sessão compartilhado por login, renovação e logout.
export const SESSION_COOKIE = 'session'

const SECOND = 1
const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// [SESSION] Aceita durações curtas como "24h", "30d", "90m"; valor inválido cai no padrão.
function parseDurationSeconds(input: string | undefined, fallback: number): number {
  if (!input) return fallback
  const match = /^\s*(\d+)\s*([smhd])\s*$/.exec(input)
  if (!match) return fallback
  const value = Number(match[1])
  const unit = match[2]
  const multiplier = unit === 's' ? SECOND : unit === 'm' ? MINUTE : unit === 'h' ? HOUR : DAY
  const seconds = value * multiplier
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : fallback
}

// Duração padrão (>= 24h), duração do dispositivo lembrado e limite absoluto da sessão.
export const SESSION_TTL_SECONDS = parseDurationSeconds(process.env.SESSION_TTL, DAY)
export const SESSION_REMEMBER_TTL_SECONDS = parseDurationSeconds(process.env.SESSION_REMEMBER_TTL, 30 * DAY)
export const SESSION_MAX_TTL_SECONDS = parseDurationSeconds(process.env.SESSION_MAX_TTL, 180 * DAY)

export function sessionTtlSeconds(remembered: boolean): number {
  return remembered ? SESSION_REMEMBER_TTL_SECONDS : SESSION_TTL_SECONDS
}

// Atributos do cookie de sessão: inalterados pelo "lembrar-me", que afeta só o maxAge.
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict' as const,
    maxAge: maxAgeSeconds,
    path: '/',
  }
}

export interface SessionState {
  expired: boolean
  renew: boolean
  remembered: boolean
  authTime: number
  ttlSeconds: number
}

// [SESSION] Decide renovação deslizante (metade da duração) e expiração absoluta.
export function resolveSessionState(
  payload: Pick<JwtPayload, 'iat' | 'rmb' | 'authTime'>,
  nowSeconds: number,
): SessionState {
  const remembered = payload.rmb === true
  const ttlSeconds = sessionTtlSeconds(remembered)
  const authTime = payload.authTime ?? payload.iat
  const expired = nowSeconds - authTime >= SESSION_MAX_TTL_SECONDS
  const renew = !expired && nowSeconds - payload.iat >= Math.floor(ttlSeconds / 2)
  return { expired, renew, remembered, authTime, ttlSeconds }
}

export interface SignJwtOptions {
  ttlSeconds?: number
  remembered?: boolean
  authTime?: number
}

// Hash de senha com bcrypt (custo 12 para boa segurança sem lentidão excessiva)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Emite JWT com tenant_id no payload
// [TENANT] tenant_id obrigatório no token — garante que toda requisição carrega o contexto de tenant
export async function signJwt(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  options: SignJwtOptions = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const remembered = options.remembered === true
  const ttlSeconds = options.ttlSeconds ?? sessionTtlSeconds(remembered)
  const authTime = options.authTime ?? now
  return new SignJWT({ ...payload, rmb: remembered, authTime })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(JWT_SECRET)
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET)
  return payload as unknown as JwtPayload
}

// Gera uma API Key segura para agentes de IA
export function generateApiKey(): { key: string; prefix: string } {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const key = 'azb_' + Buffer.from(bytes).toString('hex')
  const prefix = key.slice(0, 12) + '...'
  return { key, prefix }
}
