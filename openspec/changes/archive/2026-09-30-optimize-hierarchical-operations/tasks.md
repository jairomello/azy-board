## 1. Contratos de persistência e migrations

- [x] 1.1 Estender `WorkItemPort`/unit-of-work com operações de existência de filhos e leitura em lote da subárvore/snapshots, mantendo `tenantId` e `projectId` explícitos
- [x] 1.2 Criar migration SQLite e migration PostgreSQL para índice `items(tenant_id, project_id, parent_id)`; atualizar snapshots/schema declarations e testes de migration
- [x] 1.3 Adicionar testes de contrato dos novos métodos: subárvore limitada ao projeto/tenant, profundidade determinística e `hasChildren` correto para folha/pai

## 2. Adapter SQLite: ancestry e subárvore em lote

- [x] 2.1 Substituir `collectSubtree` em `db/sqlite/itemUnitOfWork.ts` por CTE recursiva com filtro por tenant/projeto e limite de profundidade; retornar os campos mínimos necessários à operação
- [x] 2.2 Refatorar `refreshDescendantAncestry` para carregar a subárvore uma vez, calcular `ancestryPath` a partir do mapa em memória e gravar paths em batches dentro da mesma transação
- [x] 2.3 Usar a coleta única em `deleteItemSubtree`, `archiveItemSubtree` e `deleteModuleAggregate` (união das subárvores dos EPICs), removendo `itemById`/SELECT de filhos por nó
- [x] 2.4 Coletar snapshots, anexos e checklists/relacionamentos da subárvore em lote antes de excluir; manter eventos analíticos, ordem filhos-primeiro e outbox de storage
- [x] 2.5 Estender `itemUnitOfWork.test.ts`: reparent profundo, rename de ancestral, exclusão/archive cascade, ciclo/profundidade, rollback/outbox e equivalência exata de paths

## 3. Adapter PostgreSQL: paridade hierárquica

- [x] 3.1 Implementar `reparentSubtree` (hoje `NOT_IMPLEMENTED`) com CTE recursiva e updates em lote, preservando ciclo, profundidade e eventos analíticos
- [x] 3.2 Implementar coleta/atualização/exclusão de subárvore set-based no unit-of-work PostgreSQL, incluindo snapshots e relações dependentes em lote
- [x] 3.3 Adicionar testes do adapter PostgreSQL para reparent/delete em árvore profunda, isolamento tenant/projeto e limite de consultas

## 4. Eliminar os N+1 nas rotas/analytics

- [x] 4.1 Remover `isLeaf` de `routes/items.ts` baseado em `listItems` de todo o projeto; usar `hasChildren` indexado no persistence port e atualizar testes das rotas de move
- [x] 4.2 Substituir `detectReparentCycle` (uma leitura por ancestral) por verificação usando o `ancestryPath` do novo pai em uma leitura, mantendo `MAX_ANCESTRY_DEPTH` e erro de ciclo
- [x] 4.3 Refatorar o caminho ativo de abertura de sprint em `db/sqlite/adapter.ts` (hoje consulta vínculo/filho por item) para `INSERT ... SELECT` com join + `NOT EXISTS`; implementar paridade no `db/postgres/adapter.ts` e cobrir seleção de folhas
- [x] 4.4 Revisar os hotspots do Item 14 e adicionar contrato/teste de contagem de consultas para garantir que não reste SELECT por nó/nível nos fluxos cobertos

## 5. Verificação e documentação

- [x] 5.1 Rodar testes de adapters SQLite/PostgreSQL, integração de hierarquia e regressão; `bun run check` e `bun run test:smoke` sem falhas
- [x] 5.2 Atualizar `docs/ANALISE-SISTEMA.md` (Item 14 resolvido, perfil SQLite e limites de batches/CTE documentados)
- [x] 5.3 Registrar `Board ref: 216008b9-6025-4321-b05f-661192248fde` nos artefatos da change e concluir o card com `complete_task` após a verificação final
