/**
 * Endpoint MCP remoto (transporte Streamable HTTP), hospedado no processo da API.
 *
 * - Fica no topo (`/mcp`), fora de `/api`: o corpo é JSON-RPC, não o envelope
 *   REST, então não passa pelo `agentResponseMiddleware`; segue sujeito aos
 *   middlewares globais (security headers, observabilidade, CORS, error
 *   handler, client IP) e à resolução de credencial.
 * - Autentica cada requisição por API Key (Bearer `azb_...`), resolvida pelo
 *   mesmo `authMiddleware` do REST: Owner, tenant, grupo global e escopos são
 *   resolvidos no servidor a cada chamada; nada de identidade vem do payload.
 * - Executa as ferramentas in-process via `ApiCall` que reapresenta a MESMA
 *   credencial nas rotas REST (não assina JWT de usuário), preservando
 *   `projectScope`/`permissionScope`/membership e o envelope de erro.
 * - Modo stateless com resposta JSON (sem afinidade de sessão), permitindo
 *   escala horizontal sem sticky session.
 *
 * Rollback: defina `AZYBOARD_MCP_HTTP_ENABLED=false` para desligar o endpoint.
 */

import { Hono } from 'hono'
import type { Context } from 'hono'
import { handleMcpHttpRequest, parseApiResponse } from '@azy-board/mcp-protocol'
import type { ApiCall } from '@azy-board/tool-execution'
import { authMiddleware } from '../middleware/auth'
import type { HonoEnv } from '../types/hono'
import type { RequestContext } from '@azy-board/api-contracts'

// Cabeçalho opcional com o projeto de contexto da sessão. Em modo stateless o
// cliente reenvia a cada requisição; o `projectId` explícito no argumento da
// ferramenta continua prevalecendo. Nunca há projeto padrão por ambiente.
export const MCP_PROJECT_HEADER = 'X-Azyboard-Project-Id'
// Chave de idempotência opcional, repassada às mutações REST (padrão do agente).
export const MCP_IDEMPOTENCY_HEADER = 'Idempotency-Key'

export function isMcpHttpEnabled(value = process.env.AZYBOARD_MCP_HTTP_ENABLED): boolean {
  if (value === undefined) return true
  return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase())
}

/**
 * `ApiCall` in-process que reapresenta a credencial recebida ao próprio app
 * Hono (rotas REST). A identidade real vem da API Key resolvida no servidor,
 * nunca dos argumentos da ferramenta.
 */
export function createMcpApiCall(authorization: string, idempotencyKey?: string): ApiCall {
  return async (path, method = 'GET', body) => {
    const { app } = await import('../index')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/vnd.azyboard.agent+json',
      Authorization: authorization,
    }
    if (method !== 'GET' && idempotencyKey) headers[MCP_IDEMPOTENCY_HEADER] = idempotencyKey
    const response = await app.fetch(new Request(`http://azyboard.internal/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }), {})
    return parseApiResponse(response)
  }
}

export const mcpRouter = new Hono<HonoEnv>()

mcpRouter.use('*', authMiddleware)
mcpRouter.all('*', async (c: Context<HonoEnv>) => {
  if (!isMcpHttpEnabled()) {
    return c.json({ error: 'Endpoint MCP desabilitado nesta instalação', code: 'MCP_DISABLED', retryable: false }, 404)
  }
  const authorization = c.req.header('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    // O modo remoto autentica por API Key; sessão do protocolo nunca autentica.
    return c.json({ error: 'Não autorizado', code: 'UNAUTHORIZED', retryable: false }, 401)
  }
  const ctx = c.get('ctx') as RequestContext
  const projectId = c.req.header(MCP_PROJECT_HEADER)?.trim() || undefined
  const idempotencyKey = c.req.header(MCP_IDEMPOTENCY_HEADER)?.trim() || undefined
  return handleMcpHttpRequest(c.req.raw, createMcpApiCall(authorization, idempotencyKey), {
    defaultProjectId: projectId,
    context: { userId: ctx.userId, tenantId: ctx.tenantId, globalGroup: ctx.globalGroup },
  })
})
