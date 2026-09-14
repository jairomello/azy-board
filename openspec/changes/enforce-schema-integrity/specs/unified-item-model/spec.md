## ADDED Requirements

### Requirement: Hierarquia de items reforçada no banco
Além da validação na camada de serviço, `items.parent_id` SHALL possuir auto-chave estrangeira composta `(tenant_id, parent_id) → items(tenant_id, id)`, garantindo que o pai exista e pertença ao mesmo tenant. `projects.manager_user_id` e `projects.simple_story_id` SHALL possuir chaves estrangeiras compostas equivalentes.

#### Scenario: Hierarquia inválida barrada pelo banco
- **WHEN** uma gravação tenta definir pai fora do tenant, pai inexistente, gerente de outro tenant ou story fixa de outro tenant
- **THEN** o banco rejeita a operação e mantém a árvore consistente

#### Scenario: Regras de tipo continuam na aplicação
- **WHEN** um item é criado respeitando a hierarquia de tipos (STORY filha de EPIC, TASK/BUG filha de STORY/TASK/BUG)
- **THEN** a operação é aceita e persiste com o vínculo correto

#### Scenario: Exclusão de ancestral preserva integridade
- **WHEN** um item com filhos é excluído pelo fluxo de exclusão em cascata
- **THEN** os descendentes são removidos na mesma operação e nenhuma violação de chave estrangeira permanece
