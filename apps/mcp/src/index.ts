/**
 * Servidor MCP do Azy Board — transporte stdio
 *
 * Configure no cliente MCP com:
 *   EASYBOARD_API_KEY=azb_xxx EASYBOARD_URL=http://localhost:3000 bun run apps/mcp/src/index.ts
 *
 * Projeto padrão (opcional):
 *   AZYBOARD_PROJECT_ID=<uuid ou nome exato> — pré-define o projeto desta codebase.
 *   Quando configurado, `projectId` torna-se opcional nas ferramentas e o
 *   servidor injeta o valor padrão em cada chamada.
 *
 * O catálogo oficial compartilhado vive em `registry.ts`; este arquivo é apenas
 * o adaptador de transporte stdio. Hierarquia, políticas e validação estão no
 * registry e em `validation.ts`.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import type { ApiCall } from './tools.js'
import { hasMcpPolicy } from './policies.js'
import { executeSharedTool, getSharedToolDefinitions, requiredFieldsFor, sanitizeToolOutput, type ToolDefinition } from './registry.js'

// [TENANT] API Key autentica o agente como o Owner humano vinculado — resolvido pelo middleware da API
export async function makeApiCall(apiUrl: string, apiKey: string, options: { timeoutMs?: number } = {}) {
  return async function apiCall(path: string, method = 'GET', body?: unknown) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000)
    let res: Response
    try {
      res = await fetch(`${apiUrl}/api${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/vnd.azyboard.agent+json',
          // [TENANT] API Key identifica o agente e o tenant — resolvido pelo authMiddleware
          Authorization: `Bearer ${apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
    } catch (error) {
      throw new ApiError('NETWORK_ERROR', error instanceof DOMException && error.name === 'AbortError' ? 'Tempo limite excedido' : 'Falha de comunicação com a API', true)
    } finally {
      clearTimeout(timeout)
    }

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
}

export class ApiError extends Error {
  constructor(readonly code: string, message: string, readonly retryable: boolean, readonly details: unknown = null) {
    super(message)
    this.name = 'ApiError'
  }
}

export type McpServerOptions = {
  /** Projeto padrão da codebase (AZYBOARD_PROJECT_ID). Torna `projectId` opcional nas ferramentas. */
  defaultProjectId?: string
}

// O schema interno (getSharedToolDefinitions) mantém todos os campos em `required`
// porque o OpenAI strict exige. Para clientes MCP, expõe apenas os campos realmente
// obrigatórios: os opcionais podem ser omitidos (e null também é aceito).
function withOptionalFields(tool: ToolDefinition): ToolDefinition {
  const mandatory = new Set(requiredFieldsFor(tool.name))
  const required = tool.inputSchema.required.filter(field => mandatory.has(field))
  if (required.length === tool.inputSchema.required.length) return tool
  return { ...tool, inputSchema: { ...tool.inputSchema, required } }
}

// [DEFAULT PROJECT] Com projeto padrão configurado, `projectId` vira opcional no schema.
function withOptionalProjectId(tool: ToolDefinition, defaultProjectId: string): ToolDefinition {
  if (!tool.inputSchema.required.includes('projectId')) return tool
  return {
    ...tool,
    description: `${tool.description} Se projectId for omitido, o projeto padrão pré-configurado é usado.`,
    inputSchema: {
      ...tool.inputSchema,
      required: tool.inputSchema.required.filter(field => field !== 'projectId'),
      properties: {
        ...tool.inputSchema.properties,
        projectId: { type: ['string', 'null'], description: `Opcional — padrão: projeto pré-configurado via AZYBOARD_PROJECT_ID (${defaultProjectId}). Aceita ID ou nome exato do projeto.` },
      },
    },
  }
}

export function createMcpServer(apiCall: ApiCall, options: McpServerOptions = {}) {
  const { defaultProjectId } = options
  const server = new Server(
    { name: 'azy-board', version: '1.0.0' },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: getSharedToolDefinitions()
      .map(withOptionalFields)
      .map(tool => defaultProjectId ? withOptionalProjectId(tool, defaultProjectId) : tool)
      .map(({ policy: _policy, namespace: _namespace, ...tool }) => tool),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params
    const args: Record<string, unknown> = { ...(request.params.arguments ?? {}) }
    // [DEFAULT PROJECT] injeta o projeto padrão da codebase quando projectId não é informado
    if (defaultProjectId && (args.projectId === undefined || args.projectId === null || args.projectId === '')) {
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
      // Both transports use the same executor. The API resolves this MCP owner
      // from the key; the internal adapter supplies the authenticated human.
      return ok(sanitizeToolOutput(await executeSharedTool(name, args, {
        api: apiCall,
        context: { source: 'mcp', userId: 'api-key-owner', tenantId: 'api-key-tenant', globalGroup: 'TEAM_MEMBER' },
      })))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      const code = error instanceof ApiError ? error.code : 'MCP_TOOL_ERROR'
      const retryable = error instanceof ApiError ? error.retryable : false
      const details = error instanceof ApiError ? error.details : null
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

if (import.meta.main) {
  const apiKey = process.env.EASYBOARD_API_KEY
  if (!apiKey) {
    console.error('EASYBOARD_API_KEY não configurada')
    process.exit(1)
  }
  const apiUrl = process.env.EASYBOARD_URL ?? 'http://localhost:3000'
  const defaultProjectId = process.env.AZYBOARD_PROJECT_ID?.trim() || undefined
  const apiCall = await makeApiCall(apiUrl, apiKey)
  const server = createMcpServer(apiCall, { defaultProjectId })
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
