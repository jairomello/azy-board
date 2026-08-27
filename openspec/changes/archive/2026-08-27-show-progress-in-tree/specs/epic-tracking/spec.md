## MODIFIED Requirements

### Requirement: Swimlanes colapsáveis por EPIC com progresso
O sistema SHALL exibir swimlanes no board agrupadas por items com `type = EPIC`. Progresso e pontos são calculados com base nos items TASK/BUG folha descendentes. A mesma regra de folhas concluídas SHALL ser usada para o progresso acumulado dos EPICs exibidos na Tree View.

#### Scenario: Progresso do EPIC calculado via descendentes folha
- **WHEN** swimlane de EPIC é exibida
- **THEN** header exibe `(items TASK/BUG folha com status DONE / total items TASK/BUG folha) * 100` como porcentagem com barra visual

#### Scenario: Progresso do EPIC na Tree View
- **WHEN** um EPIC é exibido na Tree View
- **THEN** sua linha exibe a mesma porcentagem baseada nas folhas TASK/BUG descendentes não arquivadas

#### Scenario: Pontos totais do EPIC no header
- **WHEN** swimlane de EPIC é exibida
- **THEN** header exibe a soma dos `points` de todos os items TASK/BUG folha descendentes do EPIC

#### Scenario: Colapsar swimlane de EPIC
- **WHEN** usuário clica no header da swimlane
- **THEN** raia colapsa exibindo apenas título do EPIC, progresso e contagem de cards por coluna
