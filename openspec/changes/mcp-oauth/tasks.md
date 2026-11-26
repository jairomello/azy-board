# Tarefas — mcp-oauth

Board ref: 30737386-371d-4c7c-a9cd-d2b28613645a

## 1. Persistência

- [x] 1.1 Tabelas `oauth_clients`, `oauth_authorization_codes`, `oauth_grants` e `oauth_tokens` nos schemas SQLite e PostgreSQL, com migrations.
- [x] 1.2 Portas e adapters (SQLite e PostgreSQL): registrar client, criar e consumir code atomicamente, criar grant, emitir/rotacionar/revogar tokens, listar e revogar grants do usuário.

## 2. Authorization server

- [x] 2.1 Metadata: PRM geral, PRM por projeto e metadata do AS, derivados de `AZYBOARD_PUBLIC_URL` (fallback `FRONTEND_URL`), com CORS aberto sem credenciais; env documentada nos `.env.example` e compose.
- [x] 2.2 `POST /api/oauth/mcp/register` (DCR público, rate limit, `redirect_uris` obrigatório).
- [x] 2.3 `authorize/validate|approve|deny` só com sessão humana (recusa API Key e token OAuth): PKCE S256, `redirect_uri` exato, `resource` conhecido, escopo padrão e interseção com o papel do usuário.
- [x] 2.4 `POST /api/oauth/mcp/token` (`authorization_code` e `refresh_token` com rotação e detecção de reuso).
- [x] 2.5 `POST /api/oauth/mcp/revoke` e `GET/DELETE /api/oauth/mcp/grants` (grants só com sessão humana); `client_name` limitado e sanitizado.

## 3. MCP

- [x] 3.1 Validação `azo_` no MCP com recarga do usuário, checagem de audiência e escopos no contexto.
- [x] 3.2 `ApiCall` interno com identidade pré-resolvida via binding marcado por `Symbol`; repetir a checagem de `projectScope`; `/api/*` recusa `azo_`.
- [x] 3.3 Credencial de agente genérica (API Key ou OAuth) para origem `MCP`, ator `AGENT` e badge de IA; coluna do grant no claim.
- [x] 3.4 `WWW-Authenticate` em todo 401 do MCP.
- [x] 3.5 Rota `/mcp/projects/:projectId` com projeto fixado, rejeição de `projectId` divergente, ferramentas sem contexto de projeto ocultas e `list_projects` restrito.
- [x] 3.6 Headers `Deprecation`/`Link` e log para API Key no `/mcp`; aviso em stderr no stdio.

## 4. Web

- [x] 4.1 `ProtectedRoute` preserva o destino em `?redirect=` (apenas caminhos internos) e o login OIDC externo o mantém.
- [x] 4.2 Tela `/oauth/authorize`: app (nome e host do redirect, aviso de não verificado), conta, projeto (quando houver), escopos, aprovar/negar. i18n PT-BR/EN/ES.
- [x] 4.3 Seção "Conexões MCP" em Minha conta com revogação.
- [x] 4.4 Seção de API Keys com aviso de depreciação e orientação de conexão OAuth; URL do MCP do projeto copiável na tela do projeto.

## 5. Infra

- [x] 5.1 nginx (`nginx-web.conf.template` e `nginx-web-cloudflare.conf.template`): `/.well-known/oauth-*` e `/mcp` por prefixo para a API; proxy do Vite com `/.well-known`.

## 6. Skill e documentação

- [x] 6.1 Skill oficial (`SKILL.md`, `references/mcp-setup.md`, `references/setup-and-security.md`, `commands/setup-mcp.md`) com OAuth como padrão e API Key/stdio depreciados.
- [x] 6.2 `connect-mcp.mjs`: modo OAuth padrão (só URL, sem header) e modo API Key como opção depreciada.
- [x] 6.3 Guia da wiki e ajuda atualizados.
- [ ] 6.4 Delta de `mcp-setup-documentation` depois de arquivar `documenta-mcp-http-remoto` (pendente: depende do arquivamento).

## 7. Verificação

- [x] 7.1 Testes unitários: PKCE, validação do authorize, rotação/reuso de refresh (com janela de tolerância), audiência, escopos, recusa de credencial de agente no consentimento e nos grants.
- [x] 7.2 Teste e2e com o `Client` do SDK: DCR → approve → token → initialize → tools/call → refresh → revoke, geral e por projeto.
- [x] 7.3 Testes de regressão da API Key no MCP (remoto e stdio) com headers de depreciação.
- [x] 7.4 `bun run check` (etapas; testes com o Bun 1.3.14 do CI), `bun run test:agent-skill`, `bun run check:docs` e `bun run openspec:validate`.
- [x] 7.5 `bun run test:smoke` no ambiente local equivalente ao job `smoke` do CI.
- [x] 7.6 Jornada OAuth contra PostgreSQL real (`advanced-mcp-oauth.test.ts`, incluída no job `advanced`) e migrations PG aplicadas em banco novo.
