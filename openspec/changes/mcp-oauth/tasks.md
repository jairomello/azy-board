# Tarefas — mcp-oauth

Board ref: 30737386-371d-4c7c-a9cd-d2b28613645a

## 1. Persistência

- [ ] 1.1 Tabelas `oauth_clients`, `oauth_authorization_codes`, `oauth_grants` e `oauth_tokens` nos schemas SQLite e PostgreSQL, com migrations.
- [ ] 1.2 Portas e adapters (SQLite e PostgreSQL): registrar client, criar e consumir code atomicamente, criar grant, emitir/rotacionar/revogar tokens, listar e revogar grants do usuário.

## 2. Authorization server

- [ ] 2.1 Metadata: PRM geral, PRM por projeto e metadata do AS, derivados de `AZYBOARD_PUBLIC_URL` (fallback `FRONTEND_URL`), com CORS aberto sem credenciais; env documentada nos `.env.example` e compose.
- [ ] 2.2 `POST /api/oauth/mcp/register` (DCR público, rate limit, `redirect_uris` obrigatório).
- [ ] 2.3 `authorize/validate|approve|deny` só com sessão humana (recusa API Key e token OAuth): PKCE S256, `redirect_uri` exato, `resource` conhecido, escopo padrão e interseção com o papel do usuário.
- [ ] 2.4 `POST /api/oauth/mcp/token` (`authorization_code` e `refresh_token` com rotação e detecção de reuso).
- [ ] 2.5 `POST /api/oauth/mcp/revoke` e `GET/DELETE /api/oauth/mcp/grants` (grants só com sessão humana); `client_name` limitado e sanitizado.

## 3. MCP

- [ ] 3.1 Validação `azo_` no MCP com recarga do usuário, checagem de audiência e escopos no contexto.
- [ ] 3.2 `ApiCall` interno com identidade pré-resolvida via binding marcado por `Symbol`; repetir a checagem de `projectScope`; `/api/*` recusa `azo_`.
- [ ] 3.3 Credencial de agente genérica (API Key ou OAuth) para origem `MCP`, ator `AGENT` e badge de IA; coluna do grant no claim.
- [ ] 3.4 `WWW-Authenticate` em todo 401 do MCP.
- [ ] 3.5 Rota `/mcp/projects/:projectId` com projeto fixado, rejeição de `projectId` divergente, ferramentas sem contexto de projeto ocultas e `list_projects` restrito.
- [ ] 3.6 Headers `Deprecation`/`Link` e log para API Key no `/mcp`; aviso em stderr no stdio.

## 4. Web

- [ ] 4.1 `ProtectedRoute` preserva o destino em `?redirect=` (apenas caminhos internos) e o login OIDC externo o mantém.
- [ ] 4.2 Tela `/oauth/authorize`: app (nome e host do redirect, aviso de não verificado), conta, projeto (quando houver), escopos, aprovar/negar. i18n PT-BR/EN/ES.
- [ ] 4.3 Seção "Conexões MCP" em Minha conta com revogação.
- [ ] 4.4 Seção de API Keys com aviso de depreciação e orientação de conexão OAuth; URL do MCP do projeto copiável na tela do projeto.

## 5. Infra

- [ ] 5.1 nginx (`nginx-web.conf.template` e `nginx-web-cloudflare.conf.template`): `/.well-known/oauth-*` e `/mcp` por prefixo para a API; proxy do Vite com `/.well-known`.

## 6. Skill e documentação

- [ ] 6.1 Skill oficial (`SKILL.md`, `references/mcp-setup.md`, `references/setup-and-security.md`, `commands/setup-mcp.md`) com OAuth como padrão e API Key/stdio depreciados.
- [ ] 6.2 `connect-mcp.mjs`: modo OAuth padrão (só URL, sem header) e modo API Key como opção depreciada.
- [ ] 6.3 Guia da wiki e ajuda; delta de `mcp-setup-documentation` depois de arquivar `documenta-mcp-http-remoto`.

## 7. Verificação

- [ ] 7.1 Testes unitários: PKCE, validação do authorize, rotação/reuso de refresh (com janela de tolerância), audiência, escopos, recusa de credencial de agente no consentimento e nos grants.
- [ ] 7.2 Teste e2e com o `Client` do SDK: DCR → approve → token → initialize → tools/call → refresh → revoke, geral e por projeto.
- [ ] 7.3 Testes de regressão da API Key no MCP (remoto e stdio) com headers de depreciação.
- [ ] 7.4 `bun run check`, `bun run test:smoke`, `bun run test:agent-skill`, `bun run check:docs` e `bun run openspec:validate`.
