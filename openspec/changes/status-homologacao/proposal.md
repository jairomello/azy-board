# Proposal

## Why

O fluxo do time tem uma etapa entre "testando" e "concluídas": a entrega está pronta e aguarda o aceite de quem pediu (homologação do cliente ou do PO). O produto já permite representar essa etapa como uma **coluna** ("Em Homologação"), mas não como **status**: o enum só tem `IN_PROGRESS`, então um card em homologação aparece como "Em andamento" no seletor de status, na grade, nos filtros e no dashboard.

O efeito prático é que a lista de cards não consegue mostrar nem filtrar "o que está em homologação" — e a coluna, sozinha, não resolve porque a grade e os filtros leem `status`, não `columnId`. Também não existe custom status por projeto: o enum é do produto.

## What Changes

- Adicionar `IN_HOMOLOGATION` aos enums de status de item (`TaskStatus`) e de status base de coluna (`ColumnBaseStatus`).
- `IN_HOMOLOGATION` participa da faixa do fluxo (50–90), como `IN_PROGRESS` e `BLOCKED`: é trabalho aberto que ainda não é `DONE`. Em um board típico, a coluna de homologação é a última do fluxo e vale 90.
- Permitir criar e editar coluna com `baseStatus = IN_HOMOLOGATION`; mover um card para essa coluna grava `status = IN_HOMOLOGATION`.
- Propagar o valor para validação da API, filtros, grade, board, dashboard (WIP, distribuição, aging), planejamento (lacunas e transição de sprint), Shadow Markdown, MCP e i18n (pt-BR, en, es).
- Criar a migration PostgreSQL `0031_status_homologacao.sql` recriando os três CHECKs (`columns.base_status`, `items.status`, `items.status_before_archive`).

## Capabilities

### New Capabilities

- Nenhuma.

### Modified Capabilities

- `card-management`: o enum de status do item passa a incluir `IN_HOMOLOGATION`.
- `board-management`: colunas aceitam o status base `IN_HOMOLOGATION`.
- `progresso-por-coluna`: `IN_HOMOLOGATION` entra na faixa do fluxo (não vale 0 nem 100).
- `mcp-tool-registry`: catálogo e validação declaram `IN_HOMOLOGATION` nos enums de status e `baseStatus`.
- `project-dashboard`: distribuição, WIP e aging tratam homologação como trabalho aberto em fluxo.
- `planning-gap-query`: `IN_HOMOLOGATION` entra no escopo padrão de itens abertos.
- `reviewable-sprint-transition`: homologação entra no carry-over.
- `board-filters`: o filtro de status oferece a opção "Em homologação".

## Impact

- **Domínio:** `packages/domain/src/index.ts` e `progress.ts`.
- **Banco:** enums/checks em `apps/api/src/db/schema.ts` e `apps/api/src/db/postgres/schema.ts`; migration PostgreSQL `0031_status_homologacao.sql`. O perfil SQLite guarda status como texto livre (sem CHECK), então não exige migration.
- **API:** `validation.ts`, `routes/batch.ts`, `routes/dashboard.ts`, `routes/sprintTransition.ts`, `routes/shadowMarkdown.ts`, `services/planningGaps.ts`, `services/sprintTransition.ts`, adapters SQLite/PostgreSQL.
- **MCP:** `packages/tool-registry/src/registry.ts` e `validation.ts`.
- **Web:** i18n (pt-BR/en/es), `BoardFilters`, `BoardScreen`, `BoardColumns`, `KanbanCard`, `TreeViewPage`, configurações de coluna, `dashboardAdapters`.
- **Documentação:** wiki de referência, skill oficial do Azy Board e artefatos gerados (`openapi.json`, `apps/mcp/README.md`).
- **Fora de escopo:** criar a coluna automaticamente nos boards existentes (o board sai da entrega; o admin cria ou converte a coluna para o novo status base), renomear colunas, migrar cards em lote e templates de projeto novos.
