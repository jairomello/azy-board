## Why

Os contratos compartilhados (tool registry, policies, validation e types) vazam entre aplicações por caminhos relativos de código-fonte (`apps/api` importa `apps/mcp/src/{registry,policies,validation}.js` sem declarar dependência). Isso impede builds independentes, torna o Docker frágil (imagem que copie só `apps/api` falha) e permite drift de tipos: `@azy-board/types` declara `AssistantProvider = 'OPENAI'` enquanto schema, backend e frontend usam `'OPENAI' | 'OPENROUTER'`. O arquivo `packages/types/src/index.ts` (389 linhas) mistura domínio, transporte, UI, WebSocket, Dashboard e contratos do assistente num único barrel.

## What Changes

- Extrair o tool registry (definições, schemas, policies, validation, limits) de `apps/mcp/src/` para `packages/tool-registry`, eliminando os imports relativos `../../../mcp/src/...` da API e dos scripts.
- Separar `@azy-board/types` em packages por domínio: `packages/domain` (enums de entidade), `packages/api-contracts` (transporte HTTP, erros, auth), `packages/realtime-contracts` (WebSocket), `packages/assistant-contracts` (assistente + limits) e `packages/ui-contracts` (preferências, presentation helpers, board adapter).
- Corrigir o drift de `AssistantProvider` para `'OPENAI' | 'OPENROUTER'` e eliminar tipos locais duplicados no frontend e na API.
- Adicionar `@azy-board/tool-registry` como dependência declarada de `apps/api` e `apps/mcp`.
- **BREAKING**: imports de `@azy-board/types` serão substituídos por imports dos novos packages; um barrel de compatibilidade (`@azy-board/types` re-exportando tudo) será mantido temporariamente para suavizar a migração.

## Capabilities

### New Capabilities
- `shared-package-architecture`: organização de contratos compartilhados em packages do monorepo, com dependências declaradas, regras de import e barrel de compatibilidade.
- `tool-registry-package`: extração do tool registry (definições, schemas, policies, validation) para `packages/tool-registry`, com API pública estável e sem acoplamento a transporte HTTP.

### Modified Capabilities
- `mcp-tool-registry`: a fonte do registro passa de `apps/mcp/src/registry.ts` para `packages/tool-registry`; os consumidores (API, MCP, scripts) importam por nome de package em vez de caminho relativo.
- `mcp-permissions`: policies (`MCP_TOOL_POLICIES`) passam a viver em `packages/tool-registry` em vez de `apps/mcp/src/policies.ts`.

## Impact

- **Packages novos**: `packages/tool-registry`, `packages/domain`, `packages/api-contracts`, `packages/realtime-contracts`, `packages/assistant-contracts`, `packages/ui-contracts`.
- **Apps afetados**: `apps/api` (~25 arquivos importam `@azy-board/types`, 3 importam `apps/mcp/src/*`), `apps/mcp` (registry, policies, validation movidos), `apps/web` (~40 arquivos importam `@azy-board/types`).
- **Scripts afetados**: `scripts/docs/generators.ts`, `scripts/check-mcp-catalog.ts` (imports de `apps/mcp/src/registry.ts`).
- **Testes**: `apps/mcp/src/{registry-contract,optional-fields}.test.ts` migram junto do registry; testes de fronteira de import podem ser adicionados a `check:persistence`.
- **Build**: `bun run typecheck` precisa rodar novos packages antes dos apps; Dockerfiles podem copiar packages independentemente.
- **Rastreabilidade**: Board ref: `bd924277-9184-453a-88e6-7fe596af7b29` (Item 26+27 fundidos).
