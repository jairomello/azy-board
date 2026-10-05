## Why

Hoje a sessão é um único JWT HS256 com TTL **fixo de 1 hora** em cookie `session` (HttpOnly; Secure; SameSite=Strict), sem refresh e sem renovação: quem usa o board todos os dias precisa refazer o login a cada hora. O card **T31 — Lembrar do usuário e manter a aplicação logada** pede duas coisas por dispositivo/equipamento: (1) lembrar o usuário na tela de login e (2) uma sessão sensivelmente mais longa (pelo menos 24 h), com a opção de manter o dispositivo conectado por período estendido.

**Board ref:** `a4cb11fa-1c47-45a3-97f2-443155ef37e7` (T31 - Lembrar do usuário e manter a aplicação logada, coluna "Backlog").

## What Changes

- **Duração de sessão configurável** por variável de ambiente (hoje `JWT_TTL`/`maxAge` estão hardcoded em 1 h): sessão padrão com **mínimo de 24 h** e sessão estendida de **dispositivo lembrado** (padrão 30 dias).
- **"Lembrar-me" na tela de login** (checkbox no formulário): ativa a sessão estendida **e** persiste o e-mail para preenchimento automático no próximo login. Sem o checkbox, o e-mail não é persistido e a sessão padrão (24 h) se aplica.
- **Renovação deslizante (rolling)**: a sessão é reemitida quando se aproxima do fim, para que um dispositivo usado com frequência não volte à tela de login, respeitando um limite absoluto de segurança (configurável) após o qual é exigido novo login.
- **Resposta de login** passa a indicar/registrar a escolha de lembrança (claim no JWT), e o cookie `session` recebe o `maxAge` correspondente à duração escolhida; atributos de segurança do cookie (HttpOnly; Secure em produção; SameSite=Strict; path=/) permanecem inalterados.
- **Logout** continua encerrando a sessão (apaga o cookie); o e-mail lembrado permanece pré-preenchido por conveniência e pode ser removido ao desmarcar a opção.
- **Resposta do card sobre prática de mercado**: sim — o caminho ideal atual é o descrito: cookie de sessão persistente com expiração deslizante e opção explícita de "manter conectado"/"lembrar-me" (padrão de GitHub, GitLab, Google "continuar conectado"), mantendo refresh tokens e sessões server-side fora deste escopo, com as mitigações cabíveis em JWT stateless (limite absoluto + renewal + limpeza no logout).
- Sem migração de banco de dados e sem mudança de contrato de API além do parâmetro `remember` no login.

## Capabilities

### New Capabilities

- `session-persistence`: persistência de sessão por dispositivo — checkbox "lembrar-me", duração padrão (≥24 h) e estendida, preenchimento automático do e-mail, renovação deslizante com limite absoluto e configuração por ambiente.

### Modified Capabilities

- `auth`: o requisito de login deixa de fixar o TTL em 1 hora e passa a exigir expiração configurável com duração padrão de pelo menos 24 h e sessão estendida quando "lembrar-me" estiver ativo, mantendo os atributos de cookie inalterados.

## Impact

- **Backend**: `apps/api/src/services/auth.ts` (TTL hardcoded e `signJwt`), `apps/api/src/routes/auth.ts` (login — parâmetro `remember`, `maxAge` do cookie; logout), `apps/api/src/middleware/auth.ts` (renovação deslizante e limite absoluto), `apps/api/.env.example*` (novas variáveis de sessão).
- **Frontend**: `apps/web/src/pages/LoginPage.tsx` (checkbox + prefill), `apps/web/src/contexts/AuthContext.tsx` (`login` com `remember`), `apps/web/src/lib/api.ts` (corpo do login), i18n `apps/web/src/i18n/locales/{pt-BR,en,es}/auth.json`.
- **Testes**: testes de auth da API (TTL/cookie/rolling/limite), testes de contrato e de componente da tela de login, verificação de i18n.
- **Segurança/trade-off**: JWT continua stateless, sem revogação server-side por sessão; a exposição maior de uma sessão estendida é mitigada por renovação deslizante, limite absoluto e logout. Revogação centralizada (sessões server-side/refresh tokens) é explicitamente fora do escopo.
