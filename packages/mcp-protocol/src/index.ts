/**
 * @azy-board/mcp-protocol — core do protocolo MCP independente de aplicativo.
 *
 * Concentra a dependência do SDK MCP (`@modelcontextprotocol/sdk`) e a
 * montagem do servidor de ferramentas, servindo dois adaptadores finos:
 *
 *   - `apps/mcp`: transporte stdio local (adaptador HTTP via `makeApiCall`);
 *   - `apps/api`: transporte Streamable HTTP hospedado na rota `/mcp`
 *     (adaptador `ApiCall` in-process com a credencial da requisição).
 *
 * O catálogo, as policies e a execução compartilhada continuam em
 * `@azy-board/tool-registry` e `@azy-board/tool-execution`, sem transporte.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import type { ApiCall } from '@azy-board/tool-execution'
import type { HumanToolContext, ToolDefinition } from '@azy-board/tool-registry'
import { applyOptionalFields, hasMcpPolicy } from '@azy-board/tool-registry'
import { executeSharedTool, getSharedToolDefinitions, sanitizeToolOutput } from '@azy-board/tool-execution'

export class ApiError extends Error {
  constructor(readonly code: string, message: string, readonly retryable: boolean, readonly details: unknown = null) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Converte a resposta REST no resultado da ferramenta, preservando o envelope
 * de erro normalizado já usado por REST e pelo Azy Agent (código, mensagem,
 * retryabilidade e detalhes).
 */
export async function parseApiResponse(res: Response): Promise<unknown> {
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { code?: string; error?: string | { code?: string; message?: string; retryable?: boolean; details?: unknown }; retryable?: boolean } | null
    const error = body?.error
    if (error && typeof error === 'object') throw new ApiError(error.code ?? `HTTP_${res.status}`, error.message ?? `Erro HTTP ${res.status}`, error.retryable === true, error.details)
    throw new ApiError(body?.code ?? `HTTP_${res.status}`, typeof error === 'string' ? error : `Erro HTTP ${res.status}`, body?.retryable ?? res.status >= 500)
  }
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return res.text()
  try {
    const payload = await res.json() as { data?: unknown; error?: { code?: string; message?: string; retryable?: boolean; details?: unknown } }
    if (payload.error) {
      throw new ApiError(payload.error.code ?? `HTTP_${res.status}`, payload.error.message ?? `Erro HTTP ${res.status}`, payload.error.retryable === true, payload.error.details)
    }
    return payload.data
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('INVALID_API_RESPONSE', 'A API retornou JSON inválido', true)
  }
}

function validationDetails(toolName: string, args: Record<string, unknown>, message: string) {
  const missing = message.match(/Campo obrigatório ausente: (\w+)/)?.[1]
  const invalidField = message.match(/Campo de alteração inválido: (\w+)/)?.[1]
  const unknownField = message.match(/Campo desconhecido: (\w+)/)?.[1]
  const field = missing ?? invalidField ?? unknownField ?? message.match(/(?:^|\s)([a-zA-Z][\w.]*) (?:deve|é|contém|inválido)/)?.[1] ?? 'arguments'
  const path = invalidField ? `changes.${invalidField}` : field
  const snippet = missing
    ? JSON.stringify({ [missing]: '<valor>' })
    : toolName === 'check_item'
      ? '{ "itemId": "<card>", "checklistName": "Checklist", "text": "Passo", "checked": true }'
      : toolName === 'check_items'
        ? '{ "projectId": "<projeto>", "items": [{ "itemId": "<card>", "checked": true }] }'
        : JSON.stringify(args)
  return { path, cause: message, snippet }
}

// [SEGURANÇA] Nada de identidade, tenant, grupo ou escopo pode vir dos
// argumentos da ferramenta: esses valores são resolvidos no servidor a partir
// da credencial. Chaves reservadas aqui nunca são campos válidos de schema.
const FORBIDDEN_ARGUMENT_KEYS = new Set(['tenantId', 'globalGroup', 'source', 'actorUserId', 'ownerId', 'apiKeyId', 'permissionScope', 'projectScope'])

export type McpResolvedContext = {
  userId: string
  tenantId: string
  globalGroup: HumanToolContext['globalGroup']
}

export type McpServerOptions = {
  /** Projeto padrão (modo stdio via `AZYBOARD_PROJECT_ID`, modo remoto via contexto de sessão). Torna `projectId` opcional nas ferramentas. */
  defaultProjectId?: string
  /** Identidade resolvida no servidor. No stdio o adaptador usa placeholders do Owner (a autorização real ocorre na API). */
  context?: McpResolvedContext
}

// Identidade placeholder do transporte stdio: a API resolve o Owner real da
// chave a cada chamada REST; o contexto aqui é apenas o rótulo do ator.
const STDIO_CONTEXT: McpResolvedContext = { userId: 'api-key-owner', tenantId: 'api-key-tenant', globalGroup: 'TEAM_MEMBER' }

function withOptionalFields(tool: ToolDefinition): ToolDefinition {
  return { ...tool, inputSchema: applyOptionalFields(tool.inputSchema, tool.name) }
}

// [DEFAULT PROJECT] Com projeto padrão configurado, `projectId` vira opcional no schema.
function withOptionalProjectId(tool: ToolDefinition, defaultProjectId: string, source: string): ToolDefinition {
  if (!tool.inputSchema.required.includes('projectId')) return tool
  return {
    ...tool,
    description: `${tool.description} Se projectId for omitido, o projeto padrão pré-configurado é usado.`,
    inputSchema: {
      ...tool.inputSchema,
      required: tool.inputSchema.required.filter(field => field !== 'projectId'),
      properties: {
        ...tool.inputSchema.properties,
        projectId: { type: ['string', 'null'], description: `Opcional — padrão: ${source} (${defaultProjectId}). Aceita ID ou nome exato do projeto.` },
      },
    },
  }
}

export function createMcpServer(apiCall: ApiCall, options: McpServerOptions = {}) {
  const { defaultProjectId } = options
  const resolved = options.context ?? STDIO_CONTEXT
  const projectSource = options.context ? 'contexto de sessão' : 'projeto pré-configurado via AZYBOARD_PROJECT_ID'
  const server = new Server(
    { name: 'azy-board', version: '1.0.0' },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: getSharedToolDefinitions()
      .map(withOptionalFields)
      .map(tool => defaultProjectId ? withOptionalProjectId(tool, defaultProjectId, projectSource) : tool)
      .map(({ policy: _policy, namespace: _namespace, ...tool }) => tool),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params
    const args: Record<string, unknown> = { ...(request.params.arguments ?? {}) }
    // [DEFAULT PROJECT] injeta o projeto padrão apenas quando a ferramenta aceita
    // `projectId`; ferramentas globais (ex.: list_projects) não recebem o campo e
    // permanecem válidas com um contexto de projeto configurado.
    const definition = getSharedToolDefinitions([name])[0]
    const acceptsProjectId = definition?.inputSchema.properties.projectId !== undefined
    if (defaultProjectId && acceptsProjectId && (args.projectId === undefined || args.projectId === null || args.projectId === '')) {
      args.projectId = defaultProjectId
    }

    function ok(data: unknown) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        structuredContent: Array.isArray(data) ? { data } : (data && typeof data === 'object' ? data : { data }),
      }
    }

    try {
      if (!hasMcpPolicy(name)) throw new ApiError('MCP_POLICY_REQUIRED', 'Ferramenta não autorizada', false)
      // [SEGURANÇA] Recusa identidade/tenant/grupo/escopo vindos do payload.
      const forged = Object.keys(args).filter(key => FORBIDDEN_ARGUMENT_KEYS.has(key))
      if (forged.length) throw new ApiError('MCP_IDENTITY_ARGUMENT_FORBIDDEN', `Identidade, tenant, grupo e escopo são resolvidos no servidor; remova: ${forged.join(', ')}`, false, { fields: forged })
      // Ambos os transportes usam o mesmo executor. A API resolve o Owner da
      // chave; o adaptador fornece o ator autenticado (real no modo remoto).
      return ok(sanitizeToolOutput(await executeSharedTool(name, args, {
        api: apiCall,
        context: { source: 'mcp', userId: resolved.userId, tenantId: resolved.tenantId, globalGroup: resolved.globalGroup },
      })))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      const code = error instanceof ApiError ? error.code : message.match(/^([A-Z][A-Z0-9_]+):/)?.[1] ?? 'MCP_VALIDATION_ERROR'
      const retryable = error instanceof ApiError ? error.retryable : false
      const details = error instanceof ApiError ? error.details : validationDetails(name, args, message)
      const errorPayload = { error: { code, message, retryable, details } }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(errorPayload) }],
        structuredContent: errorPayload,
        isError: true,
      }
    }
  })

  return server
}

/**
 * Trata uma requisição do transporte Streamable HTTP (stateless, resposta JSON).
 *
 * Em modo stateless o SDK exige transporte fresco por requisição; por isso o
 * servidor e o transporte são criados a cada chamada, sem afinidade de sessão
 * (permite escala horizontal). `enableJsonResponse` evita SSE e reduz a
 * exposição a buffering/timeout em nginx/Cloudflare Tunnel.
 */
export async function handleMcpHttpRequest(request: Request, apiCall: ApiCall, options: McpServerOptions = {}): Promise<Response> {
  const server = createMcpServer(apiCall, options)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  try {
    return await transport.handleRequest(request, {
      authInfo: { token: '', clientId: options.context?.userId ?? 'mcp', scopes: [] },
    })
  } finally {
    await transport.close().catch(() => {})
    await server.close().catch(() => {})
  }
}
