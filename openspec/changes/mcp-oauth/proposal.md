# OAuth no MCP e MCP por projeto

Board ref: 30737386-371d-4c7c-a9cd-d2b28613645a (T98 — Configurar Oauth no MCP)

## Problema

Hoje, para conectar um code agent ao MCP do Azy Board, o usuário precisa gerar
uma API Key em Minha conta, copiar o segredo e gravá-lo na configuração do
cliente (header `Authorization: Bearer azb_...` no modo remoto ou
`EASYBOARD_API_KEY` no stdio). Isso traz atrito, risco de vazar a chave em
arquivos versionados e uma credencial de longa duração que não expira por
padrão. Clientes MCP modernos (Claude Code, Claude.ai, Codex, OpenCode, Cursor)
já sabem autenticar com OAuth 2.1 a partir só da URL do servidor, sem segredo
copiado.

A change `mcp-remoto-http` deixou "OAuth 2.1 / Protected Resource Metadata"
explicitamente para uma fase 2. Esta change é essa fase 2.

O contexto de projeto no modo remoto também depende de um header customizado
(`X-Azyboard-Project-Id`), que muitos clientes não deixam configurar junto com
OAuth.

## Mudança

- O Azy Board passa a atuar como authorization server OAuth 2.1 do seu próprio
  MCP remoto: discovery (RFC 9728 e RFC 8414), registro dinâmico de cliente
  (RFC 7591), Authorization Code com PKCE S256, refresh token rotativo,
  revogação (RFC 7009) e indicação de recurso (RFC 8707).
- O usuário autoriza a conexão numa tela de consentimento do próprio Azy Board,
  usando a sessão já logada (local, Microsoft ou Google). Nenhum segredo é
  copiado.
- O token OAuth só vale no MCP; não autentica a API REST.
- Novo MCP por projeto em `/mcp/projects/{projectId}`: a URL fixa o projeto
  de contexto, e o token emitido para essa URL fica restrito àquele projeto.
- Minha conta ganha a lista de "Conexões MCP" (apps autorizados) com revogação.
- API Key no MCP (remoto e stdio) continua funcionando sem mudança de
  comportamento, mas passa a ser **depreciada**: respostas do `/mcp` com API
  Key trazem `Deprecation`/`Link`, o stdio avisa no início, e UI, skill e
  documentação passam a recomendar OAuth. Não há data de remoção nesta change.

## Fora de escopo

- Remover a API Key ou o transporte stdio.
- Depreciar API Key no uso REST direto por agentes (`ai-api`) fora do MCP.
- Clientes confidenciais (com `client_secret`), `client_credentials` e
  login federado direto no MCP.

## Impacto

- API: novas rotas `/.well-known/*` e `/api/oauth/mcp/*`, novo ramo de
  autenticação no MCP, rota `/mcp/projects/:projectId`, três tabelas novas
  (SQLite e PostgreSQL) e migrations.
- Web: rota `/oauth/authorize` (consentimento), redirect pós-login
  preservado, seção "Conexões MCP" e aviso de depreciação na seção de API Keys.
- Infra: nginx (dev e Cloudflare) passa a encaminhar `/.well-known/oauth-*` e
  `/mcp/*` para a API.
- Skill oficial, `connect-mcp.mjs`, guia da wiki e ajuda.
- Specs: nova capability `mcp-oauth`; deltas em `mcp-http-endpoint`,
  `mcp-server`, `auth`, `api-key-management` e `official-agent-skill`.
