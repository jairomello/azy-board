# Design

## Context

Ver `proposal.md — Why`. O ponto de partida: itens são uma entidade unificada (`items`) com `type` e `parentId`; vínculos filho a filho já existem no padrão `item_links` (tabela com FK composta para `items`, rota dedicada, componente de aba lazy, RBAC e idempotência). Não há qualquer conceito de dependência/cronograma hoje (busca por `predecessor`/`dependenc` só encontra rotas de agente e cascatas de exclusão). A instalação tem dois perfis (SQLite e PostgreSQL) com migrations separadas e adaptadores espelhados, e a `deletion-integrity` exige política de exclusão documentada/testada para toda tabela filha nova.

## Goals / Non-Goals

**Goals:**
- Modelo `item_dependencies` multi-tenant com tipo (FS/SS/SF/FF) e retardo assinado.
- CRUD pela API e aba no card, seguindo fielmente o padrão de `item_links`.
- Validação de ciclos no backend antes de persistir.
- Exclusão em cascata nos dois extremos (origem e alvo) integrada à auditoria de integridade.
- Paridade SQLite/PostgreSQL (schema, migration, adaptadores, markers).

**Non-Goals:**
- Replanejamento automático de datas, caminho crítico e nivelamento de recursos.
- Dependências cross-project.
- Ferramentas MCP / Azy Agent para dependências (cards futuros).
- Broadcast em tempo real específico de dependências; o refresh do card seguirá os eventos de item já existentes.

## Decisions

### 1. Tabela `item_dependencies` com FK composta dupla e unicidade por par
Nova tabela com `id`, `tenant_id`, `project_id`, `item_id` (origem), `depends_on_item_id` (alvo), `dependency_type`, `lag_days`, `created_at`, `updated_at`.

- Duas FKs compostas `[tenant_id, item_id] → items[tenant_id, id]` e `[tenant_id, depends_on_item_id] → items[tenant_id, id]`, ambas `ON DELETE CASCADE`, garantem isolamento por tenant no banco e cascata nos dois sentidos.
- `UNIQUE (tenant_id, item_id, depends_on_item_id)`: um único vínculo por par, como no MS Project. Evita duplicatas e simplifica a detecção de ciclo.
- `CHECK` de `dependency_type IN ('FS','SS','SF','FF')` e `lag_days` inteiro.
- Índices de listagem por `(tenant_id, project_id, item_id, created_at)` e por `(tenant_id, depends_on_item_id)` (necessário para a varredura de ciclo e para a cascata reversa).

**Alternativas:** relacionamento polimórfico genérico `item_relations` — rejeitado por acoplar tipos de vínculo diferentes (link externo vs. dependência) e dificultar constraints; tabela sem FK composta — rejeitada por furar o isolamento multi-tenant.

### 2. Detecção de ciclo em memória (BFS) na camada de serviço
Antes de gravar, o serviço carrega as arestas de dependência do projeto (consulta única escopada por tenant+projeto) e faz BFS a partir de `dependsOnItemId`: se alcançar `itemId`, rejeita. Na edição, considera o vínculo em atualização.

**Por que não CTE recursiva:** exigiria SQL específico duplicado em SQLite e PG; a BFS em JS usando um método de porta `listByProject` é portável, testável e suficiente para o volume de um board. **Alternativa** de validação só na UI/ao replanejar — rejeitada por permitir estado inválido.

### 3. Endpoint dedicado, sem embutir no `GET /items/:itemId`
`GET/POST/PATCH/DELETE /projects/:projectId/items/:itemId/dependencies`, espelhando `itemLinksRouter` (helper `authorizedItem`, `requireRole`, `parseJson`, idempotência no POST via `COMMAND_NAMESPACES`). A listagem retorna a dependência com um resumo do item dependido (`id`, `title`, `type`, `sequenceCode`, `status`) para a UI não precisar de uma segunda chamada. Não embutimos em `GET /items/:itemId` para não inflar payload de resposta quente.

**Alternativa:** campo `dependencies` na resposta do item — rejeitada por acoplar a feature ao endpoint central e crescer o payload do board.

### 4. Origem e alvo podem ser qualquer item do mesmo projeto
O alvo é validado como item existente e pertencente ao mesmo tenant/projeto, sem restrição de tipo. Isso cobre "tasks e outros itens aplicáveis" e prepara o tipo `dependência externa` (T47) sem código novo. A origem também pode ser qualquer item.

**Alternativa:** restringir a folhas (TASK/BUG) — rejeitada pela decisão do usuário; excluiria marcos em STORY/EPIC.

### 5. UI: nova aba lazy seguindo `ItemLinksArea`
`ItemDependenciesArea` entra na união de abas de `ItemModal` (lazy + `Suspense`), com estado local, `AbortController` e `lib/api.ts`. O seletor de alvo busca os itens do projeto via endpoint de itens existente, com busca no cliente, excluindo o próprio item e os já vinculados; o backend continua sendo a fonte de verdade para ciclo. Textos adicionados em PT-BR/EN/ES no `board.json`.

**Alternativa:** usar o modal de seleção de card já existente se houver reuso trivial; caso contrário, um `Select`/combobox simples é suficiente para o CRUD.

### 6. Vocabulário e contratos em packages
Enum `ItemDependencyType` em `packages/domain`; `ItemDependency` em `packages/ui-contracts`; `ItemDependencyRecord`/`NewItemDependencyRecord`/`ItemDependencyPatch` em `apps/api/src/persistence/models.ts`; porta `ItemDependencyPort` em `ports.ts`. Mantém a fronteira já validada por `check:api-boundary`/`check:persistence`.

### 7. Contagem e resumo no payload de itens (board e árvore)
Os itens retornados por `GET /projects/:id/items` (board) e `GET /projects/:id/items/tree` passam a incluir `dependencies` (resumo: `id`, `sequenceCode`, `title`, `type` e o tipo da dependência) e `dependencyCount`. A contagem é calculada como número de arestas de saída do item (`itemId`) e agregada por item numa consulta única escopada por tenant/projeto — não expande a cadeia.

**Por que resumo e não o registro completo:** o card e a coluna da árvore só precisam de identificação; expor o registro inteiro inflaria o payload do board. **Alternativa:** endpoint dedicado consumido card a card — rejeitada por multiplicar requisições no board.

### 8. Coluna "Dependências" na Tree View
A Tree View ganha uma coluna que lista os itens dependidos, priorizando `sequenceCode` com fallback de título, no espírito da coluna de predecessores do MS Project. A célula é vazia quando não há dependências. O componente segue o padrão da tabela hierárquica existente e não altera as demais colunas.

**Alternativa:** mostrar só o número de dependências — rejeitada porque a coluna deve identificar *quais* itens (diagnóstico de cronograma), que é o pedido do usuário.

### 9. Indicador de dependências no card
O card exibe ícone + contagem quando `dependencyCount > 0`, omitido quando zero, na linha de topo próxima ao ícone/código, com nome acessível. É somente leitura (também para VIEWER) e não interfere em arraste, hover ou abertura de detalhes.

**Alternativa:** colocar no rodapé junto a prioridade/pontos/avatar — viável, mas o topo mantém a leitura imediata de "este card tem predecessores" e evita disputar a ordem do rodapé já especificada em `kanban-card-layout`.

## Risks / Trade-offs

- **Corrida na checagem de ciclo (TOCTOU)** → a constraint única e a transação de escrita reduzem a janela; um ciclo introduzido por concorrência extrema é aceito como risco baixo nesta entrega, mitigável depois com verificação serializada.
- **Duas FKs em cascata no SQLite** → `PRAGMA foreign_keys` é desligado durante a migration; a política entra nos `CHECKS` de `integrity.ts` e nos deletes explícitos de `itemUnitOfWork.ts`/`postgres/adapter.ts` para não depender só do banco.
- **Ausência de paridade PG pronta para `item_links`** → o espelho PG é feito por SQL escrito à mão; a tarefa inclui explicitamente criação de migration PG + queries no adaptador + teste de paridade.
- **Orçamento de bundle** → a aba é um chunk lazy próprio; validar com `bun run check:bundle` e entrar em `bundle-budget.json` se necessário, sem reajustar regras existentes sem análise.
- **Interpretação do retardo por tipo (SS/SF/FF)** → aqui só armazenamos tipo e retardo; a semântica de aplicação sobre datas fica para o card futuro de replanejamento. Limitação registrada para não induzir a achar que o cronograma já é calculado.
- **Dependência apontando para item-pai (agregador)** → permitido por decisão, mas o status do pai é agregado; a UI deve deixar claro o tipo do item alvo para evitar confusão.
- **Custo de agregação da contagem no payload do board/árvore** → resolver com uma consulta agregada única por projeto (group by `item_id` e group by `depends_on_item_id`), evitando N+1; medir com o orçamento de payload existente.
- **Crescimento de payload do board** → enviar apenas o resumo (código/título/tipo) e reutilizar a projeção leve já existente; o `check:bundle` cobre o lado web, mas o payload da API deve ser observado.
- **Coluna extra na árvore em telas estreitas** → permitir scroll horizontal/ocultar coluna em larguras pequenas, como as demais colunas opcionais.

## Migration Plan

1. Gerar migration SQLite (próxima sequência após `0046_*`) com tabela, FKs, unique, checks e índices; atualizar snapshot/journal.
2. Escrever migration PG equivalente em `apps/api/src/db/postgres/migrations/` (auto-suficiente, timestamptz, CHECKs, FK composta).
3. Registrar a tabela em `installationMarkers.ts` (`APP_TABLES`) e `postgres/index.ts`; adicionar checks em `integrity.ts`; incluir nos deletes em cascata explícitos.
4. Implementar porta/adaptadores e rota; depois web.
5. Rollback: como a tabela é nova e independente, reverter o deploy remove as migrations novas; dados existentes não são afetados. Sem alteração em colunas de `items`.

## Open Questions

- Reuso de um componente de seleção de card já existente para o picker de alvo — decidir na implementação; não altera specs nem o plano.
- Se `dependsOnItemId` deve ser exposto também no `GET /items` do board para futuros indicadores visuais — avaliar em card futuro de cronograma.
