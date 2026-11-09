# Tasks

Board ref: a definir no primeiro card da migração (E3).

## 1. Schema e migrations

- [x] 1.1 Adicionar `external_source`, `external_ref`, `assignee_label`, `actual_start_date`, `actual_due_date`, `baseline_start_date` e `baseline_due_date` ao schema SQLite e ao schema PostgreSQL, com o índice único parcial `(tenant, project, source, ref)` e o índice de busca.
- [x] 1.2 Criar as migrations SQLite `0055_item_tracker_metadata.sql` e PostgreSQL `0028_item_tracker_metadata.sql`, com `foreign_key_check` limpo e reexecução idempotente; validar que itens existentes permanecem intactos.

## 2. Persistência

- [x] 2.1 Estender `ItemRecord` e os mapeamentos `mapItem` dos dois adapters; expor os campos em `NewItemRecord` e `ItemPatch` sem quebrar os tipos existentes.
- [x] 2.2 Adicionar `findByExternalRef(context, projectId, source, ref)` à porta e aos dois adapters; cobrir item existente, item inexistente e isolamento por tenant.
- [x] 2.3 Incluir os campos nos comandos de criação e edição dos dois adapters, com teste de paridade SQLite/PostgreSQL.

## 3. Aplicação e API

- [x] 3.1 Honrar `status` na criação: explícito, herdado da coluna e padrão `NOT_STARTED`; aceitar `blockedReason` na criação; testar os três caminhos.
- [x] 3.2 Validar o par `externalSource`/`externalRef`, a unicidade por projeto e os pares de datas; devolver 422/409 com mensagens acionáveis.
- [x] 3.3 Implementar `PUT /projects/:projectId/items/by-external-ref` com `created`, autorização `MEMBER` e releitura em conflito; testar criação, repetição, atualização parcial e conflito.
- [x] 3.4 Adicionar filtros `externalSource`/`externalRef` em `GET /items` e os campos em `PROJECTION_FIELDS`; testar combinação com os filtros existentes.
- [x] 3.5 Atualizar o Shadow Markdown para usar `assigneeLabel` como fallback do responsável, sem mudar a estrutura.

## 4. MCP

- [x] 4.1 Declarar os novos campos em `create_task`, `update_item` e `update_items` no catálogo compartilhado e na validação de `changes`.
- [x] 4.2 Incluir os campos na projeção de `list_tasks` e no payload de `get_board`/`get_tree`; atualizar o contrato de testes do catálogo.
- [x] 4.3 Mapear os campos no adaptador de execução (`packages/tool-execution`) e testar a chamada REST correspondente.

## 5. Web

- [x] 5.1 Adicionar à modal do item os campos de datas realizadas/baseline e o responsável externo, com validação local e envio no PATCH.
- [x] 5.2 Mostrar o `assigneeLabel` no card quando não houver usuário, com indicador discreto de responsável externo.
- [x] 5.3 Adicionar os textos em pt-BR, en e es e garantir paridade de i18n.

## 6. Verificação

- [x] 6.1 Rodar a suíte completa e confirmar **nenhuma falha nova** além das 15 conhecidas; rodar `check:persistence`, `check:api-boundary` e `test:migrations`.
- [x] 6.2 Rodar os testes ADVANCED contra PostgreSQL e Valkey locais, um arquivo por vez, com `azyboard_test`.
- [ ] 6.3 Rodar `test:mcp-catalog`, `test:agent-skill`, `check:i18n`, `check:frontend-tests` e `test:smoke`. Os quatro primeiros passaram; o `test:smoke` completo ainda depende de segundo tenant e provider determinístico.
- [x] 6.4 Fazer o teste funcional no Azy test local: criar um card com os sete campos, repetir o upsert e conferir no board.

## 7. Documentação

- [x] 7.1 Atualizar o CHANGELOG (Unreleased) e a wiki de uso do card.
- [x] 7.2 Rodar `generate:docs` e `check:docs`; conferir `docs/generated/openapi.json` e `apps/mcp/README.md`.
- [ ] 7.3 Preparar o PR com evidência: diff, testes, funcional local e limitações.
