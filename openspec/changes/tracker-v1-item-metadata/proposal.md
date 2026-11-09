# Proposal

## Why

A migração do cronograma do IAjuda Campo para o Azy Board precisa guardar, por atividade, o **responsável externo sem conta** (44 textos de responsável na planilha, muitos de fornecedores e do cliente), as **datas realizadas** e uma **referência externa informativa** da linha da planilha. O card já tem as datas previstas (Início/Fim); faltam as realizadas e o responsável externo.

Este change é deliberadamente pequeno: adiciona apenas os metadados que o card ainda não tem, **sem** mexer no comportamento de criação (que continua gravando `NOT_STARTED` e não aceita `blockedReason`) e **sem** criar upsert, índice único ou filtro por chave externa. A chave externa é apenas informativa nesta versão.

## What Changes

- Adicionar ao item: `external_source`, `external_ref`, `assignee_label`, `actual_start_date` e `actual_due_date`.
- Manter `start_date`/`due_date` como as datas previstas (colunas E/F da planilha) e usar `actual_start_date`/`actual_due_date` como as realizadas (colunas G/H).
- **Não** criar `baseline_start_date`/`baseline_due_date`.
- **Não** alterar a criação: o item continua nascendo `NOT_STARTED`; `status` e `blockedReason` são aplicados por uma segunda passada de `PATCH` na carga.
- **Não** criar `PUT /items/by-external-ref`, índice único, validação de unicidade ou filtros `externalSource`/`externalRef`.
- Expor os campos no REST (create/update/projeção), no MCP (`create_task`, `update_item`, `update_items`, `list_tasks`) e na UI (modal e card).
- Manter tudo opcional e compatível: itens sem os campos continuam funcionando; nenhuma migração de dados existente.

## Capabilities

### New Capabilities

- `item-external-identity`: referência externa informativa (`externalSource`/`externalRef`), sem unicidade, sem upsert e sem filtro.

### Modified Capabilities

- `card-management`: o card passa a ter responsável externo e datas realizadas; a chave externa é informativa.
- `card-edit-ui`: a modal de edição passa a exibir e salvar as datas realizadas e o responsável externo; o card mostra o label quando não há usuário.
- `mcp-tool-registry`: o catálogo de ferramentas passa a declarar os novos campos em `create_task`, `update_item`, `update_items` e na projeção de `list_tasks`.

## Impact

- **Banco:** `apps/api/src/db/schema.ts`, `apps/api/src/db/postgres/schema.ts`, migrations SQLite `0055_...` e PostgreSQL `0028_...`, sem índice único.
- **Persistência:** `ItemRecord`/`NewItemRecord`/`ItemPatch` em `apps/api/src/persistence/models.ts` e `ports.ts`; `mapItem` e os comandos de criação/edição nos adapters SQLite e PostgreSQL.
- **Aplicação:** `apps/api/src/application/items.ts` (mapeamento dos campos e validação apenas do par de datas realizadas).
- **API:** `apps/api/src/validation.ts`, `apps/api/src/routes/items.ts`, `apps/api/src/routes/batch.ts` e `apps/api/src/routes/shadowMarkdown.ts`.
- **MCP:** `packages/tool-registry/src/fields.ts`, `validation.ts` e os adaptadores de execução em `packages/tool-execution`.
- **Web:** `ItemModal`, `KanbanCard`, tipos do cliente e i18n (pt-BR, en, es).
- **Documentação:** OpenSpec, CHANGELOG, wiki de uso e artefatos gerados (`generate:docs`).
- **Fora de escopo:** baseline, upsert, índice único, filtros por chave externa, congelamento da planilha, webhooks, comentários, Gantt e o adaptador do Jira.

## Rastreabilidade

Board ref: a definir no primeiro card da migração (E3). Este change é pré-requisito de E3/E8/E9.
