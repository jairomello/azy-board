# Tasks

## 1. Schema e migrations

- [x] 1.1 Declarar a tabela `itemDependencies` (SQLite) em `apps/api/src/db/schema.ts` com `id`, `tenant_id`, `project_id`, `item_id`, `depends_on_item_id`, `dependency_type`, `lag_days`, timestamps, duas FKs compostas para `items` com `ON DELETE CASCADE`, `unique(tenant_id, item_id, depends_on_item_id)`, checks de tipo/inteiro e índices de listagem; adicionar `itemDependencies` em `itemsRelations`. Verificar com `bun run typecheck`.
- [x] 1.2 Gerar a migration SQLite (próxima sequência após `0046_*`) com tabela, FKs, unique, checks e índices, atualizando snapshot/journal; verificar aplicação limpa via `bun run test:migrations`.
- [x] 1.3 Espelhar no schema PostgreSQL (`apps/api/src/db/postgres/schema.ts` se aplicável) e escrever a migration PG em `apps/api/src/db/postgres/migrations/` (FK composta, CHECKs, timestamptz); verificar com `apps/api/src/db/postgres/parity.test.ts`.
- [x] 1.4 Registrar a tabela em `APP_TABLES` de `installationMarkers.ts` e `postgres/index.ts`, adicionar checks de órfão/cross-tenant em `integrity.ts` e incluir `item_dependencies` nos deletes em cascata explícitos de `itemUnitOfWork.ts` e `postgres/adapter.ts`, com comentários `// [TENANT]`. Verificar rodando os testes de integridade e cascata.

## 2. Persistência (ports e adaptadores)

- [x] 2.1 Adicionar `ItemDependencyRecord`, `NewItemDependencyRecord` e `ItemDependencyPatch` em `apps/api/src/persistence/models.ts` e a porta `ItemDependencyPort` (list, listByProject, get, create, update, delete) em `ports.ts`, incluindo `itemDependencies` em `PersistenceTransaction`. Verificar com `bun run typecheck` e `bun run check:persistence`.
- [x] 2.2 Implementar o CRUD e `listByProject` no adaptador SQLite (`apps/api/src/db/sqlite/adapter.ts`), com filtros de `tenant_id`/`project_id` marcados `// [TENANT]`. Verificar com testes de adaptador/integração.
- [x] 2.3 Implementar o CRUD e `listByProject` equivalentes no adaptador PostgreSQL (`apps/api/src/db/postgres/adapter.ts`), com `// [DB-SWAP]` onde couber. Verificar com o teste de paridade SQLite/PostgreSQL.
- [x] 2.4 Incluir dependências na duplicação de estrutura e no unit of work, se aplicável, e verificar com `structureDuplication.test.ts` e `itemUnitOfWork.test.ts`.

## 3. Contratos compartilhados

- [x] 3.1 Adicionar o enum `ItemDependencyType` (`FS`/`SS`/`SF`/`FF`) em `packages/domain` e o contrato `ItemDependency` (com resumo do item dependido) em `packages/ui-contracts`. Verificar com `bun run typecheck` e `bun run check:api-boundary`.

## 4. API

- [x] 4.1 Definir schemas Zod em `apps/api/src/validation.ts` (`createItemDependencySchema`, `updateItemDependencySchema` com pelo menos um campo) validando tipo, `lagDays` inteiro e ids; verificar com testes de validação.
- [x] 4.2 Criar `apps/api/src/routes/itemDependencies.ts` seguindo `itemLinks.ts` (helper `authorizedItem`, anti-IDOR, `requireRole`, idempotência no POST via `COMMAND_NAMESPACES`, 404/409) e registrar a rota em `apps/api/src/index.ts`. Verificar com `bun run typecheck`.
- [x] 4.3 Implementar a detecção de ciclos (BFS sobre as arestas do projeto) na camada de serviço, rejeitando criação/edição que feche ciclo direto ou indireto, com erro acionável. Verificar com testes de ciclo direto, indireto e grafo acíclico.
- [x] 4.4 Adicionar testes de integração em `apps/api/src/integration.test.ts` cobrindo CRUD, validação de tipo/retardo, item igual a si, alvo de outro projeto/tenant, RBAC de leitura/escrita, idempotência e cascade de exclusão nos dois extremos. Verificar com `bun run test:integration`.
- [x] 4.5 Expor `dependencies` (resumo: código/título/tipo/tipo de dependência) e `dependencyCount` nos payloads de `GET /projects/:id/items` e `GET /projects/:id/items/tree`, com agregação única por projeto (sem N+1). Verificar com testes de contrato dos payloads e com o orçamento de payload existente.

## 5. Web

- [x] 5.1 Adicionar as chaves de i18n da aba "Dependências" (título, campos de tipo/retardo, ações, estados vazio/erro, rótulos dos quatro tipos) em `apps/web/src/i18n/locales/{pt-BR,en,es}/board.json`. Verificar com `bun run check:i18n`.
- [x] 5.2 Criar `apps/web/src/components/ItemDependenciesArea.tsx` (estado local, `AbortController`, `lib/api.ts`, seletor de item do projeto com busca e exclusão do próprio item/já vinculados, edição de tipo/retardo, remoção e exibição de erros de ciclo) no padrão de `ItemLinksArea`.
- [x] 5.3 Adicionar a aba no `ItemModal` (união `ItemModalTab`, lazy import com `Suspense`, controle por `canEdit`) e verificar com o teste de layout existente.
- [x] 5.4 Escrever `apps/web/src/components/item-dependencies-area.test.tsx` (fetch-stub) cobrindo carregar, criar, editar, remover, estado vazio, somente-leitura e erro de ciclo. Verificar com `bun run test:web` e `bun run check:bundle`.
- [x] 5.5 Adicionar a coluna "Dependências" na Tree View listando os itens dependidos (por `sequenceCode`, com fallback de título; célula vazia quando não houver) e escrever teste da coluna. Verificar com `bun run test:web` e `bun run check:frontend-tests`.
- [x] 5.6 Adicionar o indicador de ícone + contagem no `KanbanCard` (omitido quando zero, visível para VIEWER, com nome acessível) e teste correspondente. Verificar com `bun run test:web` e `bun run check:frontend-tests`.

## 6. Análise e cards futuros

- [x] 6.1 Registrar em `design.md`/comentário no card a análise de impactos e limitações (retardo por tipo sem cálculo de cronograma, sem cross-project, sem caminho crítico, interação com agregadores e com o futuro tipo dependência externa). Verificar revisão do texto.
- [x] 6.2 Criar os cards futuros derivados desta feature (replanejamento automático de datas, caminho crítico, dependências cross-project, integração com o tipo `dependência externa` do T47 e tools MCP/Azy Agent para dependências), sem duplicar cards existentes. Verificar no board real que os cards foram criados na hierarquia correta.

## 7. Verificação final

- [x] 7.1 Rodar `bun run check` (typecheck + lint + persistência + boundary + testes + build) e garantir verde.
- [x] 7.2 Rodar `bun run test:smoke` para o fluxo web/API.
- [x] 7.3 Validação manual: criar, editar e remover dependências pela aba do card; confirmar o bloqueio de ciclo e a remoção ao excluir item de origem/alvo; confirmar RBAC; conferir a coluna Dependências na Árvore e o ícone+contagem no card do board.

## Workflow follow-up

- Arquivar a change após a revisão e aprovação do projeto.
- Encerrar o card T46 (`11feedcb-150d-4eb1-8d6f-98312f43184e`) com `complete_task` e confirmar no board real o `status` DONE, pois encerrar a change não encerra o card.
