# Spec Delta

## MODIFIED Requirements

### Requirement: Progresso de items na Tree View

O sistema SHALL calcular e exibir progresso percentual na Tree View para items `TASK`, `BUG`, `STORY` e `EPIC`, usando somente folhas `TASK`/`BUG` não arquivadas do subárvore. Uma folha SHALL valer o avanço da sua coluna, refinado pelo checklist quando existir; agrupadores sem folhas recebem 0%.

#### Scenario: Task concluída exibe progresso completo

- **WHEN** uma TASK folha com status `DONE` é exibida na Tree View
- **THEN** sua linha exibe barra de progresso em 100%

#### Scenario: Bug não concluído exibe progresso zero

- **WHEN** um BUG folha com status diferente de `DONE` está em uma coluna de trabalho não iniciado, cujo peso é 0
- **THEN** sua linha exibe barra de progresso em 0%

#### Scenario: Bug em progresso exibe o avanço da coluna

- **WHEN** um BUG folha está em uma coluna `IN_PROGRESS` cujo peso é 90
- **THEN** sua linha exibe barra de progresso em 90%

#### Scenario: Agrupador calcula progresso acumulado

- **WHEN** uma STORY ou EPIC possui quatro folhas descendentes, sendo duas concluídas e duas com avanço de 50%
- **THEN** sua linha exibe progresso de 75%

#### Scenario: Agrupador sem folhas

- **WHEN** um item agrupador não possui TASK/BUG folha descendente
- **THEN** sua linha exibe progresso de 0% sem erro
