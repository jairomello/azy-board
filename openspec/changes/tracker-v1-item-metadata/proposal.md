# Proposal

## Why

A migração do cronograma do IAjuda Campo para o Azy Board precisa de três coisas que o card ainda não tem: uma **chave externa estável** (para carga idempotente e para guardar a chave do Jira depois), **datas realizadas e baseline** (para substituir o Status Report e calcular SPI/higiene) e um **responsável externo sem conta** (44 textos de responsável na planilha, muitos de fornecedores e do cliente). Além disso, a criação de card ignora o `status` enviado e grava sempre `NOT_STARTED`, o que obriga a uma segunda passada na carga.

Sem esses campos, a migração não é repetível, o delta não consegue reconhecer um item alterado e os indicadores de prazo não têm dado. Este change adiciona a base de metadados do item e o upsert por chave externa, sem alterar a hierarquia, o Leaf Rule ou os gates existentes.

## What Changes

- Adicionar ao item: `external_source`, `external_ref`, `assignee_label`, `actual_start_date`, `actual_due_date`, `baseline_start_date` e `baseline_due_date`.
- Criar índice único parcial por `(tenant_id, project_id, external_source, external_ref)` e validação de par source/ref.
- Criar upsert por chave externa (`PUT /api/projects/:projectId/items/by-external-ref`): cria se não existe, atualiza se existe, devolve `created` e o item.
- Honrar `status` na criação; quando o status não for informado e houver coluna, herdar o `baseStatus` da coluna.
- Expor os campos no REST (create/update/list/projeção), no MCP (`create_task`, `update_item`, `update_items`, `list_tasks`) e na UI (modal e card).
- Adicionar filtros `externalSource` e `externalRef` na listagem de itens.
- Manter tudo opcional e compatível: itens sem os campos continuam funcionando; nenhuma migração de dados existente.

## Capabilities

### New Capabilities

- `item-external-identity`: chave externa estável, unicidade por projeto e upsert idempotente para carga, delta e integração com o Jira.

### Modified Capabilities

- `card-management`: o card passa a ter responsável externo, datas realizadas/baseline e status honrado na criação; a listagem aceita filtros por chave externa.
- `card-edit-ui`: a modal de edição passa a exibir e salvar as datas realizadas/baseline e o responsável externo; o card mostra o label quando não há usuário.
- `mcp-tool-registry`: o catálogo de ferramentas passa a declarar os novos campos em `create_task`, `update_item`, `update_items` e na projeção de `list_tasks`.

## Impact

- **Banco:** `apps/api/src/db/schema.ts`, `apps/api/src/db/postgres/schema.ts`, migrations SQLite `0055_...` e PostgreSQL `0028_...`, com CHECKs e índice único parcial.
- **Persistência:** `ItemRecord`/`NewItemRecord`/`ItemPatch` em `apps/api/src/persistence/models.ts` e `ports.ts`; `mapItem` e os comandos de criação/edição nos adapters SQLite e PostgreSQL; novo `findByExternalRef`.
- **Aplicação:** `apps/api/src/application/items.ts` (status na criação, mapeamento dos campos, validação de unicidade) e um caso de uso de upsert.
- **API:** `apps/api/src/validation.ts`, `apps/api/src/routes/items.ts`, `apps/api/src/routes/batch.ts` (somente o necessário para manter o contrato) e `apps/api/src/services/domainEventOutbox.ts` (evento de item já existente).
- **MCP:** `packages/tool-registry/src/fields.ts`, `validation.ts` e os adaptadores de execução em `packages/tool-execution`.
- **Web:** `ItemModal`, `KanbanCard`, tipos do cliente e i18n (pt-BR, en, es).
- **Documentação:** OpenSpec, CHANGELOG, wiki de uso e artefatos gerados (`generate:docs`).
- **Fora de escopo:** congelamento da planilha, webhooks, comentários, Gantt e o adaptador do Jira. O upsert é a base para esses passos posteriores.

## Rastreabilidade

Board ref: a definir no primeiro card da migração (E3). Este change é pré-requisito de E3/E8/E9.
