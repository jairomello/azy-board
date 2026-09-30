## ADDED Requirements

### Requirement: Operações hierárquicas não executam consultas N+1
O sistema SHALL carregar os ancestrais/descendentes necessários a uma operação hierárquica em consulta recursiva ou lote limitado, e SHALL NOT executar uma leitura por nó, pai ou nível da árvore. Atualizações de ancestry e relações dependentes SHALL ser aplicadas em lote limitado pelo adapter, dentro da transação existente. Essa garantia SHALL valer nos perfis SIMPLE (SQLite) e ADVANCED (PostgreSQL), mantendo todos os filtros de `tenant_id` e `project_id`.

#### Scenario: Reparent mantém o número de leituras limitado pela operação
- **WHEN** um item é reparentado em uma subárvore rasa ou profunda
- **THEN** ancestral, descendentes e novos caminhos são resolvidos em leituras em lote/CTE, sem uma consulta por nível ou descendente, e o `ancestryPath` resultante permanece correto

#### Scenario: Verificação de folha consulta apenas a existência de filhos
- **WHEN** o sistema verifica se um item pode ser movido como folha
- **THEN** executa uma consulta indexada de existência por tenant/projeto/pai, sem carregar todos os itens do projeto

#### Scenario: Exclusão de subárvore descobre filhos em lote
- **WHEN** um item com descendentes é excluído ou arquivado
- **THEN** a subárvore é coletada por uma consulta recursiva/lote, os dados dependentes são carregados em lote e a operação preserva atomicidade, analytics e outbox de anexos

#### Scenario: Abertura de ciclo de sprint identifica folhas em lote
- **WHEN** um ciclo de sprint é aberto e seus itens são materializados
- **THEN** vínculos da sprint e condição de folha são resolvidos set-based, sem consultas de sprint/filho por item

#### Scenario: Isolamento da recursão por tenant e projeto
- **WHEN** uma operação hierárquica percorre descendentes
- **THEN** a âncora e cada passo recursivo restringem simultaneamente `tenant_id` e `project_id`, sem incluir nós de outra partição
