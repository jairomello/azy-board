## 1. Schema e migration

- [x] 1.1 Criar a tabela `login_attempts` no `apps/api/src/db/schema.ts` (`id`, `ip`, `email_canonical`, `outcome` enum `SUCCESS|FAILURE|THROTTLED`, `created_at`), com índices por `created_at`, `(ip, created_at)` e `(email_canonical, created_at)`
- [x] 1.2 Gerar a migration append-only com `bun run db:generate` e renomear para `0029_login_attempts.sql`
- [x] 1.3 Adicionar teste de migration confirmando criação da tabela e índices com `foreign_key_check` limpo
- [x] 1.4 Garantir que nenhum dado sensível (senha, hash, token) é persistido na tabela

## 2. Resolução de IP e serviço de throttle

- [x] 2.1 Resolver o IP do cliente via `server.requestIP` no `apps/api/src/index.ts` (ou middleware), com fallback determinístico
- [x] 2.2 Considerar `X-Forwarded-For` somente quando `TRUST_PROXY=true`, usando a última entrada, e documentar a variável
- [x] 2.3 Expor o IP no contexto da requisição (`HonoEnv`/tipos) sem quebrar as rotas existentes
- [x] 2.4 Criar `apps/api/src/services/loginThrottle.ts` com constantes de janela/limites, consulta das tentativas por IP e por identidade, cálculo de `Retry-After` e atraso progressivo
- [x] 2.5 Implementar poda oportunista de tentativas com mais de 30 dias

## 3. Login com rate limit, atraso e auditoria

- [x] 3.1 Aplicar o limite por IP no início de `POST /auth/login`, respondendo 429 `RATE_LIMITED` com `Retry-After`
- [x] 3.2 Aplicar o limite por identidade com atraso progressivo e bloqueio temporário, sem revelar existência da conta
- [x] 3.3 Registrar cada tentativa (SUCCESS/FAILURE/THROTTLED) na auditoria com IP, e-mail canônico e timestamp
- [x] 3.4 Zerar as falhas da identidade em login bem-sucedido
- [x] 3.5 Garantir que a verificação de senha não ocorre quando a tentativa já está bloqueada

## 4. Política mínima de senha

- [x] 4.1 Adicionar validação de política em `createUserSchema` (`apps/api/src/validation.ts`): mínimo de 8 caracteres, diferente do e-mail/trecho local, sem caractere único repetido e fora da denylist de senhas comuns
- [x] 4.2 Retornar mensagem de validação clara e `retryable: false` no cadastro com senha fraca
- [x] 4.3 Aplicar a mesma validação em `apps/api/src/scripts/setup.ts` e `apps/api/src/scripts/seed.ts` com erro explícito
- [x] 4.4 Confirmar que `loginSchema` permanece permissivo e que senhas existentes continuam autenticando

## 5. Retry-After no contrato de erro

- [x] 5.1 Adicionar `Retry-After` (padrão 60s) a respostas 429 sem header no `apps/api/src/middleware/errorResponse.ts`
- [x] 5.2 Permitir que o login sobrescreva o valor com o tempo preciso do bloqueio
- [x] 5.3 Verificar que o 429 do assistente também passa a responder com `Retry-After`

## 6. Testes

- [x] 6.1 Teste de integração: limite por IP retorna 429 `RATE_LIMITED` com `Retry-After`
- [x] 6.2 Teste de integração: bloqueio por identidade recusa senha correta com 429 e expira com a janela
- [x] 6.3 Teste de integração: sucesso zera as falhas da identidade
- [x] 6.4 Teste de integração: tentativas geram registros de auditoria `FAILURE`/`SUCCESS`/`THROTTLED` sem senha ou hash
- [x] 6.5 Teste de integração: cadastro com senha fraca é rejeitado; senha válida é aceita
- [x] 6.6 Ajustar helpers de teste para controlar tempo/janela sem flakiness

## 7. Documentação

- [x] 7.1 Marcar o item 28 em `docs/ANALISE-SISTEMA.md` com a correção aplicada
- [x] 7.2 Atualizar `SECURITY_CHECKLIST.md` com o rate limiting de login e a auditoria de tentativas
- [x] 7.3 Documentar `TRUST_PROXY` no `apps/api/.env.example`/README e registrar `Board ref: 022d474b-865e-42c8-9334-758b1b9f3ac8`

## 8. Verificação

- [x] 8.1 Rodar `bun run check` (typecheck + lint + testes + build)
- [x] 8.2 Rodar `bun run test:migrations`
- [x] 8.3 Rodar `bun run test:smoke`
- [x] 8.4 Validar a change com `openspec validate harden-login-security`
- [x] 8.5 Encerrar o card no Azy Board com `complete_task` e confirmar status `DONE`
