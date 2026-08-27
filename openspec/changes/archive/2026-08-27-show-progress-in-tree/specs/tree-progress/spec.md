## ADDED Requirements

### Requirement: Progresso de items na Tree View
O sistema SHALL calcular e exibir progresso percentual na Tree View para items `TASK`, `BUG`, `STORY` e `EPIC`, usando somente folhas `TASK`/`BUG` não arquivadas do subárvore. Uma folha com status `DONE` vale 100%; qualquer outro status vale 0%; agrupadores sem folhas recebem 0%.

#### Scenario: Task concluída exibe progresso completo
- **WHEN** uma TASK folha com status `DONE` é exibida na Tree View
- **THEN** sua linha exibe barra de progresso em 100%

#### Scenario: Bug não concluído exibe progresso zero
- **WHEN** um BUG folha com status diferente de `DONE` é exibido
- **THEN** sua linha exibe barra de progresso em 0%

#### Scenario: Agrupador calcula progresso acumulado
- **WHEN** uma STORY ou EPIC possui quatro folhas descendentes, sendo duas concluídas
- **THEN** sua linha exibe progresso de 50%

#### Scenario: Agrupador sem folhas
- **WHEN** um item agrupador não possui TASK/BUG folha descendente
- **THEN** sua linha exibe progresso de 0% sem erro

### Requirement: Progresso consistente com filtros e modos
O cálculo SHALL considerar somente os itens presentes no resultado autorizado e filtrado da árvore, SHALL excluir items arquivados e SHALL funcionar tanto na árvore hierárquica quanto na STORY fixa do modo `SIMPLE`.

#### Scenario: Progresso após filtro
- **WHEN** um filtro remove uma das folhas descendentes de um agrupador
- **THEN** o percentual do agrupador é recalculado usando somente as folhas restantes

#### Scenario: Item arquivado não altera progresso
- **WHEN** uma folha concluída é arquivada
- **THEN** ela não é considerada no cálculo de progresso da árvore

#### Scenario: Progresso no modo simples
- **WHEN** usuário abre a Tree View de projeto `SIMPLE`
- **THEN** a STORY fixa e seus agrupadores/folhas exibem o progresso calculado sem inventar módulos ou épicos
