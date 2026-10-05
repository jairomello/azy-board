## Context

A autenticação atual (`apps/api/src/services/auth.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/middleware/auth.ts`) é um único JWT HS256 com TTL **fixo de 1 h** (`JWT_TTL = '1h'`), gravado no cookie `session` com `maxAge: 3600` e atributos HttpOnly, `Secure` somente em produção, SameSite=Strict, path=`/`. Não há refresh token, sessão server-side nem renovação deslizante; o logout apenas apaga o cookie. No frontend, `AuthContext` revalida a sessão com `GET /auth/me` no mount e `ProtectedRoute` redireciona para `/login` quando não há usuário; o cliente HTTP trata qualquer 401 (exceto `/auth/me`) com `window.location.href` para `/login?redirect=`.

O `authMiddleware` já carrega o usuário do banco a cada requisição (para montar o `RequestContext`) e o `index.ts` reverifica o JWT no handshake do WebSocket. As specs `auth` (TTL de 1 h no cenário de login) e `login-security` (rate limiting, progressivo, auditoria, política de senha) são o contrato vigente.

Restrições: segredo em `JWT_SECRET`; cookie é HttpOnly (o JS não o acessa); multi-tenant derivado da identidade; sem dependências novas; i18n obrigatório em PT-BR/EN/ES; verificação por `bun run check` e `bun run test:smoke`.

**Board ref:** `a4cb11fa-1c47-45a3-97f2-443155ef37e7` (T31).

## Goals / Non-Goals

**Goals:**

- Sessão padrão com duração mínima de **24 h**, configurável, sem exigir login a cada hora.
- Opção **"lembrar-me"** na tela de login que (1) mantém o dispositivo conectado por período estendido (padrão 30 dias) e (2) lembra o e-mail para o próximo login.
- Renovação deslizante para dispositivos usados com frequência, com **limite absoluto** que obriga novo login.
- Atributos de segurança do cookie mantidos (HttpOnly; Secure em produção; SameSite=Strict; path=/); logout continua encerrando a sessão.
- Cobertura de testes determinística (relógio controlado) e documentação das variáveis de ambiente.

**Non-Goals:**

- Não introduz refresh tokens, tabela de sessões, rotação de tokens nem revogação server-side por sessão (JWT permanece stateless).
- Não adiciona "lembrar-me" para agentes/API Keys nem SSO/2FA.
- Não cria tela de gerenciamento de dispositivos/sessões ativas.
- Não altera rate limiting, política de senha ou auditoria de login (`login-security`).
- Não persiste a senha em nenhum momento; somente o e-mail (quando "lembrar-me" está ativo).

## Decisions

### D1 — Duração: 1 h fixa → 24 h padrão e 30 dias lembrada, ambas configuráveis

Novas variáveis de ambiente com padrões seguros: `SESSION_TTL` (padrão `24h`) para sessão normal, `SESSION_REMEMBER_TTL` (padrão `30d`) para dispositivo lembrado e `SESSION_MAX_TTL` (padrão `180d`) como limite absoluto desde o login original. A duração efetiva define tanto o `exp` do JWT quanto o `maxAge` do cookie.

- *Por quê:* atende "pelo menos 24 horas" e a opção de manter conectado; hoje os valores estão hardcoded e não há como ajustar por instalação.
- *Alternativa considerada:* manter 1 h e renovar a cada request. Rejeitada: não atende o requisito e não ajuda dispositivos pouco usados.

### D2 — Claims `rmb` e `auth_time` no JWT

O JWT passa a carregar `rmb` (booleano) e `auth_time` (epoch do login original). A duração é escolhida por `rmb`. Tokens antigos sem esses claims são tratados como não lembrados, com `auth_time = iat` na primeira renovação.

- *Por quê:* sem `auth_time` não há como impor o limite absoluto durante a renovação deslizante; `rmb` mantém a escolha ao reemitir.
- *Alternativa considerada:* cookies separados ou tabela de sessões. Rejeitada por complexidade sem necessidade.

### D3 — Renovação deslizante no `authMiddleware`, com limite absoluto

Após verificar o JWT e carregar o usuário, o middleware verifica se o token passou de metade da duração. Se sim e `now - auth_time < SESSION_MAX_TTL`, reemite JWT e `Set-Cookie` com a duração cheia; se `now - auth_time >= SESSION_MAX_TTL`, trata como expirado (401). A renovação não se aplica a requisições autenticadas por API Key (agentes) nem ao handshake do WebSocket (que apenas verifica).

- *Por quê:* "usar sempre o mesmo computador" não deve voltar ao login; renovar no máximo uma vez por meia-duração limita escritas de cookie.
- *Alternativa considerada:* renovar só em `GET /auth/me`. Rejeitada: o SPA bate em várias rotas; o middleware é uniforme e o custo de assinar um JWT é baixo.

### D4 — Contrato de login: parâmetro opcional `remember`

`POST /api/auth/login` aceita `remember?: boolean` (padrão `false`, validação estrita de tipo), usado para escolher a duração e o claim. A resposta e o rate limiting permanecem inalterados. No frontend, `AuthContext.login(email, password, remember)` repassa o parâmetro.

- *Por quê:* menor mudança possível de contrato; compatível com clientes antigos que não enviam o campo.

### D5 — Lembrar o e-mail no `localStorage`, somente quando "lembrar-me"

Em login bem-sucedido com `remember: true`, o e-mail é gravado em `localStorage` (chave dedicada) e pré-preenchido na `LoginPage`; com `remember: false`, a chave é removida. A senha nunca é persistida e os atributos `autoComplete` são mantidos para gestores de senha.

- *Por quê:* o e-mail é dado de baixo risco e atende "lembrar do usuário"; persistir senha ou token em JS é inseguro (o cookie é HttpOnly).
- *Alternativa considerada:* depender só do autocomplete do navegador. Rejeitada: não cumpre o pedido explícito do card.

### D6 — Checkbox único na tela de login

Um checkbox "Lembrar-me neste dispositivo" controla os dois efeitos (sessão estendida + e-mail lembrado). Padrão **desmarcado** (opt-in), mais conservador em dispositivos compartilhados.

- *Por quê:* o card descreve uma única opção com dois efeitos; opt-in evita sessões longas por inércia.
- *Alternativa considerada:* dois controles separados. Rejeitada por ruído visual na tela de login.

### D7 — Logout encerra a sessão, preserva o e-mail lembrado

Logout apaga o cookie (como hoje) e mantém o e-mail pré-preenchido; a remoção do e-mail ocorre ao desmarcar "lembrar-me" num próximo login. Alinhado ao mercado (GitHub/GitLab mantêm o identificador, encerram a sessão).

### D8 — Compatibilidade e sem migração

Sem alteração de banco. Tokens existentes (1 h, sem claims novos) continuam válidos até expirar e passam a ser renovados como não lembrados. Atributos do cookie inalterados; `Secure` continua condicionado a `NODE_ENV=production`.

## Risks / Trade-offs

- **[JWT stateless de longa duração sem revogação server-side] →** mitigado por renovação deslizante, limite absoluto (`SESSION_MAX_TTL`) e logout que apaga o cookie; revogação centralizada fica registrada como follow-up (sessões server-side/refresh tokens). Documentar no `.env.example`.
- **[Mudança de comportamento: sessão deixa de expirar em 1 h] →** é o objetivo do card; testes que assumem 1 h serão atualizados e o padrão é configurável por instalação.
- **[Renovação pode reescrever o cookie atrás de proxy com múltiplas instâncias] →** a renovação ocorre no máximo uma vez por meia-duração, com o mesmo `path`/atributos; sem estado compartilhado necessário.
- **[Relógio do servidor no cálculo de `auth_time`/limite absoluto] →** usar `iat`/`auth_time` do próprio JWT (assinado) e o relógio do servidor de verificação; usuários com clock distorcido no cliente não afetam o servidor.
- **[Sessão longa em dispositivo compartilhado] →** opt-in desmarcado por padrão + logout explícito; a mensagem do checkbox deixa o efeito claro.
- **[Vazamento do e-mail lembrado em XSS] →** risco baixo (e-mail, não credencial); a política de CSP/arquivos já vigente permanece; nenhum token é exposto ao JS.

## Migration Plan

Deploy de backend + frontend no release normal (`v1.0.0` em dev). Sem migração de dados. Definir as novas variáveis em cada instalação (ou usar os padrões). Rollback: reverter o commit e remover as variáveis restaura o comportamento anterior (1 h), sem perda de dados.

## Open Questions

- Duração estendida: manter o padrão de 30 dias ou adotar 90 dias? Fica configurável (`SESSION_REMEMBER_TTL`); o padrão proposto é 30 dias.
- Limite absoluto padrão de 180 dias é aceitável para o produto? Configurável; pode ser ajustado sem mudança de código.
- O checkbox começa desmarcado (opt-in). Se o produto preferir ativar por padrão em dispositivos confiáveis, é uma troca de um valor — decidir antes do apply se necessário.
