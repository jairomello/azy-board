/**
 * Authorization server OAuth 2.1 do MCP remoto (change mcp-oauth).
 *
 * - /.well-known/*: descoberta pública (RFC 9728 e RFC 8414).
 * - /api/oauth/mcp/register|token|revoke: clientes públicos (DCR, PKCE S256,
 *   refresh rotativo, revogação RFC 7009), com CORS aberto sem credenciais.
 * - /api/oauth/mcp/authorize/* e /grants: só sessão humana (cookie). API Key e
 *   tokens OAuth nunca aprovam consentimento nem gerenciam conexões.
 *
 * Codes e tokens são opacos e guardados só como hash SHA-256.
 */
import { Hono } from 'hono'
import type { Context } from 'hono'
import type { RequestContext } from '@azy-board/api-contracts'
import { requireHumanSession } from '../middleware/auth'
import { userPersistenceContext } from '../persistence/context'
import { persistence } from '../persistence/runtime'
import { authorizeProjectRole } from '../services/projectAuthorization'
import { isGlobalGroup } from '../services/auth'
import { logger } from '../services/logger'
import type { HonoEnv } from '../types/hono'
import type { OAuthClientRecord } from '../persistence/models'
import {
  ACCESS_TOKEN_PREFIX, ACCESS_TOKEN_TTL_SECONDS, AUTHORIZATION_CODE_TTL_SECONDS, REFRESH_REUSE_GRACE_MS,
  REFRESH_TOKEN_PREFIX, REFRESH_TOKEN_TTL_SECONDS, appendQuery, authorizationServerMetadata, generalMcpResource,
  generateSecret, grantedScopes, hashSecret, hostOfRedirect, isAcceptableRedirectUri, isAuthorizationServerMetadataPath,
  isValidCodeChallenge, parseMcpResource, protectedResourceMetadata, resourceFromMetadataPath, sanitizeClientName, verifyPkce,
  type McpResource,
} from '../services/mcpOAuth'

const SYSTEM = (tenantId: string, userId: string) => ({ tenantId, actorUserId: userId, actorKind: 'SYSTEM' as const })

// ── Descoberta ──────────────────────────────────────────────────────────────
export const wellKnownRouter = new Hono<HonoEnv>()

function wellKnownSuffix(c: Context<HonoEnv>, prefix: string): string {
  return c.req.path.slice(c.req.path.indexOf(prefix) + prefix.length)
}

wellKnownRouter.get('/oauth-protected-resource/*', (c) => {
  const resource = resourceFromMetadataPath(wellKnownSuffix(c, '/oauth-protected-resource'))
  if (!resource) return c.json({ error: 'not_found' }, 404)
  // O PRM de projeto não consulta o banco: não revela se o projeto existe.
  return c.json(protectedResourceMetadata(resource.resource))
})
wellKnownRouter.get('/oauth-protected-resource', (c) => c.json(protectedResourceMetadata(generalMcpResource())))

wellKnownRouter.get('/oauth-authorization-server/*', (c) => {
  if (!isAuthorizationServerMetadataPath(wellKnownSuffix(c, '/oauth-authorization-server'))) return c.json({ error: 'not_found' }, 404)
  return c.json(authorizationServerMetadata())
})
wellKnownRouter.get('/oauth-authorization-server', (c) => c.json(authorizationServerMetadata()))

// ── Endpoints OAuth ─────────────────────────────────────────────────────────
export const mcpOAuthRouter = new Hono<HonoEnv>()

function oauthError(c: Context<HonoEnv>, status: 400 | 401 | 404 | 429, error: string, description: string) {
  c.header('Cache-Control', 'no-store')
  return c.json({ error, error_description: description }, status)
}

// Limite simples por IP para o registro aberto (por instância).
const REGISTER_LIMIT = 20
const REGISTER_WINDOW_MS = 60_000
const registerHits = new Map<string, number[]>()

function registerAllowed(ip: string, now = Date.now()): boolean {
  const recent = (registerHits.get(ip) ?? []).filter(at => now - at < REGISTER_WINDOW_MS)
  if (recent.length >= REGISTER_LIMIT) {
    registerHits.set(ip, recent)
    return false
  }
  recent.push(now)
  registerHits.set(ip, recent)
  if (registerHits.size > 10_000) registerHits.clear()
  return true
}

/** Somente para testes: zera o limite de registro. */
export function resetRegisterLimit() {
  registerHits.clear()
}

mcpOAuthRouter.post('/register', async (c) => {
  if (!registerAllowed(c.get('clientIp') ?? 'desconhecido')) {
    c.header('Retry-After', '60')
    return oauthError(c, 429, 'too_many_requests', 'Muitos registros; tente novamente em instantes.')
  }
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') return oauthError(c, 400, 'invalid_client_metadata', 'Corpo JSON inválido.')
  const redirectUris = body.redirect_uris
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.length > 10 || !redirectUris.every(isAcceptableRedirectUri)) {
    return oauthError(c, 400, 'invalid_redirect_uri', 'Informe redirect_uris válidos (https, http em loopback ou esquema de app).')
  }
  const client = await persistence.oauth.createClient({ clientName: sanitizeClientName(body.client_name), redirectUris: redirectUris as string[] })
  c.header('Cache-Control', 'no-store')
  return c.json({
    client_id: client.id,
    client_id_issued_at: Math.floor(Date.parse(client.createdAt) / 1000),
    client_name: client.clientName,
    redirect_uris: client.redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }, 201)
})

type AuthorizeParams = {
  response_type?: string
  client_id?: string
  redirect_uri?: string
  code_challenge?: string
  code_challenge_method?: string
  scope?: string
  state?: string
  resource?: string
}

type AuthorizeFailure = { ok: false; status: 400 | 404; code: string; error: string }
type AuthorizeSuccess = {
  ok: true
  client: OAuthClientRecord
  redirectUri: string
  scopes: string[]
  resource: McpResource
  project: { id: string; name: string } | null
}

function readParams(source: Record<string, unknown>): AuthorizeParams {
  const pick = (key: keyof AuthorizeParams) => (typeof source[key] === 'string' ? source[key] as string : undefined)
  return {
    response_type: pick('response_type'), client_id: pick('client_id'), redirect_uri: pick('redirect_uri'),
    code_challenge: pick('code_challenge'), code_challenge_method: pick('code_challenge_method'),
    scope: pick('scope'), state: pick('state'), resource: pick('resource'),
  }
}

/** Valida cliente e redirect: sem isso nunca se redireciona para o endereço informado. */
async function validateClient(params: AuthorizeParams): Promise<{ ok: true; client: OAuthClientRecord; redirectUri: string } | AuthorizeFailure> {
  const client = params.client_id ? await persistence.oauth.getClient(params.client_id) : null
  if (!client) return { ok: false, status: 400, code: 'invalid_client', error: 'Aplicativo não registrado.' }
  if (!params.redirect_uri || !client.redirectUris.includes(params.redirect_uri)) {
    return { ok: false, status: 400, code: 'invalid_redirect_uri', error: 'Endereço de retorno não registrado para este aplicativo.' }
  }
  return { ok: true, client, redirectUri: params.redirect_uri }
}

async function validateAuthorization(ctx: RequestContext, params: AuthorizeParams): Promise<AuthorizeSuccess | AuthorizeFailure> {
  const clientCheck = await validateClient(params)
  if (!clientCheck.ok) return clientCheck
  if (params.response_type !== 'code') return { ok: false, status: 400, code: 'unsupported_response_type', error: 'Somente response_type=code é suportado.' }
  if (params.code_challenge_method !== 'S256' || !params.code_challenge || !isValidCodeChallenge(params.code_challenge)) {
    return { ok: false, status: 400, code: 'invalid_request', error: 'PKCE S256 é obrigatório.' }
  }
  const resource = parseMcpResource(params.resource ?? generalMcpResource())
  if (!resource) return { ok: false, status: 400, code: 'invalid_target', error: 'Recurso desconhecido.' }
  let project: AuthorizeSuccess['project'] = null
  if (resource.kind === 'project') {
    // Projeto inexistente, de outro tenant ou sem acesso têm a mesma resposta.
    const access = await authorizeProjectRole(ctx, resource.projectId, 'VIEWER')
    const record = access.ok ? await persistence.projects.getProject(userPersistenceContext(ctx), resource.projectId) : null
    if (!record) return { ok: false, status: 400, code: 'invalid_target', error: 'Recurso desconhecido.' }
    project = { id: record.id, name: record.name }
  }
  const scopes = grantedScopes(params.scope)
  if (scopes.length === 0) return { ok: false, status: 400, code: 'invalid_scope', error: 'Nenhum escopo conhecido foi solicitado.' }
  return { ok: true, client: clientCheck.client, redirectUri: clientCheck.redirectUri, scopes, resource, project }
}

mcpOAuthRouter.get('/authorize/validate', requireHumanSession, async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const result = await validateAuthorization(ctx, readParams(c.req.query()))
  if (!result.ok) return c.json({ error: result.error, code: result.code }, result.status)
  const user = await persistence.identity.findUser(SYSTEM(ctx.tenantId, ctx.userId), ctx.userId)
  return c.json({
    client: { id: result.client.id, name: result.client.clientName, redirectHost: hostOfRedirect(result.redirectUri) },
    account: { email: ctx.email, name: user?.name ?? null },
    scopes: result.scopes,
    resource: result.resource.resource,
    project: result.project,
  })
})

mcpOAuthRouter.post('/authorize/approve', requireHumanSession, async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const params = readParams(await c.req.json().catch(() => ({})) as Record<string, unknown>)
  const result = await validateAuthorization(ctx, params)
  if (!result.ok) return c.json({ error: result.error, code: result.code }, result.status)
  const code = generateSecret()
  await persistence.oauth.createCode({
    codeHash: hashSecret(code), clientId: result.client.id, tenantId: ctx.tenantId, userId: ctx.userId,
    redirectUri: result.redirectUri, codeChallenge: params.code_challenge!, scope: result.scopes.join(' '),
    resource: result.resource.resource, projectId: result.resource.kind === 'project' ? result.resource.projectId : null,
    expiresAt: new Date(Date.now() + AUTHORIZATION_CODE_TTL_SECONDS * 1000).toISOString(),
  })
  return c.json({ redirectUrl: appendQuery(result.redirectUri, { code, state: params.state }) })
})

mcpOAuthRouter.post('/authorize/deny', requireHumanSession, async (c) => {
  const params = readParams(await c.req.json().catch(() => ({})) as Record<string, unknown>)
  const result = await validateClient(params)
  if (!result.ok) return c.json({ error: result.error, code: result.code }, result.status)
  return c.json({ redirectUrl: appendQuery(result.redirectUri, { error: 'access_denied', state: params.state }) })
})

async function readTokenBody(c: Context<HonoEnv>): Promise<Record<string, string>> {
  const contentType = c.req.header('Content-Type') ?? ''
  const raw = contentType.includes('application/json')
    ? await c.req.json().catch(() => ({})) as Record<string, unknown>
    : await c.req.parseBody().catch(() => ({})) as Record<string, unknown>
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => typeof value === 'string')) as Record<string, string>
}

async function issueTokens(grantId: string, scope: string) {
  const accessToken = generateSecret(ACCESS_TOKEN_PREFIX)
  const refreshToken = generateSecret(REFRESH_TOKEN_PREFIX)
  const now = Date.now()
  await persistence.oauth.createToken({ tokenHash: hashSecret(accessToken), grantId, kind: 'ACCESS', expiresAt: new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString() })
  await persistence.oauth.createToken({ tokenHash: hashSecret(refreshToken), grantId, kind: 'REFRESH', expiresAt: new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString() })
  return { access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_TOKEN_TTL_SECONDS, refresh_token: refreshToken, scope }
}

async function activeUser(tenantId: string, userId: string): Promise<boolean> {
  const user = await persistence.identity.findUser(SYSTEM(tenantId, userId), userId)
  return Boolean(user && user.tenantId === tenantId && isGlobalGroup(user.globalGroup))
}

mcpOAuthRouter.post('/token', async (c) => {
  const body = await readTokenBody(c)
  c.header('Cache-Control', 'no-store')

  if (body.grant_type === 'authorization_code') {
    if (!body.code || !body.code_verifier || !body.client_id || !body.redirect_uri) {
      return oauthError(c, 400, 'invalid_request', 'code, code_verifier, client_id e redirect_uri são obrigatórios.')
    }
    // O code é consumido antes de qualquer verificação: falhou, não volta a valer.
    const code = await persistence.oauth.consumeCode(hashSecret(body.code))
    if (!code || code.expiresAt <= new Date().toISOString() || code.clientId !== body.client_id || code.redirectUri !== body.redirect_uri) {
      return oauthError(c, 400, 'invalid_grant', 'Código de autorização inválido ou expirado.')
    }
    if (!verifyPkce(body.code_verifier, code.codeChallenge)) return oauthError(c, 400, 'invalid_grant', 'code_verifier não confere.')
    if (body.resource && parseMcpResource(body.resource)?.resource !== code.resource) {
      return oauthError(c, 400, 'invalid_target', 'O recurso não corresponde ao autorizado.')
    }
    if (!await activeUser(code.tenantId, code.userId)) return oauthError(c, 400, 'invalid_grant', 'Usuário indisponível.')
    const client = await persistence.oauth.getClient(code.clientId)
    if (!client) return oauthError(c, 400, 'invalid_grant', 'Aplicativo não registrado.')
    const grant = await persistence.oauth.createGrant({
      tenantId: code.tenantId, userId: code.userId, clientId: client.id, clientName: client.clientName,
      scope: code.scope, resource: code.resource, projectId: code.projectId,
    })
    logger.info('mcp.oauth.authorized', { grantId: grant.id, clientId: client.id, tenantId: grant.tenantId, userId: grant.userId, resource: grant.resource })
    return c.json(await issueTokens(grant.id, grant.scope))
  }

  if (body.grant_type === 'refresh_token') {
    if (!body.refresh_token || !body.client_id) return oauthError(c, 400, 'invalid_request', 'refresh_token e client_id são obrigatórios.')
    const tokenHash = hashSecret(body.refresh_token)
    const token = await persistence.oauth.findToken(tokenHash)
    const grant = token?.kind === 'REFRESH' ? await persistence.oauth.getGrant(token.grantId) : null
    const now = new Date()
    if (!token || !grant || grant.revokedAt || grant.clientId !== body.client_id || token.expiresAt <= now.toISOString()) {
      return oauthError(c, 400, 'invalid_grant', 'Refresh token inválido ou expirado.')
    }
    if (body.resource && parseMcpResource(body.resource)?.resource !== grant.resource) {
      return oauthError(c, 400, 'invalid_target', 'O recurso não corresponde ao autorizado.')
    }
    if (token.usedAt) {
      // Reuso fora da janela de tolerância indica vazamento: revoga a conexão inteira.
      if (now.getTime() - Date.parse(token.usedAt) > REFRESH_REUSE_GRACE_MS) {
        await persistence.oauth.revokeGrant(grant.id, now.toISOString())
        logger.warn('mcp.oauth.refresh_reuse', { grantId: grant.id })
      }
      return oauthError(c, 400, 'invalid_grant', 'Refresh token já utilizado.')
    }
    if (!await persistence.oauth.markTokenUsed(tokenHash, now.toISOString())) return oauthError(c, 400, 'invalid_grant', 'Refresh token já utilizado.')
    if (!await activeUser(grant.tenantId, grant.userId)) return oauthError(c, 400, 'invalid_grant', 'Usuário indisponível.')
    return c.json(await issueTokens(grant.id, grant.scope))
  }

  return oauthError(c, 400, 'unsupported_grant_type', 'Use authorization_code ou refresh_token.')
})

mcpOAuthRouter.post('/revoke', async (c) => {
  const body = await readTokenBody(c)
  c.header('Cache-Control', 'no-store')
  if (body.token) {
    const token = await persistence.oauth.findToken(hashSecret(body.token))
    // Revogar qualquer token da conexão encerra a conexão (equivale a desconectar).
    if (token) await persistence.oauth.revokeGrant(token.grantId, new Date().toISOString())
  }
  // RFC 7009: responde 200 mesmo para token desconhecido.
  return c.body(null, 200)
})

mcpOAuthRouter.get('/grants', requireHumanSession, async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const grants = await persistence.oauth.listUserGrants(ctx.tenantId, ctx.userId)
  const context = userPersistenceContext(ctx)
  const projectNames = new Map<string, string | null>()
  for (const grant of grants) {
    if (grant.projectId && !projectNames.has(grant.projectId)) {
      projectNames.set(grant.projectId, (await persistence.projects.getProject(context, grant.projectId))?.name ?? null)
    }
  }
  return c.json({
    grants: grants.map(grant => ({
      id: grant.id, clientName: grant.clientName, resource: grant.resource, projectId: grant.projectId,
      projectName: grant.projectId ? projectNames.get(grant.projectId) ?? null : null,
      scopes: grant.scope.split(' ').filter(Boolean), createdAt: grant.createdAt, lastUsedAt: grant.lastUsedAt,
    })),
  })
})

mcpOAuthRouter.delete('/grants/:grantId', requireHumanSession, async (c) => {
  const ctx = c.get('ctx') as RequestContext
  const revoked = await persistence.oauth.revokeUserGrant(ctx.tenantId, ctx.userId, c.req.param('grantId') ?? '', new Date().toISOString())
  if (!revoked) return c.json({ error: 'Conexão não encontrada', code: 'RESOURCE_NOT_FOUND', retryable: false }, 404)
  return c.json({ revoked: true })
})
