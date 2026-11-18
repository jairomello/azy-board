## MODIFIED Requirements

### Requirement: Progresso de items na Tree View

O sistema SHALL calcular e exibir progresso percentual na Tree View para items `TASK`, `BUG`, `STORY` e `EPIC`, usando as folhas de progresso do subárvore: itens sem filhos dos tipos `TASK`, `BUG`, `STORY` ou `EPIC`, não cancelados e não arquivados. Uma folha SHALL valer o avanço definido pelo seu status, refinado pela coluna e pelo checklist quando existir; folha cancelada SHALL exibir "—"; agrupadores sem folhas recebem 0% e agrupadores só com folhas canceladas exibem "—". `EXTERNAL` SHALL exibir "—" e não pesar no pai.

#### Scenario: Task concluída exibe progresso completo

- **WHEN** uma TASK folha com status `DONE` é exibida na Tree View
- **THEN** sua linha exibe barra de progresso em 100%

#### Scenario: Bug não concluído exibe progresso zero

- **WHEN** um BUG folha com status `NOT_STARTED` está em uma coluna de trabalho não iniciado, cujo peso é 0
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

#### Scenario: Folha concluída fora da coluna final

- **WHEN** uma TASK folha com status `DONE` ainda está na coluna Backlog
- **THEN** sua linha exibe barra de progresso em 100%

#### Scenario: Folha cancelada

- **WHEN** uma TASK folha tem status `CANCELLED`
- **THEN** sua linha exibe "—" e ela não entra na média do agrupador
