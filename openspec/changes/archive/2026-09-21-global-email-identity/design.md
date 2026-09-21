## Context

O modelo atual usa identidade por tenant no banco (`UNIQUE (tenant_id, email)` — `schema.ts:48-51`, criado em `0021_tearful_phalanx.sql:449`) mas resolve o login apenas por e-mail global (`auth.ts:26-30`). O descompasso é a origem do item 29: quando o mesmo e-mail existe em N tenants — situação real no `dev.db`, com 18 tenants de eval compartilhando `agent-eval@test.local` — `findFirst` escolhe uma conta arbitrária.

Restrições do produto que orientam a decisão:

- Não existe self-signup nem endpoint/UI de criação de tenant; tenants e usuários são criados por CLI (`setup.ts`, `seed.ts`) ou por `POST /users` admin-only (`users.ts:64`).
- O frontend não tem seletor de tenant (`App.tsx`, `LoginPage.tsx`, `AuthContext.tsx:110-117`); o login envia só `{ email, password }`.
- O e-mail é o único identificador que o usuário conhece; o `tenant_id` é detalhe interno derivado da identidade no servidor.

## Goals / Non-Goals

**Goals:**

- Tornar a identidade do usuário global e o login determinístico, sem introduzir seletor de tenant.
- Garantir `UNIQUE` global de e-mail canônico no banco, além da validação na aplicação.
- Saneamento determinístico de dados legados com e-mails repetidos entre tenants.
- Manter o isolamento por tenant intacto: o `tenant_id` continua vindo da identidade persistida e filtrando todas as queries.

**Non-Goals:**

- Cadastro público/self-signup.
- Seletor de tenant, resolução por domínio/subdomínio ou slug no login.
- Tabela `identities` separada de `tenant_users` (refatoração maior, sem ganho nesta etapa).
- MFA, política de senha, rate limiting (itens separados da análise).
- Migração de SQLite para PostgreSQL.

## Decisions

### Decisão 1 — Identidade global por e-mail

O e-mail canônico (lower + trim via `normalizeEmail`, `utils/email.ts:3-5`) passa a ser a identidade global. O login resolve o usuário por e-mail e deriva o `tenant_id` do registro encontrado.

**Por que não identidade por tenant + slug no login:** exigiria seletor de tenant na UI, contrato de login novo e que usuários conheçam o slug — atrito alto e desalinhado ao modelo "tenant provisionado por CLI, sem superfície de autoconfiguração". Alternativa considerada e descartada.

**Por que não apenas bloquear ambiguidade:** deixaria o e-mail duplicado válido no banco e apenas transformaria um login imprevisível em um login que falha, sem resolver a causa.

### Decisão 2 — Constraint global no banco, canônica na aplicação

Trocar `users_tenant_email_unique` por `users_email_unique` em `users(email)`, mantendo `users_tenant_id_id_unique` para as FKs compostas. O SQLite/Drizzle não indexa por expressão, então a canonicalização continua na aplicação (`normalizeEmail`) e no saneamento da migration, como já ocorre hoje. A verificação de integridade `duplicate_email_per_tenant` (`db/integrity.ts:208-215`) passa a agrupar apenas por `email` (global).

### Decisão 3 — Saneamento determinístico na migration

Antes de criar o índice global, a migration:

1. Canonicaliza `email` = `lower(trim(email))` em todos os registros.
2. Para e-mails repetidos entre tenants, mantém no endereço canônico o registro mais antigo (`MIN(rowid)`) e renomeia os demais com sufixo determinístico `+dup<rowid>`, preservando os usuários para reconciliação administrativa (mesma estratégia da migration 0021).
3. Só então cria `CREATE UNIQUE INDEX users_email_unique ON users(email)`.

Nunca apaga usuários. O sufixo pode ser ajustado por um Admin depois, mas o login já fica determinístico.

### Decisão 4 — Erros explícitos no cadastro

`POST /users` (`users.ts:64-81`) passa a consultar e-mail sem filtro de tenant e retorna `409` com mensagem indicando que o e-mail já existe em outro tenant. A checagem de aplicação é defesa em profundidade; a constraint global é a garantia final.

### Decisão 5 — Fixtures e evals com e-mails únicos

Helpers de teste e os tenants de eval que reutilizam o mesmo e-mail passam a gerar endereços únicos por tenant (ex.: sufixo com id do tenant). Isso remove a dependência de e-mail compartilhado, que deixaria de ser representável no novo schema.

## Risks / Trade-offs

- [E-mails genuinamente duplicados entre tenants em produção] → Rodar a consulta de auditoria pré-migration (contagem por `email` global) e reportar antes de aplicar; o saneamento preserva os registros com sufixo e o Admin reconcilia.
- [Sufixo `+dup<rowid>` altera endereços reais e pode quebrar login de contas afetadas] → Janela de manutenção, backup obrigatório e comunicação; a mutação de dados não é revertida por rollback de código.
- [Evals/testes que dependem de e-mail compartilhado quebram] → Atualizar helpers/fixtures na mesma change e rodar `bun run check` e `bun run test:smoke`.
- [Índice simples não protege contra variações de caixa inseridas fora da aplicação] → Manter `normalizeEmail` no login e no cadastro; a migration canonicaliza o legado e o índice incide sobre o valor canônico.
- [Login global permite enumerar existência de e-mail?] → A resposta de erro continua genérica (`Credenciais inválidas`) e o 409 de duplicidade só é exposto a Admin autenticado.

## Migration Plan

1. Auditoria: contar e listar e-mails repetidos entre tenants (global) antes do deploy.
2. Backup do banco.
3. Migration append-only: canonicalizar, sufixar duplicados, criar `users_email_unique`, remover `users_tenant_email_unique`.
4. Deploy do código: login por e-mail global, cadastro com checagem global, fixtures atualizadas.
5. Verificação: `bun run test:migrations`, `bun run check`, `bun run test:smoke` e consulta de que não restam e-mails duplicados.
6. Rollback: reverter o código é possível; a mutação de e-mails exige restore do backup.

## Open Questions

- Contas legitimamente presentes em mais de um tenant devem ser mescladas ou permanecer separadas (com e-mails distintos) após o saneamento? Nesta change assume-se "permanecer separadas, reconciliadas pelo Admin".
