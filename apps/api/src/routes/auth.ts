import { Hono } from 'hono'
import type { HonoEnv } from '../types/hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { verifyPassword, signJwt, SESSION_COOKIE, sessionCookieOptions, sessionTtlSeconds, oauthCookieSecret } from '../services/auth'
import { authMiddleware } from '../middleware/auth'
import type { RequestContext, AuthProvider } from '@azy-board/api-contracts'
import { loginSchema, parseJson } from '../validation'
import { normalizeEmail } from '../utils/email'
import { evaluateLoginThrottle, recordLoginAttempt, resetIdentityFailures } from '../services/loginThrottle'
import { persistence } from '../persistence/runtime'
import { userPersistenceContext } from '../persistence/context'
import { resolveAuthConfig } from '../services/authConfig'
import { createOauthState, createPkce, oauthAuthorizeUrl, exchangeAuthorizationCode, base64urlEncode } from '../services/oauth'

export const authRouter = new Hono<HonoEnv>()

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const OAUTH_COOKIE = 'oauth_flow'
const OAUTH_TTL_MS = 10 * 60 * 1000 // 10 minutos

// ─── Cookie assinado do fluxo OAuth: { provider, state, verifier } ──────────
function signOauthEnvelope(payload: string): string {
  return createHmac('sha256', oauthCookieSecret()).update(payload).digest('base64url')
}

function encodeOauthEnvelope(data: unknown): string {
  const payload = base64urlEncode(JSON.stringify(data))
  return `${payload}.${signOauthEnvelope(payload)}`
}

function decodeOauthEnvelope(value: string): unknown | null {
  const separator = value.lastIndexOf('.')
  if (separator < 1) return null
  const payload = value.slice(0, separator)
  const signature = value.slice(separator + 1)
  const expected = signOauthEnvelope(payload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) } catch { return null }
}

// GET /auth/providers — descoberta pública do provedor (sem sessão, sem segredos).
authRouter.get('/providers', async (c) => {
  const config = resolveAuthConfig()
  const provider = config.provider as AuthProvider
  if (config.provider === 'LOCAL') {
    return c.json({ provider, providerName: null, oauthStartUrl: null })
  }
  const label = config.provider === 'MICROSOFT' ? 'Microsoft' : 'Google'
  return c.json({
    provider,
    providerName: label,
    oauthStartUrl: `/api/auth/oauth/${config.provider.toLowerCase()}/start`,
  })
})

// POST /auth/login
// [TENANT] tenant_id é incluído no JWT — a partir daqui toda requisição carrega o contexto de tenant
authRouter.post('/login', async (c) => {
  const parsed = await parseJson(c, loginSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  if (!body.email || !body.password) {
    return c.json({ error: 'E-mail e senha são obrigatórios' }, 400)
  }

  // Card T45 — com provedor integrado (Microsoft/Google), o login por senha
  // fica desabilitado; a autenticação humana ocorre pelo provedor configurado.
  if (resolveAuthConfig().provider !== 'LOCAL') {
    return c.json({ error: 'Autenticação por usuário e senha desabilitada — use o login integrado.', code: 'PASSWORD_LOGIN_DISABLED', retryable: false }, 403)
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

  // A identidade global é resolvida por e-mail canônico; o tenant vem do usuário encontrado.
  const user = await persistence.identity.findUserByCanonicalEmail(emailCanonical)

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

  // [SESSION] "lembrar-me" escolhe a duração estendida e o claim rmb; o maxAge acompanha.
  const remembered = body.remember === true
  const ttlSeconds = sessionTtlSeconds(remembered)

  // [TENANT] JWT inclui tenantId — extraído pelo authMiddleware em todas as requisições
  const token = await signJwt({
    sub: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: 'user',
    globalGroup: user.globalGroup,
  }, { ttlSeconds, remembered })

  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(ttlSeconds))

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

// ── Login integrado (Card T45): start (autoriza no provedor) + callback ─────
authRouter.get('/oauth/:provider/start', async (c) => {
  const provider = c.req.param('provider').toUpperCase() as Extract<AuthProvider, 'MICROSOFT' | 'GOOGLE'>
  const config = resolveAuthConfig()
  if (config.provider === 'LOCAL' || config.provider !== provider) {
    return c.json({ error: 'Provedor de login integrado não está habilitado nesta instalação', code: 'OAUTH_NOT_CONFIGURED', retryable: false }, 404)
  }
  const state = createOauthState()
  const pkce = createPkce()
  const url = oauthAuthorizeUrl(config, state, pkce.challenge)
  setCookie(c, OAUTH_COOKIE, encodeOauthEnvelope({ provider, state, verifier: pkce.verifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: OAUTH_TTL_MS / 1000,
    path: '/',
  })
  return c.redirect(url)
})

authRouter.get('/oauth/:provider/callback', async (c) => {
  const provider = c.req.param('provider').toUpperCase() as Extract<AuthProvider, 'MICROSOFT' | 'GOOGLE'>
  const envelope = decodeOauthEnvelope(getCookie(c, OAUTH_COOKIE) ?? '') as { provider?: string; state?: string; verifier?: string } | null
  clearOauthCookie(c)
  if (!envelope || envelope.provider !== provider || typeof envelope.state !== 'string' || typeof envelope.verifier !== 'string') {
    return c.json({ error: 'Fluxo de login inválido ou expirado', code: 'OAUTH_FLOW_INVALID', retryable: false }, 400)
  }
  const state = c.req.query('state')
  const code = c.req.query('code')
  const denied = c.req.query('error')
  if (denied) return c.json({ error: 'Login cancelado ou rejeitado pelo provedor', code: 'OAUTH_DENIED', retryable: false }, 403)
  if (!state || !code || state !== envelope.state) {
    return c.json({ error: 'Fluxo de login inválido', code: 'OAUTH_STATE_MISMATCH', retryable: false }, 400)
  }
  const config = resolveAuthConfig()
  if (config.provider === 'LOCAL' || config.provider !== provider) {
    return c.json({ error: 'Provedor de login integrado não está habilitado nesta instalação', code: 'OAUTH_NOT_CONFIGURED', retryable: false }, 404)
  }
  let emailCanonical: string
  let externalSubject: string
  try {
    const claims = await exchangeAuthorizationCode(config, code, envelope.verifier)
    emailCanonical = normalizeEmail(claims.email!)
    externalSubject = claims.sub ?? emailCanonical
  } catch {
    return c.json({ error: 'Falha na autenticação integrada', code: 'OAUTH_EXCHANGE_FAILED', retryable: false }, 400)
  }

  // [TENANT] A identidade é global por e-mail canônico; o tenant vem do usuário.
  const user = await persistence.identity.findUserByCanonicalEmail(emailCanonical)
  if (!user) {
    await recordLoginAttempt('oauth', emailCanonical, 'FAILURE')
    return c.json({ error: 'Identidade não cadastrada nesta instalação — contate o administrador', code: 'IDENTITY_NOT_FOUND', retryable: false }, 403)
  }

  // Vincula (ou valida) o par (provedor, subject) do usuário; nunca cria conta.
  try {
    const identityContext = {
      tenantId: user.tenantId, actorUserId: user.id, actorKind: 'USER' as const, globalGroup: user.globalGroup,
    }
    await persistence.identity.linkExternalIdentity(identityContext, user.id, config.provider, externalSubject)
  } catch (error) {
    if ((error as { message?: string }).message === 'EXTERNAL_IDENTITY_CONFLICT') {
      return c.json({ error: 'Identidade externa já vinculada a outra conta', code: 'EXTERNAL_IDENTITY_CONFLICT', retryable: false }, 409)
    }
    throw error
  }
  await recordLoginAttempt('oauth', emailCanonical, 'SUCCESS')

  const ttlSeconds = sessionTtlSeconds(false)
  const token = await signJwt({
    sub: user.id, tenantId: user.tenantId, email: user.email, role: 'user', globalGroup: user.globalGroup,
  }, { ttlSeconds, remembered: false })
  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(ttlSeconds))
  return c.redirect('/')
})

function clearOauthCookie(c: Parameters<typeof deleteCookie>[0]) {
  deleteCookie(c, OAUTH_COOKIE, { path: '/' })
}

// GET /auth/me — restaura a sessão e as preferências do usuário.
authRouter.get('/me', authMiddleware, async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const persisted = await persistence.identity.findUser(userPersistenceContext(ctx), ctx.userId)

  if (!persisted) return c.json({ error: 'Usuário não encontrado' }, 404)
  const { passwordHash: _passwordHash, ...user } = persisted
  return c.json({ user })
})

// POST /auth/logout
authRouter.post('/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.json({ ok: true })
})
