## Why

Operações hierárquicas fazem consultas repetidas por nó ou nível: reparent percorre cada ancestral e descendente, exclusão de subárvore consulta filhos recursivamente dentro da transação, `isLeaf` carrega todos os itens do projeto para verificar um único pai, e abertura de ciclo de sprint consulta vínculos e filhos item a item. O custo cresce com o tamanho/profundidade da árvore, aumenta a latência e mantém transações SQLite abertas por mais tempo; o Item 14 requer subárvores carregadas em lote e atualizações apoiadas por índice.

## What Changes

- Substituir a detecção de ciclos por leituras repetidas pela validação a partir do `ancestryPath` do novo pai, mantendo validação contra ciclos e limite de profundidade.
- Adicionar operações de persistência em lote para consultar se um item tem filhos, carregar subárvores e snapshots/relacionamentos necessários a operações em lote.
- Reimplementar atualização de `ancestryPath`, exclusão/arquivamento de subárvore e abertura de ciclo de sprint sem uma consulta por nó/item.
- Implementar estratégia compatível com os dois adapters: SQLite no perfil SIMPLE (perfil padrão inclusive no deploy atual) e PostgreSQL no ADVANCED. Usar CTE recursiva onde suportada, com reconstrução/batch update dentro da transação; não depender exclusivamente de PostgreSQL.
- Adicionar índice composto `items(tenant_id, project_id, parent_id)` nas migrations SQLite e PostgreSQL.
- Preservar atomicidade, isolamento por `tenant_id` e `project_id`, Leaf Rule, eventos analíticos, coleta de anexos/outbox e ordenação determinística.
- Adicionar testes de equivalência funcional e de limite de consultas, incluindo árvores largas/profundas, item folha e não folha, remoção em cascata e criação de ciclo de sprint.

## Capabilities

### New Capabilities
<!-- Nenhuma. A hierarquia de itens já é definida por task-hierarchy. -->

### Modified Capabilities
- `task-hierarchy`: operações sobre ancestry/subárvores e determinação da Leaf Rule SHALL manter custo de acesso ao banco limitado por operação/lote, independente do número de nós descendentes, preservando a hierarquia e os breadcrumbs existentes.

## Impact

- **API:** `apps/api/src/routes/items.ts` (detecção de ciclo e `isLeaf`); transição de sprint em `apps/api/src/db/sqlite/adapter.ts` e `apps/api/src/db/postgres/adapter.ts` (materialização de folhas set-based).
- **Persistência/SQLite:** `apps/api/src/db/sqlite/itemUnitOfWork.ts`, `apps/api/src/db/sqlite/adapter.ts`, migrations SQLite e testes de unidade/query count.
- **Persistência/PostgreSQL:** `apps/api/src/db/postgres/adapter.ts`, migrations PostgreSQL e testes do adapter; `reparentSubtree` está atualmente não implementado nesse adapter e precisa de comportamento equivalente.
- **Contratos internos:** `apps/api/src/persistence/ports.ts` e, se necessário, `models.ts` para operações em lote.
- **Dados:** índice composto em `items(tenant_id, project_id, parent_id)` nos dois mecanismos; sem alteração do formato persistido de `ancestry_path`.
- **Rastreabilidade:** Board ref: 216008b9-6025-4321-b05f-661192248fde (card "Item 14: Há N+1 em operações hierárquicas").
- **Fora de escopo:** migrar o perfil SIMPLE para PostgreSQL, alterar regras de hierarquia/Leaf Rule, redesenhar `ancestry_path` ou otimizar consultas sem relação com operações hierárquicas.
