import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import type { JwtPayload } from '@azy-board/types'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'azy-board-dev-secret-change-in-production'
)

const JWT_TTL = '1h'

// Hash de senha com bcrypt (custo 12 para boa segurança sem lentidão excessiva)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Emite JWT com tenant_id no payload
// [TENANT] tenant_id obrigatório no token — garante que toda requisição carrega o contexto de tenant
export async function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_TTL)
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
