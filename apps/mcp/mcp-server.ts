#!/usr/bin/env bun
/**
 * Entrypoint dedicado do servidor MCP do Azy Board.
 *
 * Existe para dar ao processo um nome distinto de `apps/mcp/src/index.ts`:
 * limpezas amplas de desenvolvimento (`pkill -f "src/index.ts"`) matavam o MCP
 * no meio da sessão do harness, que não reconecta. Aponte o cliente MCP para
 * este arquivo.
 *
 *   EASYBOARD_API_KEY=azb_xxx EASYBOARD_URL=http://localhost:3000 \
 *     bun run apps/mcp/mcp-server.ts
 */

import { startStdioServer } from './src/index.js'

await startStdioServer()
