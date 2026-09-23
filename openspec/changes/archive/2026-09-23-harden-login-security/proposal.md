## Why

A rota pública `POST /api/auth/login` (`apps/api/src/routes/auth.ts:17-73`) não tem nenhuma limitação: aceita tentativas ilimitadas, não registra tentativas e não aplica política mínima de senha no cadastro. O único rate limit do sistema é o do assistente (`assistant.ts:75,158-162`), in-memory e restrito ao agente. Isso permite força bruta e credential stuffing contra contas, e senhas triviais são aceitas (`createUserSchema` aceita `min(1)` em `validation.ts:160`). É o item 28 da análise de sistema.

## What Changes

- **Rate limiting de login por IP**: janela deslizante com limite de tentativas por endereço de origem; excedente retorna `429 RATE_LIMITED`.
- **Rate limiting de login por identidade (e-mail canônico)**: janela deslizante e **atraso progressivo** entre tentativas falhas, com bloqueio temporário após N falhas.
- **Auditoria de tentativas**: persistir tentativas de login (sucesso e falha) com IP, identidade canônica, resultado e timestamp, em tabela append-only.
- **Política mínima de senha no cadastro**: comprimento mínimo e rejeição de senhas triviais ao criar usuário (`POST /users`), com mensagem de validação.
- **`Retry-After` em 429**: respostas de rate limit passam a informar quando repetir, no contrato único de erro.

## Capabilities

### New Capabilities
- `login-security`: limitação de tentativas de login por IP e por identidade, atraso progressivo/bloqueio temporário, auditoria de tentativas e política mínima de senha de conta.

### Modified Capabilities
- `unified-error-contract`: respostas `429` passam a incluir o header `Retry-After`, mantendo `retryable: true`.

## Impact

- **API:** `apps/api/src/routes/auth.ts` (throttle + auditoria), `apps/api/src/routes/users.ts` (política de senha), `apps/api/src/validation.ts` (`loginSchema`/`createUserSchema`), novo `apps/api/src/services/loginThrottle.ts`, `apps/api/src/middleware/errorResponse.ts` (header `Retry-After`).
- **Banco:** nova tabela `login_attempts` com índices por `ip`, `email_canonical` e `created_at` (migration append-only `0029_*`).
- **Contratos:** `packages/types` se necessário para o resultado da tentativa.
- **Testes:** `apps/api/src/integration.test.ts` (429 por IP, lockout por identidade, auditoria, senha fraca), `apps/api/src/db/integrity.test.ts`/`migration.test.ts` (nova tabela).
- **Docs:** `docs/ANALISE-SISTEMA.md` (item 28), `SECURITY_CHECKLIST.md` (rate limiting de endpoints sensíveis).
- **Rastreabilidade:** Board ref: 022d474b-865e-42c8-9334-758b1b9f3ac8 (card "Item 28: Login não tem rate limiting").
- **Fora de escopo:** MFA para Root/Admin, autosserviço de troca/recuperação de senha, rate limiting distribuído (Redis), revogação/rotação de sessões e política de complexidade de senha configurável.
