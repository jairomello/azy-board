# Tasks

## 1. Domínio

- [x] 1.1 Adicionar `IN_HOMOLOGATION` a `TaskStatus` e `ColumnBaseStatus` em `packages/domain/src/index.ts`.
- [x] 1.2 Incluir `IN_HOMOLOGATION` em `isFlowStatus` e documentar a faixa do fluxo em `progress.ts`.

## 2. Banco e persistência

- [x] 2.1 Adicionar `IN_HOMOLOGATION` aos enums do schema SQLite e aos checks do schema PostgreSQL (colunas, status e status anterior ao arquivamento).
- [x] 2.2 Criar a migration PostgreSQL `0031_status_homologacao.sql` recriando os três CHECKs.
- [x] 2.3 Incluir `IN_HOMOLOGATION` nas consultas de candidatos da transição de sprint e no aging (SQLite e PostgreSQL).
- [x] 2.4 Incluir `IN_HOMOLOGATION` no cast de `baseStatus` do adapter PostgreSQL.

## 3. API

- [x] 3.1 Incluir `IN_HOMOLOGATION` nos enums de criação, edição, filtro e lote em `validation.ts`, `batch.ts` e `sprintTransition.ts`.
- [x] 3.2 Permitir `IN_HOMOLOGATION` como `baseStatus` de coluna na criação e na edição.
- [x] 3.3 Incluir `IN_HOMOLOGATION` no escopo padrão de lacunas, na distribuição do dashboard, no WIP e na higiene.
- [x] 3.4 Tratar homologação como em andamento no Shadow Markdown.

## 4. MCP

- [x] 4.1 Incluir `IN_HOMOLOGATION` nos enums de `create_task`, `update_item`, `update_items`, filtros e `baseStatus` no catálogo.
- [x] 4.2 Atualizar as descrições de `create_column` e `prepare_sprint_transition`.
- [x] 4.3 Incluir `IN_HOMOLOGATION` na validação de argumentos do catálogo.

## 5. Web

- [x] 5.1 Adicionar a opção "Em homologação" no filtro de status e no seletor da grade.
- [x] 5.2 Adicionar indicador visual próprio no card do Kanban, na coluna e na grade.
- [x] 5.3 Expor o status base no seletor de configurações da coluna.
- [x] 5.4 Adicionar a chave de i18n nos três idiomas (pt-BR, en, es) em `board`, `common` e `dashboard`, sem divergir entre filtro e coluna de status.

## 6. Documentação e artefatos

- [x] 6.1 Atualizar a wiki (gerenciar colunas, tipos de status, modelo de itens e de projeto).
- [x] 6.2 Atualizar a skill oficial (transição de sprint) e validar com `bun run test:agent-skill`.
- [x] 6.3 Regerar `docs/generated/openapi.json` e `apps/mcp/README.md` com `bun run generate:docs`.

## 7. Testes

- [x] 7.1 Criar `apps/api/src/status-homologacao.test.ts` cobrindo criação da coluna, peso derivado, movimentação, status explícito, filtro e board markdown.
- [x] 7.2 Atualizar o teste de contrato do dashboard (chaves do WIP) e o teste de enum de `create_task`.
- [x] 7.3 Rodar `bun run typecheck` e `bun test --isolate`.
