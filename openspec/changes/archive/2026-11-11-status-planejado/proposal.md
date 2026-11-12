# Proposal

## Why

Hoje todo card em uma coluna de trabalho não iniciado aparece com o status `NOT_STARTED` ("Não iniciada"), porque o status do item é copiado do `baseStatus` da coluna. Isso torna `Backlog` e `A Fazer` indistinguíveis no dado: os dois são `NOT_STARTED`. A consequência prática é que um card já priorizado ("A Fazer"/"Planejado") continua sendo reportado como "não iniciado", como se ainda estivesse no backlog — e não há configuração que mude isso, porque o enum não tem esse valor.

O usuário precisa de um status dedicado ao trabalho **priorizado e ainda não iniciado**, diferente do backlog.

## What Changes

- Adicionar `PLANNED` aos enums de status de item (`TaskStatus`) e de status base de coluna (`ColumnBaseStatus`).
- `PLANNED` tem peso de avanço 0, como `NOT_STARTED`; não entra na faixa do fluxo em progresso.
- Permitir criar/editar coluna com `baseStatus = PLANNED`, e alinhar a API à UI e ao domínio aceitando os cinco status já documentados (`NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `CANCELLED`) além do novo.
- Ao trocar o status base de uma coluna, os cards sincronizados com o status anterior acompanham a mudança; status divergente (ex.: bloqueio explícito) é preservado.
- Expor a troca de status base na tela de configurações da coluna (antes só era possível na criação).
- Propagar o valor para filtros, grade, dashboard, planejamento (gaps e transição de sprint), MCP e i18n (pt-BR, en, es).
- Corrigir `create_column` no MCP, que enviava `projectId` no corpo de uma rota com schema estrito e sempre falhava com `INVALID_REQUEST`.
- Alinhar `release` ao invariante "status acompanha o `baseStatus` da coluna" nos dois perfis (SQLite e PostgreSQL tinham comportamentos divergentes).

## Capabilities

### New Capabilities

- Nenhuma.

### Modified Capabilities

- `board-management`: colunas podem ter o status base `PLANNED`; a lista de status base aceitos é explícita.
- `card-management`: o enum de status do item passa a incluir `PLANNED`.
- `progresso-por-coluna`: `PLANNED` vale 0 e não participa da faixa do fluxo.
- `mcp-tool-registry`: `create_column` declara `baseStatus` com enum completo e envia somente `name`/`baseStatus`.
- `assigned-card-prioritization`: card em coluna `PLANNED` é elegível; `Backlog` continua inelegível.
- `reviewable-sprint-transition`: `PLANNED` entra no carry-over.
- `planning-gap-query`: `PLANNED` entra no escopo padrão de itens abertos.
- `project-dashboard`: distribuição e aging consideram `PLANNED` como não iniciado.

## Impact

- **Domínio:** `packages/domain/src/index.ts` e `progress.ts`.
- **Banco:** enums/checks em `apps/api/src/db/schema.ts` e `apps/api/src/db/postgres/schema.ts`; migration PostgreSQL `0030_status_planned.sql`. O perfil SQLite guarda status como texto livre (sem CHECK), então não exige migration.
- **API:** `validation.ts`, `routes/batch.ts`, `routes/dashboard.ts`, `routes/sprintTransition.ts`, `services/planningGaps.ts`, `services/sprintTransition.ts`, `services/itemMutations.ts`, adapters SQLite/PostgreSQL.
- **MCP:** `packages/tool-registry/src/registry.ts`, `validation.ts` e `packages/tool-execution/src/http-adapter.ts`.
- **Web:** i18n (pt-BR/en/es), `BoardFilters`, `BoardScreen`, `TreeViewPage`, configurações de coluna.
- **Documentação:** wiki de referência, skill oficial do Azy Board e artefatos gerados.
- **Fora de escopo:** renomear colunas existentes, criar a coluna no board de um tenant, migrar cards entre colunas e qualquer automação de relatório externo.
