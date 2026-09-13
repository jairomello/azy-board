## Why

As rotas da API retornam formatos de erro incompatíveis, e o middleware do Azy Agent transforma alguns deles novamente. Isso obriga cada consumidor a interpretar contratos diferentes e torna respostas de navegador, MCP e agente inconsistentes. A padronização reduz ambiguidade e deve acontecer antes de ampliar os consumidores automatizados.

## What Changes

- Definir um envelope único de erro: `error.code`, `error.message`, `error.retryable` e `error.details`.
- Centralizar a criação e serialização de erros HTTP, incluindo erros de validação, autenticação, autorização, recurso inexistente, conflito e falhas internas.
- Fazer MCP e Azy Agent propagarem o mesmo contrato sem converter a resposta para um formato paralelo.
- Garantir que mensagens expostas ao cliente sejam seguras e que detalhes internos permaneçam fora de produção.
- Documentar códigos, semântica de `retryable` e formato de `details` para consumidores humanos e agentes.
- **BREAKING** Alterar respostas de erro que hoje usam `error` como string ou colocam `code` e `retryable` no nível raiz.

## Capabilities

### New Capabilities

- `unified-error-contract`: contrato único e comportamento de erros para API, MCP e Azy Agent.

### Modified Capabilities

- `ai-api`: respostas de erro do Azy Agent passam a usar o envelope comum.
- `mcp-server`: erros devolvidos pelas ferramentas passam a usar o envelope comum.

## Impact

- Backend Bun/Hono: middleware, handlers e utilitários de erro em `apps/api/src`.
- Integração MCP em `apps/mcp/src` e catálogo de ferramentas.
- Tipos compartilhados e validação em `packages/types` e schemas de API.
- Frontend: parser de erros e mensagens/toasts que atualmente leem `error` como string.
- Testes de rotas, MCP, agente e smoke tests; documentação OpenSpec e eventual contrato OpenAPI.
