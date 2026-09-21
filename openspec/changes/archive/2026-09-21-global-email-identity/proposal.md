## Why

O login resolve o usuário apenas pelo e-mail (`auth.ts:26-30`), sem filtrar tenant e sem desempate. Como o banco garante apenas `UNIQUE (tenant_id, email)` (`schema.ts:48-51`), o mesmo e-mail pode existir em vários tenants — e já existe em dados reais (18 tenants de eval com `agent-eval@test.local`). Nesse cenário, `findFirst` autentica uma conta imprevisível, misturando identidades entre clientes. É o item 29 da análise de sistema.

## What Changes

- **BREAKING**: a identidade do usuário passa a ser **global**, não por tenant. O e-mail canônico (lower + trim) SHALL ser único em todo o sistema.
- O login deixa de ser ambíguo: `POST /auth/login` resolve o usuário por e-mail canônico global e deriva o `tenant_id` da identidade encontrada.
- A criação de usuário administrativa (`POST /users`) passa a rejeitar e-mail já cadastrado em **qualquer** tenant, com mensagem explícita.
- Nova migration append-only substitui `users_tenant_email_unique` por um índice único global em `users(email)`; e-mails repetidos entre tenants são saneados antes da constraint.
- Fixtures, seeds e testes que reutilizam o mesmo e-mail em tenants diferentes passam a usar endereços únicos.
- Atualização de docs que ainda descrevem o e-mail como único por tenant.

## Capabilities

### New Capabilities
<!-- Nenhuma. A mudança altera requisitos existentes. -->

### Modified Capabilities
- `auth`: o login SHALL resolver identidade global por e-mail canônico e SHALL ser determinístico.
- `multi-tenancy`: a identidade do usuário SHALL ser global; o `tenant_id` é derivado da identidade, não usado para desambiguar o login.
- `schema-integrity`: a unicidade de e-mail SHALL ser global, substituindo a unicidade por tenant.
- `user-permissions`: o cadastro de usuário pelo Admin SHALL validar e-mail globalmente único.

## Impact

- **API:** `apps/api/src/routes/auth.ts` (login), `apps/api/src/routes/users.ts` (cadastro), `apps/api/src/db/schema.ts` (índice), nova migration em `apps/api/src/db/migrations/`, `apps/api/src/scripts/setup.ts` e `seed.ts`.
- **Banco:** migration com saneamento de e-mails duplicados entre tenants antes de criar `users_email_unique`.
- **Testes:** `apps/api/src/integration.test.ts`, `db/integrity.test.ts`, `db/timestamp.test.ts`, `db/migration.test.ts` e fixtures de eval que reutilizam e-mail.
- **Frontend:** sem mudança de contrato; o formulário de Admin pode exibir a nova mensagem de conflito global.
- **Docs:** `README.md`, `docs/db-integrity.md` e `docs/ANALISE-SISTEMA.md` (item 29 resolvido).
- **Rastreabilidade:** Board ref: bfa0d11e-ac56-4368-8fa9-1b012135068d (card "Item 29: Identidade multi-tenant é ambígua").
- **Fora de escopo:** cadastro público/self-signup, seletor de tenant no login, tabela `identities` separada, migração para PostgreSQL e MFA.
