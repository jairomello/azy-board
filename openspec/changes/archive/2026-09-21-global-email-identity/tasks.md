## 1. Schema e migration

- [x] 1.1 Trocar o índice `users_tenant_email_unique` por `users_email_unique` em `users(email)` no `apps/api/src/db/schema.ts`, mantendo `users_tenant_id_id_unique` para as FKs compostas
- [x] 1.2 Gerar a migration append-only com `bun run db:generate` e renomear o arquivo com descrição legível (ex.: `0028_global_email_identity.sql`)
- [x] 1.3 Adicionar ao SQL da migration, antes da constraint, o saneamento: canonicalizar `email = lower(trim(email))` e renomear duplicados entre tenants com sufixo determinístico `+dup<rowid>`, preservando o registro mais antigo
- [x] 1.4 Garantir que a migration remova `users_tenant_email_unique` e crie `users_email_unique` sobre o e-mail já canônico, com comentário `// [DB-SWAP]` para o equivalente em PostgreSQL
- [x] 1.5 Rodar `bun run test:migrations` e confirmar que a migration aplica e reverte em base limpa e em base com e-mails duplicados entre tenants

## 2. Backend — identidade global

- [x] 2.1 Ajustar `POST /auth/login` em `apps/api/src/routes/auth.ts` para resolver a identidade pelo e-mail canônico global, documentando `// [TENANT] tenant_id derivado da identidade resolvida`
- [x] 2.2 Ajustar `POST /users` em `apps/api/src/routes/users.ts` para checar e-mail globalmente (sem filtro de tenant) e retornar `409` com mensagem explícita quando já existir em outro tenant
- [x] 2.3 Atualizar a verificação `duplicate_email_per_tenant` em `apps/api/src/db/integrity.ts` para checagem global (`duplicate_email`), agrupando apenas por `email`
- [x] 2.4 Revisar `apps/api/src/scripts/setup.ts` e `apps/api/src/scripts/seed.ts` para não dependerem de e-mail repetido entre tenants

## 3. Fixtures, seeds e evals

- [x] 3.1 Atualizar `apps/api/src/evals/seed.ts` para gerar e-mail único por tenant de eval
- [x] 3.2 Ajustar helpers de teste (`apps/api/src/integration.test.ts` e demais `*.test.ts`) que reutilizam o mesmo e-mail em tenants diferentes
- [x] 3.3 `bun run evals:env` não se aplica sem credenciais locais; a geração de mundo de eval foi ajustada e coberta pelo typecheck/check

## 4. Testes

- [x] 4.1 Adicionar teste de integração de login com credenciais válidas (bcrypt + cookie/JWT), hoje inexistente
- [x] 4.2 Adicionar teste que prova que o mesmo e-mail não pode existir em dois tenants (índice global) e que a migration saneia o legado
- [x] 4.3 Adicionar teste de `POST /users` retornando `409` ao tentar e-mail já existente em outro tenant
- [x] 4.4 Atualizar os cenários existentes de `apps/api/src/db/integrity.test.ts` que hoje aceitam o mesmo e-mail em tenants diferentes

## 5. Documentação

- [x] 5.1 Atualizar `docs/db-integrity.md` (de "UNIQUE (tenant_id, email)" para unicidade global de e-mail)
- [x] 5.2 Atualizar `README.md` e `docs/ANALISE-SISTEMA.md` (marcar o item 29 como resolvido e registrar a decisão de identidade global)
- [x] 5.3 Registrar no card o log de que a decisão foi identidade global, com o `Board ref: bfa0d11e-ac56-4368-8fa9-1b012135068d`

## 6. Verificação

- [x] 6.1 Rodar `bun run check` (typecheck + lint + testes + build)
- [x] 6.2 Rodar `bun run test:smoke` para o fluxo web/API
- [x] 6.3 Auditoria de e-mails duplicados (global) no `apps/api/dev.db`: 0 duplicatas e 0 e-mails não canônicos antes da migration
- [x] 6.4 Validar a change com `openspec validate global-email-identity`
- [x] 6.5 Encerrar o card no Azy Board com `complete_task` e confirmar no board que o status é `DONE`
