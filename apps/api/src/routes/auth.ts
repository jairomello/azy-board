import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index'
import { users } from '../db/schema'
import { verifyPassword, signJwt } from '../services/auth'
import { authMiddleware } from '../middleware/auth'
import type { RequestContext } from '@azy-board/types'

export const authRouter = new Hono<HonoEnv>()

// POST /auth/login
// [TENANT] tenant_id é incluído no JWT — a partir daqui toda requisição carrega o contexto de tenant
authRouter.post('/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>()

  if (!body.email || !body.password) {
    return c.json({ error: 'E-mail e senha são obrigatórios' }, 400)
  }

  const user = await db.query.users.findFirst({
    where: (u) => eq(u.email, body.email),
  })

  // Mensagem genérica — não revela qual campo está errado (segurança)
  if (!user) {
    return c.json({ error: 'Credenciais inválidas' }, 401)
  }

  const valid = await verifyPassword(body.password, user.passwordHash)
  if (!valid) {
    return c.json({ error: 'Credenciais inválidas' }, 401)
  }

  // [TENANT] JWT inclui tenantId — extraído pelo authMiddleware em todas as requisições
  const token = await signJwt({
    sub: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: 'user',
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
