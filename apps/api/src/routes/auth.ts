import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index'
import { users } from '../db/schema'
import { verifyPassword, signJwt } from '../services/auth'
import { authMiddleware } from '../middleware/auth'
import type { RequestContext } from '@azy-board/types'
import { loginSchema, parseJson } from '../validation'
import { normalizeEmail } from '../utils/email'
import { evaluateLoginThrottle, recordLoginAttempt, resetIdentityFailures } from '../services/loginThrottle'

export const authRouter = new Hono<HonoEnv>()

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// POST /auth/login
// [TENANT] tenant_id é incluído no JWT — a partir daqui toda requisição carrega o contexto de tenant
authRouter.post('/login', async (c) => {
  const parsed = await parseJson(c, loginSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  if (!body.email || !body.password) {
    return c.json({ error: 'E-mail e senha são obrigatórios' }, 400)
  }

  const emailCanonical = normalizeEmail(body.email)
  const ip = c.get('clientIp')

  // [SECURITY] Rate limiting por IP e por identidade antes de verificar a senha.
  const throttle = await evaluateLoginThrottle({ ip, emailCanonical })
  if (throttle.blocked) {
    await recordLoginAttempt(ip, emailCanonical, 'THROTTLED')
    c.header('Retry-After', String(throttle.retryAfterSeconds))
    return c.json({ error: 'Muitas tentativas de login. Tente novamente mais tarde.', code: 'RATE_LIMITED', retryable: true }, 429)
  }
  if (throttle.delayMs > 0) await sleep(throttle.delayMs)

  const user = await db.query.users.findFirst({
    // [TENANT] A identidade é global: o e-mail canônico identifica um único
    // usuário em todo o sistema, e o tenant_id é derivado dessa identidade.
    // O e-mail canônico (lower + trim) preserva paridade com a unicidade global.
    where: (u) => eq(u.email, emailCanonical),
  })

  // Mensagem genérica — não revela qual campo está errado (segurança)
  if (!user) {
    await recordLoginAttempt(ip, emailCanonical, 'FAILURE')
    return c.json({ error: 'Credenciais inválidas' }, 401)
  }

  const valid = await verifyPassword(body.password, user.passwordHash)
  if (!valid) {
    await recordLoginAttempt(ip, emailCanonical, 'FAILURE')
    return c.json({ error: 'Credenciais inválidas' }, 401)
  }

  await recordLoginAttempt(ip, emailCanonical, 'SUCCESS')
  await resetIdentityFailures(emailCanonical)

  // [TENANT] JWT inclui tenantId — extraído pelo authMiddleware em todas as requisições
  const token = await signJwt({
    sub: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: 'user',
    globalGroup: user.globalGroup,
  })

  setCookie(c, 'session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 60 * 60, // 1 hora
    path: '/',
  })

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      theme: user.theme,
      lightShellTheme: user.lightShellTheme,
      language: user.language,
      autoThemeByTime: user.autoThemeByTime,
      globalGroup: user.globalGroup,
    },
  })
})

// GET /auth/me — restaura a sessão e as preferências do usuário.
authRouter.get('/me', authMiddleware, async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const user = await db.query.users.findFirst({
    // [TENANT] A sessão nunca pode resolver um usuário fora do tenant do JWT.
    where: (u) => and(eq(u.id, ctx.userId), eq(u.tenantId, ctx.tenantId)),
    columns: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      theme: true,
      lightShellTheme: true,
      language: true,
      autoThemeByTime: true,
      globalGroup: true,
    },
  })

  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404)
  return c.json({ user })
})

// POST /auth/logout
authRouter.post('/logout', (c) => {
  deleteCookie(c, 'session', { path: '/' })
  return c.json({ ok: true })
})
