/**
 * Servidor MCP do Azy Board — adaptador de transporte stdio.
 *
 * Configure no cliente MCP com:
 *   EASYBOARD_API_KEY=azb_xxx EASYBOARD_URL=http://localhost:3000 bun run apps/mcp/src/index.ts
 *
 * Projeto padrão (opcional):
 *   AZYBOARD_PROJECT_ID=<uuid ou nome exato> — pré-define o projeto desta codebase.
 *   Quando configurado, `projectId` torna-se opcional nas ferramentas e o
 *   servidor injeta o valor padrão em cada chamada.
 *
 * O core do protocolo (servidor de ferramentas, schemas opcionais, envelope de
 * erro) vive em `@azy-board/mcp-protocol`; este arquivo é apenas o adaptador
 * stdio: resolve a configuração local e injeta o `ApiCall` HTTP.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer, parseApiResponse, ApiError } from '@azy-board/mcp-protocol'

// Reexportado para compatibilidade com consumidores/testes existentes.
export { createMcpServer, ApiError } from '@azy-board/mcp-protocol'
export type { McpServerOptions, McpResolvedContext } from '@azy-board/mcp-protocol'

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
    return parseApiResponse(res)
  }
}

// Bootstrap do transporte stdio. Extraído para permitir um entrypoint dedicado
// (`apps/mcp/mcp-server.ts`) com nome de processo distinto de `src/index.ts`,
// evitando que limpezas amplas como `pkill -f "src/index.ts"` derrubem o MCP.
export async function startStdioServer(): Promise<void> {
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

if (import.meta.main) {
  await startStdioServer()
}
