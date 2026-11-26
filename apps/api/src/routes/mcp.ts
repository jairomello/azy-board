/**
 * Endpoint MCP remoto (transporte Streamable HTTP), hospedado no processo da API.
 *
 * - Fica no topo (`/mcp` e `/mcp/projects/:projectId`), fora de `/api`: o corpo
 *   é JSON-RPC, não o envelope REST, então não passa pelo
 *   `agentResponseMiddleware`; segue sujeito aos middlewares globais.
 * - Autentica cada requisição por access token OAuth (`azo_`, emitido pelo
 *   authorization server da instalação; ver routes/mcpOAuth.ts) ou, de forma
 *   DEPRECIADA, por API Key (`azb_`). Todo 401 traz `WWW-Authenticate` com o
 *   Protected Resource Metadata da rota.
 * - Executa as ferramentas in-process. Com OAuth, a identidade já resolvida
 *   segue pelo binding interno do `app.fetch` (o token nunca autentica /api).
 *   Com API Key, a mesma credencial é reapresentada às rotas REST.
 * - MCP de projeto: o projeto do caminho é o contexto padrão e o escopo de
 *   projeto da credencial fica travado nele.
 * - Modo stateless com resposta JSON (sem afinidade de sessão).
 *
 * Rollback: defina `AZYBOARD_MCP_HTTP_ENABLED=false` para desligar o endpoint.
 */

import { Hono } from 'hono'
import type { Context } from 'hono'
import { handleMcpHttpRequest, parseApiResponse } from '@azy-board/mcp-protocol'
import type { ApiCall } from '@azy-board/tool-execution'
import { authMiddleware, MCP_INTERNAL, type McpInternalBinding, type McpPrincipal } from '../middleware/auth'
import { persistence } from '../persistence/runtime'
import { authorizeProjectRole } from '../services/projectAuthorization'
import { isGlobalGroup } from '../services/auth'
import { logger } from '../services/logger'
import {
  ACCESS_TOKEN_PREFIX, generalMcpResource, hashSecret, isUuid, projectMcpResource, protectedResourceMetadataUrl, publicBaseUrl,
} from '../services/mcpOAuth'
import type { HonoEnv } from '../types/hono'
import type { RequestContext } from '@azy-board/api-contracts'

// Cabeçalho opcional com o projeto de contexto da sessão. Em modo stateless o
// cliente reenvia a cada requisição; o `projectId` explícito no argumento da
// ferramenta continua prevalecendo. Nunca há projeto padrão por ambiente.
export const MCP_PROJECT_HEADER = 'X-Azyboard-Project-Id'
// Chave de idempotência opcional, repassada às mutações REST (padrão do agente).
export const MCP_IDEMPOTENCY_HEADER = 'Idempotency-Key'
// Guia de conexão na ajuda da própria instalação, apontado no aviso de depreciação da API Key.
export function mcpApiKeyDeprecationDoc(): string {
  return `${publicBaseUrl()}/help/09-configurar-o-servidor-mcp`
}

export function isMcpHttpEnabled(value = process.env.AZYBOARD_MCP_HTTP_ENABLED): boolean {
  if (value === undefined) return true
  return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase())
}

type InternalCredential = { authorization: string } | { principal: McpPrincipal }

/**
 * `ApiCall` in-process. Com API Key reapresenta a credencial às rotas REST;
 * com OAuth envia a identidade já resolvida pelo binding interno (que nenhuma
 * requisição externa alcança). A trava de projeto segue pelo mesmo binding.
 */
export function createMcpApiCall(credential: InternalCredential, idempotencyKey?: string, projectLock?: string): ApiCall {
  return async (path, method = 'GET', body) => {
    const { app } = await import('../index')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/vnd.azyboard.agent+json',
    }
    if ('authorization' in credential) headers.Authorization = credential.authorization
    if (method !== 'GET' && idempotencyKey) headers[MCP_IDEMPOTENCY_HEADER] = idempotencyKey
    const binding: McpInternalBinding = {
      [MCP_INTERNAL]: { principal: 'principal' in credential ? credential.principal : undefined, projectLock },
    }
    const response = await app.fetch(new Request(`http://azyboard.internal/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }), binding)
    return parseApiResponse(response)
  }
}

function unauthorized(c: Context<HonoEnv>, resource: string, invalidToken: boolean) {
  const params = [`resource_metadata="${protectedResourceMetadataUrl(resource)}"`]
  if (invalidToken) params.unshift('error="invalid_token"')
  c.header('WWW-Authenticate', `Bearer ${params.join(', ')}`)
  // O modo remoto autentica por token OAuth ou API Key; sessão do protocolo nunca autentica.
  return c.json({ error: 'Não autorizado', code: 'UNAUTHORIZED', retryable: false }, 401)
}

/** Valida o access token OAuth para o recurso da rota; null quando não vale. */
async function resolveOAuthPrincipal(rawToken: string, projectId: string | undefined): Promise<McpPrincipal | null> {
  const token = await persistence.oauth.findToken(hashSecret(rawToken))
  const now = new Date().toISOString()
  if (!token || token.kind !== 'ACCESS' || token.expiresAt <= now) return null
  const grant = await persistence.oauth.getGrant(token.grantId)
  if (!grant || grant.revokedAt) return null
  // Audiência: rota geral aceita só token geral; rota de projeto aceita o
  // token do próprio projeto e o token geral (recurso pai).
  const general = generalMcpResource()
  const audienceOk = projectId
    ? grant.resource === general || grant.resource === projectMcpResource(projectId)
    : grant.resource === general
  if (!audienceOk) return null
  const user = await persistence.identity.findUser({ tenantId: grant.tenantId, actorUserId: grant.userId, actorKind: 'SYSTEM' }, grant.userId)
  if (!user || user.tenantId !== grant.tenantId || !isGlobalGroup(user.globalGroup)) return null
  await persistence.oauth.touchGrant(grant.id, now)
  return {
    ctx: { userId: user.id, tenantId: user.tenantId, email: user.email, globalGroup: user.globalGroup },
    oauthGrantId: grant.id,
    clientName: grant.clientName,
    permissionScope: grant.scope.split(' ').filter(Boolean),
    projectScope: grant.projectId ? [grant.projectId] : null,
  }
}

async function handleMcp(c: Context<HonoEnv>, routeProjectId: string | undefined) {
  if (!isMcpHttpEnabled()) {
    return c.json({ error: 'Endpoint MCP desabilitado nesta instalação', code: 'MCP_DISABLED', retryable: false }, 404)
  }
  const resource = routeProjectId ? projectMcpResource(routeProjectId) : generalMcpResource()
  const authorization = c.req.header('Authorization')
  if (!authorization?.startsWith('Bearer ')) return unauthorized(c, resource, false)
  const rawToken = authorization.slice(7).trim()

  let credential: InternalCredential
  let ctx: RequestContext
  let permissionScope: string[] | null
  let viaApiKey = false
  if (rawToken.startsWith(ACCESS_TOKEN_PREFIX)) {
    const principal = await resolveOAuthPrincipal(rawToken, routeProjectId)
    if (!principal) return unauthorized(c, resource, true)
    credential = { principal }
    ctx = principal.ctx
    permissionScope = principal.permissionScope
  } else {
    // [DEPRECIADO] API Key no MCP: mesmo comportamento de antes, com aviso.
    let authenticated = false
    await authMiddleware(c, async () => { authenticated = true })
    if (!authenticated) return unauthorized(c, resource, true)
    credential = { authorization }
    ctx = c.get('ctx') as RequestContext
    permissionScope = c.get('apiKeyPermissionScope')
    viaApiKey = true
  }

  if (routeProjectId) {
    // Projeto inexistente, de outro tenant ou sem acesso: mesma resposta.
    const access = await authorizeProjectRole(ctx, routeProjectId, 'VIEWER', permissionScope)
    if (!access.ok) return c.json({ error: 'Projeto não encontrado', code: 'RESOURCE_NOT_FOUND', retryable: false }, 404)
  }

  const projectId = routeProjectId ?? (c.req.header(MCP_PROJECT_HEADER)?.trim() || undefined)
  const idempotencyKey = c.req.header(MCP_IDEMPOTENCY_HEADER)?.trim() || undefined
  const response = await handleMcpHttpRequest(c.req.raw, createMcpApiCall(credential, idempotencyKey, routeProjectId), {
    defaultProjectId: projectId,
    projectLock: routeProjectId,
    context: { userId: ctx.userId, tenantId: ctx.tenantId, globalGroup: ctx.globalGroup },
  })
  if (viaApiKey) {
    logger.warn('mcp.api_key_deprecated', { apiKeyId: c.get('apiKeyId'), tenantId: ctx.tenantId })
    const headers = new Headers(response.headers)
    headers.set('Deprecation', 'true')
    headers.append('Link', `<${mcpApiKeyDeprecationDoc()}>; rel="deprecation"`)
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  }
  return response
}

export const mcpRouter = new Hono<HonoEnv>()

mcpRouter.all('/projects/:projectId', async (c) => {
  const projectId = c.req.param('projectId')
  if (!isUuid(projectId)) return c.json({ error: 'Não encontrado', code: 'RESOURCE_NOT_FOUND', retryable: false }, 404)
  return handleMcp(c, projectId.toLowerCase())
})
mcpRouter.all('/', (c) => handleMcp(c, undefined))
