# Design — OAuth no MCP e MCP por projeto

Board ref: 30737386-371d-4c7c-a9cd-d2b28613645a

## Referência

O Meeting Minds já tem MCP com OAuth e MCP por projeto (NestJS). Este design
reaproveita o fluxo de lá (consentimento no SPA, DCR público, PKCE S256,
audiência por recurso) e corrige as lacunas registradas como achados abertos
naquele projeto:

| Lacuna no Meeting Minds | Decisão aqui |
| --- | --- |
| 401 da rota geral sem `WWW-Authenticate` | Todo 401 do MCP traz `WWW-Authenticate` com `resource_metadata` |
| `aud` do token diferente do `resource` anunciado | `aud` é exatamente o `resource` anunciado |
| `resource` não passa pelo authorize (consentimento não mostra o projeto) | `resource` é validado no authorize, exibido no consentimento e preso ao code |
| `resource` desconhecido é aceito | `resource` desconhecido gera `invalid_target` |
| Pedido sem `scope` gera token sem tools | Sem `scope`, aplica o padrão `read write` |
| JWT 90 dias sem refresh; revogação por blacklist em Redis | Token opaco curto + refresh rotativo, persistido no banco |

## Decisões

### 1. Authorization server próprio em Hono

O módulo de auth do `@modelcontextprotocol/sdk` (1.29) é acoplado a Express
(`express`, `cors`, `express-rate-limit`). A API é Hono sobre Bun, então as
rotas são escritas à mão. Do SDK aproveitamos apenas schemas/tipos de metadata
e, nos testes, o `Client` com o provider OAuth para exercitar o fluxo real.

### 2. Rotas e URLs públicas

A API não conhece o base path hoje: ele é injetado pelo proxy no SPA
(`window.__BASE_PATH__`), e `FRONTEND_URL` é só a origem usada no CORS. Por
isso entra a env `AZYBOARD_PUBLIC_URL` (origem pública + base path, ex.:
`https://host/azyboard`). Sem ela, usa-se `FRONTEND_URL` (instalação na raiz).
O issuer é essa URL; quando ela tem path, o metadata do AS segue a inserção do
RFC 8414 (`/.well-known/oauth-authorization-server/azyboard`).

| Rota | Função |
| --- | --- |
| `GET /.well-known/oauth-protected-resource/mcp` | PRM do MCP geral (RFC 9728, inserção de path) |
| `GET /.well-known/oauth-protected-resource/mcp/projects/:projectId` | PRM do MCP de projeto, sem consultar o banco |
| `GET /.well-known/oauth-protected-resource` | PRM do MCP geral (fallback de clientes antigos) |
| `GET /.well-known/oauth-authorization-server` | Metadata do AS (RFC 8414) |
| `POST /api/oauth/mcp/register` | DCR público (`token_endpoint_auth_method=none`) |
| `POST /api/oauth/mcp/token` | `authorization_code` e `refresh_token` |
| `POST /api/oauth/mcp/revoke` | Revogação (RFC 7009) |
| `GET /oauth/authorize` (SPA) | `authorization_endpoint`; tela de consentimento |
| `GET/POST /api/oauth/mcp/authorize/{validate,approve,deny}` | Chamadas da tela, autenticadas pelo cookie de sessão |
| `GET/DELETE /api/oauth/mcp/grants` | Conexões MCP do usuário (lista e revogação) |
| `ALL /mcp/projects/:projectId` | MCP por projeto |

Com base path (ex.: `/azyboard`), o PRM segue a inserção do RFC 9728:
`/.well-known/oauth-protected-resource/azyboard/mcp`. O nginx da instalação
na raiz do host precisa encaminhar esse caminho; isso fica documentado.

**Por que o authorize é rota do SPA:** o cookie de sessão é `SameSite=Strict`.
Uma navegação vinda do cliente (outra origem) não leva o cookie no GET inicial,
mas o SPA carrega e as chamadas `fetch` seguintes já são da mesma origem e
levam o cookie. Isso também reaproveita o login (local, Microsoft, Google) sem
duplicar fluxo. O `ProtectedRoute` hoje manda para `/login` sem preservar o
destino; passa a enviar `?redirect=<path+query>`, e o fluxo OIDC externo
preserva esse destino no cookie `oauth_flow`. O redirect só aceita caminhos
relativos da própria aplicação.

**nginx:** adicionar `location ^~ /.well-known/oauth-` e trocar
`location = /mcp` por `location /mcp` (mantendo buffering desligado) nos
templates `nginx-web.conf.template` e `nginx-web-cloudflare.conf.template`.
Em desenvolvimento, o proxy do Vite ganha `/.well-known` (o `/mcp` já é
prefixo e cobre `/mcp/projects/*`).

**CORS:** discovery, `register`, `token` e `revoke` aceitam qualquer origem,
sem credenciais, para clientes MCP que rodam no navegador. As rotas
`authorize/*` e `grants` continuam presas à origem da aplicação.

**Só sessão humana aprova e gerencia conexões:** `authorize/approve|deny` e
`grants` exigem o cookie de sessão e recusam API Key e token OAuth. Sem essa
regra, uma API Key restrita poderia aprovar um grant para o próprio Owner e
obter um token sem as restrições da chave.

### 3. Persistência: token opaco no banco

O perfil SIMPLE não tem Redis, então tudo fica no banco (Drizzle, SQLite e
PostgreSQL, com migrations nos dois):

- `oauth_clients`: `id`, `client_name`, `redirect_uris` (JSON),
  `created_at`, `last_used_at`. Sem tenant: o client é público e global;
  o tenant vem do usuário no consentimento.
- `oauth_authorization_codes`: `code_hash`, `client_id`, `tenant_id`,
  `user_id`, `redirect_uri`, `code_challenge`, `scope`, `resource`,
  `expires_at` (5 min). Consumo atômico (delete … returning).
- `oauth_grants`: uma conexão autorizada (`tenant_id`, `user_id`,
  `client_id`, `scope`, `resource`, `created_at`, `last_used_at`,
  `revoked_at`).
- `oauth_tokens`: `token_hash` (SHA-256, como `api_keys`), `grant_id`,
  `kind` (`ACCESS`|`REFRESH`), `expires_at`, `used_at` (refresh),
  `revoked_at`.

Prefixos: `azo_` (access) e `azr_` (refresh). O prefixo separa o caminho de
validação do `azb_` da API Key sem consulta extra.

TTL: access **1 h**, refresh **30 dias**, com rotação a cada uso. Reapresentar
um refresh já usado revoga o grant inteiro (detecção de reuso). Revogar um
grant invalida todos os tokens dele na próxima requisição.

**Por que opaco e não JWT:** revogação imediata, lista de conexões por usuário
e nenhum segredo de assinatura novo para gerenciar. O custo é uma consulta por
requisição, a mesma que a API Key já faz.

### 4. Escopos

Os escopos reaproveitam o vocabulário do `permissionScope` da API Key
(`API_KEY_PERMISSIONS`): `read`, `write`, `admin`, `delete`. O escopo
concedido é **pedido ∩ conhecido** (padrão `read write` quando ausente). O
papel do usuário não entra na concessão, porque é por projeto e o MCP geral não
tem projeto no consentimento; ele continua sendo aplicado em cada chamada, como
já acontece com a API Key (`hasKeyPermission` + membership).

O escopo do grant entra no contexto como `permissionScope` e o recurso de
projeto como `projectScope = [projectId]`. `requireRole` e as rotas que leem
`apiKeyPermissionScope` funcionam sem mudança; a checagem de `projectScope`,
que hoje fica no ramo de API Key do `authMiddleware` (params `projectId`/
`id`), precisa ser repetida no ramo de identidade pré-resolvida.

### 5. Token só vale no MCP

O `/mcp` hoje reapresenta o mesmo `Authorization` às rotas REST
(`createMcpApiCall`). Para o token OAuth não virar credencial da API inteira:

- O `authMiddleware` de `/api/*` recusa `azo_` com 401.
- O router do MCP valida o token e resolve a identidade; o `ApiCall` interno
  passa a identidade já resolvida pelo segundo argumento de
  `app.fetch(request, env)` (bindings do Hono). O `Bun.serve` já passa
  `{ server }` nesse argumento, então o `authMiddleware` só aceita a
  identidade pré-resolvida quando o binding traz um marcador específico (um
  `Symbol` privado do módulo do MCP), nunca por "env preenchido".
- Com API Key, o comportamento atual (reapresentar o header) é mantido.

### 6. Atribuição de agente

Hoje `apiKeyId` marca a origem `MCP` e o ator `AGENT`, e `aiModelName`
alimenta o badge de IA. O `client_name` do DCR vira texto de UI, então é
limitado (ex.: 100 caracteres) e sanitizado no registro. O contexto ganha uma credencial de agente genérica
(`{ kind: 'API_KEY' | 'OAUTH', id, name, aiModelName }`). Para OAuth,
`id` é o grant e `aiModelName` é o `client_name` registrado no DCR. Onde
`apiKeyId` é persistido (claim do item), o grant fica numa coluna própria
nullable; as checagens de origem passam a olhar a credencial genérica.

### 7. Validação no MCP e 401

Ordem no `/mcp` e `/mcp/projects/:id`:

1. `Bearer azo_` → token ACCESS válido, não expirado, grant não revogado,
   usuário ativo recarregado do banco, `aud` compatível com a rota.
2. `Bearer azb_` → caminho atual de API Key + headers de depreciação.
3. Qualquer outro caso → 401 com
   `WWW-Authenticate: Bearer resource_metadata="<PRM da rota>"` (e
   `error="invalid_token"` quando houve token).

Compatibilidade de audiência: rota de projeto aceita token do próprio projeto
e token geral; rota geral aceita só token geral.

### 8. MCP por projeto

`/mcp/projects/:projectId` reutiliza `handleMcpHttpRequest` com
`defaultProjectId` vindo do caminho. Na rota de projeto, um `projectId`
explícito diferente nos argumentos é rejeitado. Projeto inexistente, de outro
tenant ou sem acesso responde do mesmo jeito (sem revelar existência).
Ferramentas sem contexto de projeto (`create_project` e administração global)
não são listadas nem executáveis na rota de projeto; `list_projects` retorna
só o projeto do caminho. O
header `X-Azyboard-Project-Id` continua aceito na rota geral. A UI do projeto
oferece a URL do MCP do projeto para copiar.

### 9. Depreciação da API Key no MCP

- `/mcp` com `azb_`: headers `Deprecation: true` e
  `Link: <url da doc>; rel="deprecation"`, mais log estruturado
  (`mcp.api_key_deprecated`) com `apiKeyId`, sem o segredo.
- stdio: aviso em stderr ao iniciar, apontando para o MCP remoto com OAuth.
- UI de API Keys: aviso de depreciação e atalho para a conexão OAuth.
- Skill, `connect-mcp.mjs`, wiki e ajuda: OAuth como caminho padrão; API Key
  e stdio como alternativa depreciada.
- Sem data de remoção nesta change.

## Riscos

- Detecção de reuso do refresh: dois processos do mesmo cliente renovando ao
  mesmo tempo revogariam a conexão. Mitigação: janela de tolerância curta
  (ex.: 30 s) em que o refresh recém-rotacionado devolve o mesmo par novo.

- Clientes que não suportam OAuth no MCP continuam precisando da API Key
  (por isso só depreciação).
- DCR aberto permite registro de clients arbitrários; mitigação: rate limit,
  `redirect_uri` exato, consentimento explícito com aviso de "app não
  verificado" mostrando o host do redirect.
- O delta de `mcp-setup-documentation` não entra aqui porque essa capability
  ainda está na change ativa `documenta-mcp-http-remoto`. Depois de arquivá-la,
  o guia deve ganhar um delta próprio.
