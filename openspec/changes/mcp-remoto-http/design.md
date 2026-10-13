# Design

## Context

Ver `proposal.md - Why`. Estado atual relevante:

- `apps/mcp/src/index.ts` só instancia `StdioServerTransport`; monta `makeApiCall` batendo em `${EASYBOARD_URL}/api${path}` com `Authorization: Bearer <EASYBOARD_API_KEY>`.
- A execução compartilhada vive em `packages/tool-execution` (`executeSharedTool(name, args, { api })`), com `ApiCall` injetado; o catálogo/policies ficam em `packages/tool-registry`.
- A API (Bun + Hono) já sabe executar ferramentas **in-process**: `apps/api/src/services/workerContext.ts` cria um `ApiCall` que chama `app.fetch(new Request('http://azyboard.internal/api...'))`. Hoje ele assina um **JWT sintético do usuário** — não serve para o MCP, que deve preservar a identidade da API Key.
- `apps/api/src/middleware/auth.ts` resolve Owner, tenant, grupo e escopos a partir da API Key (Bearer) e revalida a cada request; `projectScope` é checado contra o parametro de rota `:projectId`.
- `scripts/check-api-boundary.ts` proíbe a API de importar/depender de `apps/mcp` ou do SDK MCP, e exige build isolada sem fontes MCP.
- SDK instalado: `@modelcontextprotocol/sdk@1.29.0`, que expõe `WebStandardStreamableHTTPServerTransport` (Streamable HTTP, Web Standards) com exemplo oficial de uso em Hono e suporte a modo stateless, resposta JSON (sem SSE) e `authInfo` por request.
- Deploy: Cloudflare Tunnel → Caddy (`azyboard.jairo.tools`) → nginx (`/api`, `/ws`) → API. VPS de ~1 GB.

## Goals / Non-Goals

**Goals:**
- MCP remoto acessível por URL, hospedado no mesmo serviço da API, com o mesmo catálogo, policies e envelope de erro dos acessos REST/agente.
- Autenticação por API Key a cada requisição, com isolamento de tenant/projeto/permissão preservado.
- Preservar o transporte stdio local e a fronteira que mantém a camada de execução e o catálogo sem dependência de transporte.
- Operar atrás de Cloudflare Tunnel + Caddy + nginx sem nova infraestrutura (sem container/imagem/serviço adicional).

**Non-Goals:**
- OAuth 2.1 / Protected Resource Metadata (fase 2).
- Substituir ou remover o transporte stdio.
- Rate limiting e orçamento por chave (pode entrar como fase própria).
- Agregação de MCPs de terceiros / gateway.

## Decisions

### D1. MCP embutido no processo da API (não serviço separado)
Um único *resource server*: a API valida a própria credencial e executa; evita o anti-padrão de *token passthrough* e reusa auth/RBAC/tenant/observabilidade. Alternativas: serviço MCP separado (rejeitado: +container/imagem/CI na VPS de 1 GB e, para ser seguro, exigiria o serviço virar resource server OAuth próprio — mais trabalho que embutir).

### D2. Core MCP em pacote neutro `packages/mcp-protocol`
Extrair de `apps/mcp/src/index.ts` o `createMcpServer`, os wrappers de schema e o tratamento de `ok`/erro para um pacote que concentra a dependência do SDK MCP. `apps/mcp` (stdio) e a API (HTTP) viram adaptadores finos. Isso mantém `tool-execution`/`tool-registry` livres de transporte e evita duplicar regra. Alternativas: mover para `tool-execution` (rejeitado: viola a pureza do pacote) ou duplicar na API (rejeitado: duas fontes de verdade).

### D3. Transporte Streamable HTTP via SDK, montado no Hono
Usar `WebStandardStreamableHTTPServerTransport` (Web Standards; roda no Bun) montado como rota (`app.all('/mcp', c => transport.handleRequest(c.req.raw))`). Alternativa: SSE legado (rejeitado: transporte depreciado).

### D4. Modo stateless + resposta JSON (sem SSE por padrão)
Configurar `sessionIdGenerator: undefined` (stateless) e `enableJsonResponse: true`. Motivo: clientes MCP não mantêm cookie de sessão, então afinidade de sessão não é confiável em múltiplas instâncias; e respostas JSON evitam buffering/timeout de SSE no nginx e no Cloudflare Tunnel. Alternativa: stateful com sticky session (rejeitado).

### D5. Autenticação por API Key a cada requisição
A rota `/mcp` passa pela mesma resolução de credencial do `authMiddleware`. A sessão do protocolo nunca autentica; nenhum campo de identidade vem do payload; a chave nunca é repassada a terceiros nem logada. OAuth fica para a fase 2.

### D6. `ApiCall` in-process com a identidade da chave (não o JWT do worker)
Criar um adaptador que chama `app.fetch(new Request('http://azyboard.internal/api...', { Authorization: 'Bearer <chave recebida>' }))`, preservando `projectScope`/`permissionScope`/tenant nas rotas REST. **Não** reusar `createWorkerToolApi` (ele assina JWT de usuário e perderia o escopo da chave). Para cada mutação, enviar `Idempotency-Key` (padrão já usado pelo agente). Alternativa: assinar JWT do Owner (rejeitado: descaracteriza a chave e o escopo).

### D7. Contexto de projeto explícito no modo remoto
`AZYBOARD_PROJECT_ID` (env) não existe no servidor. `projectId` é argumento explícito; opcionalmente o cliente fornece um projeto de contexto na inicialização, aplicado apenas às ferramentas com `projectId` opcional.

### D8. Rota no topo (`/mcp`), fora de `/api`
O corpo do MCP é JSON-RPC, não o envelope REST; por isso a rota fica fora do `basePath('/api')` e não passa pelo `agentResponseMiddleware`, mas continua sujeita aos middlewares globais (security headers, observabilidade, error handler, client IP) e à resolução de credencial.

### D9. Fronteira revisada no gate da API
`scripts/check-api-boundary.ts` passa a: (a) permitir `@azy-board/mcp-protocol` como dependência da API e o SDK MCP como trânsito do pacote neutro; (b) manter proibido importar/depender de `apps/mcp`; (c) manter a build isolada da API sem fontes de `apps/mcp`, incluindo o pacote neutro no staging.

### D10. Deploy sem container novo
nginx: `location = /mcp` com `proxy_buffering off`, `proxy_http_version 1.1`, `Connection ''`, `proxy_read_timeout 300s`. Caddy e Tunnel inalterados (path no mesmo host). `enableJsonResponse` reduz a exposição a timeout de streaming. O endpoint pode ser desabilitado por variável de ambiente para rollback rápido.

### D11. Endurecimento do contexto do executor
`assertHumanContext` passa a exigir identidade resolvida no servidor também para `source='mcp'` (hoje só valida `source='azy-agent'`), como defesa em profundidade contra contexto forjado no executor. O `ApiCall` do MCP continua recusando identidade/tenant/grupo vindos dos argumentos da ferramenta.

### D12. Rate limiting fora desta mudança
O endpoint remoto entrega a autenticação e a revalidação por requisição, mas o limite de chamadas por chave/tenant fica como **fase própria** (reuso do coordination port), para manter esta mudança focada no transporte e na fronteira.

## Risks / Trade-offs

- **Perda do isolamento "API sem MCP"** (a API passa a carregar o SDK via pacote neutro) → mitigação: SDK concentrado no pacote neutro, gate de build isolada adaptado, testes de fronteira e de boot.
- **Escopo de projeto não aplicado** se a execução deixar de passar pelas rotas REST `:projectId` → mitigação: o `ApiCall` do MCP chama `app.fetch` nas rotas REST (não o caso de uso direto), e há teste de escopo negado.
- **Credencial em log/erro** → mitigação: nunca logar a chave; sanitização de saída; erro normalizado.
- **Direção de sessão/estado em escala** → mitigação: modo stateless.
- **Buffering/timeout de SSE no nginx/Tunnel** → mitigação: resposta JSON por padrão e timeouts configurados.
- **`assertHumanContext` tolera `source='mcp'`** (não valida identidade) → decisão de endurecer para exigir contexto resolvido no servidor; registrar em tasks.
- **Endpoint público** → mitigação: auth por request já revalida revogação/grupo; rate limit fica como fase própria.

## Migration Plan

Sem migração de dados.

1. Adicionar `packages/mcp-protocol` e refatorar `apps/mcp` para adaptador fino (stdio inalterado).
2. Ajustar `check-api-boundary` e os testes de fronteira.
3. Montar `/mcp` na API com auth e `ApiCall` in-process; adicionar testes (handshake, 401, `tools/list`, `tools/call`, escopo negado).
4. Ajustar nginx, docs e skill.
5. Deploy reutilizando as imagens `api`/`web`.

Rollback: desabilitar o endpoint por variável de ambiente (sem remover o pacote) e reverter a rota no nginx; o transporte stdio permanece funcional durante toda a transição.

## Open Questions

- Snippets exatos de configuração por cliente (Claude Code, Codex, OpenCode) a fixar na skill.
