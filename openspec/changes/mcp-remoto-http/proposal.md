# Proposal

> Rastreamento: Board ref: `8cd2dda1-154d-4d76-baab-7cc5ea0af53e` (card T62 — Azyboard)

## Why

Hoje o servidor MCP do Azy Board opera **somente por transporte stdio**: cada cliente de code agent precisa subir um processo local (`apps/mcp/mcp-server.ts`), com a API Key e o projeto padrão em variáveis de ambiente. A instalação hospedada (ex.: `azyboard.jairo.tools`) não oferece MCP nenhum por URL, então não há como um code agent se conectar ao Azy Board do servidor sem montar um processo na própria máquina. Queremos um MCP remoto vivendo junto da aplicação.

## What Changes

- Adicionar **transporte Streamable HTTP** ao servidor MCP, **hospedado no processo da API**, em um endpoint dedicado (`/mcp`), mantendo o transporte stdio existente para uso local/dev.
- Autenticar cada requisição HTTP pelo mesmo modelo de API Key do MCP atual (Bearer `azb_...`), resolvendo Owner, tenant, grupo global e escopos **no servidor**, a cada requisição; sem aceitar identidade vinda do payload e sem repassar a chave a terceiros (evita o anti-padrão de *token passthrough*).
- Reutilizar a execução compartilhada de ferramentas (`executeSharedTool`) via `ApiCall` **in-process**, preservando o catálogo único, as policies (`MCP_TOOL_POLICIES`) e o envelope de erro já usados por REST e pelo Azy Agent.
- Remover a dependência de **`AZYBOARD_PROJECT_ID` como configuração de ambiente do cliente** no modo remoto: o contexto de projeto passa a ser explícito (por sessão/argumento), pois não existe env por cliente em um servidor compartilhado.
- Aplicar **idempotência** por chamada mutável (mesmo padrão do agente) e permitir operação **stateless**, necessária para escala horizontal.
- Ajustar a fronteira arquitetural: a API passa a poder hospedar o adaptador de transporte MCP por meio de um **pacote neutro**, sem se acoplar ao app `apps/mcp`.
- Atualizar a **skill oficial** e a documentação de instalação para cobrir o modo remoto.
- **BREAKING** (de spec): o requisito de transporte exclusivamente stdio deixa de valer, e a API deixa de ser obrigada a compilar sem **qualquer** fonte MCP (passa a compilar sem as fontes de `apps/mcp`).

Fora de escopo nesta mudança: OAuth 2.1 / Protected Resource Metadata (fase 2). A autenticação inicial é por API Key.

## Capabilities

### New Capabilities
- `mcp-http-endpoint`: endpoint MCP remoto por Streamable HTTP — rota e método de acionamento, autenticação por requisição, isolamento multi-tenant, contexto de projeto, idempotência, operação stateless e envelope de erro.

### Modified Capabilities
- `mcp-server`: o requisito de transporte e autenticação deixa de exigir stdio exclusivo e passa a incluir o transporte Streamable HTTP hospedado.
- `transport-independent-tool-execution`: a fronteira "API compila e inicializa sem fontes MCP" passa a permitir que a API hospede o adaptador de transporte via pacote neutro.
- `official-agent-skill`: o roteiro de autoconfiguração do MCP e a regra de segurança da credencial passam a cobrir o modo remoto (URL + cabeçalho), além do modo stdio.

## Impact

- `apps/api`: novo endpoint `/mcp` e fiação de auth; **sem** dependência direta do SDK MCP (o acesso se dá pelo pacote neutro).
- Novo `packages/mcp-protocol`: core MCP (Server + handler Streamable HTTP) reutilizado por `apps/mcp` (stdio) e pela API (HTTP).
- `apps/mcp`: passa a ser adaptador fino do core; comportamento stdio preservado.
- `scripts/check-api-boundary.ts`: regra de fronteira revisada (permite o pacote neutro e o SDK como trânsito; mantém proibição de acoplar a `apps/mcp`).
- `docker/nginx-web.conf.template`, `docker/nginx-web-cloudflare.conf.template`, `docker/Caddyfile.production`, `DEPLOY.md`, `deploy/production/README.md`: rota `/mcp` com `proxy_buffering off` e timeouts adequados.
- `skills/azyboard/references/mcp-setup.md`, `apps/mcp/README.md`, `opencode.json.example`: modo remoto.
- Specs afetadas: `mcp-server`, `transport-independent-tool-execution`, `official-agent-skill`; nova `mcp-http-endpoint`.
- Sem novo serviço/container: reutiliza as imagens `api` e `web` já publicadas pelo CI.
