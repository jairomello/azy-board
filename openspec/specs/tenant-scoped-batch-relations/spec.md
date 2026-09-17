# tenant-scoped-batch-relations Specification

## Purpose
TBD - created by archiving change tenant-scoped-batch-relations. Update Purpose after archive.
## Requirements
### Requirement: Relações de batch limitadas ao tenant e projeto

O sistema SHALL carregar relações `item_sprints` e `item_tags` somente quando `tenant_id` da relação, `tenant_id` do item e `project_id` do item corresponderem ao contexto autenticado do batch. A seleção SHALL ocorrer no banco por join ou `EXISTS`, sem carregar as tabelas globais para filtrar em memória.

#### Scenario: Batch com sprint do projeto
- **WHEN** o usuário executa atualização em lote filtrando por sprint de seu projeto
- **THEN** somente itens do projeto/tenant com vínculo nessa sprint são selecionados

#### Scenario: Batch com tag do projeto
- **WHEN** o usuário executa atualização em lote filtrando por tag de seu projeto
- **THEN** somente itens do projeto/tenant com vínculo nessa tag são selecionados

#### Scenario: Relação de outro tenant
- **WHEN** existe uma relação com o mesmo `item_id`, `tag_id` ou `sprint_id` textual em outro tenant
- **THEN** essa relação não é carregada, não influencia `matched` e não é alterada pelo batch atual

#### Scenario: Relação fora do projeto
- **WHEN** uma tag ou sprint pertence ao mesmo tenant mas está vinculada a item de outro projeto
- **THEN** a relação não participa do filtro do projeto atual

### Requirement: Semântica pública do batch preservada

O sistema SHALL manter o payload, os filtros, o resultado por item, a idempotência e o comportamento `atomic` existentes após a restrição das relações. O resultado SHALL ser determinístico e deduplicado mesmo se a base legada contiver vínculos repetidos.

#### Scenario: Nenhuma relação corresponde
- **WHEN** os filtros são válidos mas nenhum item possui o vínculo dentro do escopo
- **THEN** o batch retorna o mesmo erro/resultado `NO_ITEMS_MATCHED` previsto atualmente, sem modificar itens

#### Scenario: Lote atômico com relações escopadas
- **WHEN** um lote `atomic=true` altera itens selecionados por tag/sprint e uma operação falha
- **THEN** toda a operação é revertida e relações de outros tenants permanecem inalteradas

#### Scenario: Repetição idempotente
- **WHEN** o mesmo batch é repetido com a mesma chave e payload
- **THEN** a resposta idempotente permanece igual e nenhuma relação global é recarregada para compor o resultado

### Requirement: Isolamento verificável e consulta limitada

O sistema SHALL testar que o conjunto de relações carregado é limitado ao projeto/tenant e SHALL evitar crescimento de memória proporcional às relações de todos os tenants. A implementação SHALL preservar índices/constraints ou justificar migration aditiva baseada em plano de consulta.

#### Scenario: Dois tenants com relações homônimas
- **WHEN** dois tenants possuem tags/sprints com o mesmo nome e o batch filtra pelo nome no tenant atual
- **THEN** somente o vínculo resolvido no tenant atual seleciona itens

#### Scenario: Base populada com relações externas
- **WHEN** a base contém muitas relações de outros projetos/tenants
- **THEN** a consulta do batch retorna somente pares do projeto atual e o teste confirma que não houve carga integral dessas relações

