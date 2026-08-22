## MODIFIED Requirements

### Requirement: Lanes colapsáveis de EPIC e STORY no board
O sistema SHALL exibir uma lane principal por item com `type = EPIC` somente quando o projeto estiver no modo `HIERARCHICAL`. Quando `storyDisplay = lanes`, cada item `STORY` SHALL formar uma lane horizontal aninhada no EPIC e conter os cards `TASK` e `BUG` pertencentes à sua ancestralidade, com a Leaf Rule e os filtros ativos aplicados. No modo `SIMPLE`, o sistema SHALL exibir apenas a STORY fixa e suas colunas, sem lanes de EPIC ou módulo.

#### Scenario: Board hierárquico exibe swimlane de épico
- **WHEN** usuário abre um projeto `HIERARCHICAL`
- **THEN** sistema exibe as swimlanes de EPIC e, no modo `lanes`, as lanes de STORY aninhadas com seus cards descendentes

#### Scenario: Board simples oculta swimlanes hierárquicas
- **WHEN** usuário abre um projeto `SIMPLE`
- **THEN** sistema não exibe swimlanes de módulo ou EPIC e mostra a STORY fixa com as colunas e cards TASK/BUG

#### Scenario: Colapsar swimlane de épico
- **WHEN** usuário clica no header da swimlane de um EPIC em projeto `HIERARCHICAL`
- **THEN** a lane colapsa, exibindo apenas o título do épico, progresso geral e contagem de histórias e cards

#### Scenario: Expandir swimlane de épico
- **WHEN** usuário clica no header colapsado do EPIC em projeto `HIERARCHICAL`
- **THEN** a lane expande exibindo as lanes de histórias daquele EPIC

#### Scenario: Colapsar lane de história
- **WHEN** usuário clica no header de uma STORY no modo `lanes` em projeto `HIERARCHICAL`
- **THEN** a lane da história colapsa independentemente do EPIC e mantém apenas título, contagem e progresso

#### Scenario: Expandir lane de história
- **WHEN** usuário clica no header colapsado de uma STORY em projeto `HIERARCHICAL`
- **THEN** a lane expande exibindo suas colunas e cards descendentes

#### Scenario: Estado de colapso persistido por projeto
- **WHEN** usuário colapsa um EPIC ou uma STORY, navega para outra página e retorna ao projeto hierárquico
- **THEN** os estados colapsados são restaurados separadamente para o projeto

#### Scenario: Progresso do EPIC no header da swimlane
- **WHEN** swimlane de um EPIC é exibida em projeto `HIERARCHICAL`
- **THEN** o header exibe o percentual de progresso calculado com base nos items TASK/BUG folha descendentes concluídos

#### Scenario: Cards do épico sem história ancestral
- **WHEN** um card possui EPIC ancestral, mas não possui STORY ancestral em projeto `HIERARCHICAL`
- **THEN** o card aparece no agrupamento `Sem história` dentro do EPIC

#### Scenario: Filtros do modo simples
- **WHEN** usuário aplica filtros em projeto `SIMPLE`
- **THEN** filtro de módulo não é exibido ou fica indisponível, enquanto filtros de sprint, responsável, tipo e tags continuam filtrando os cards do fluxo único

### Requirement: Controles globais de expansão de swimlanes
O sistema SHALL exibir os controles "Expandir tudo" e "Recolher tudo" para lanes somente em projetos `HIERARCHICAL` na view Kanban. Em projetos `SIMPLE`, esses controles SHALL ser ocultados porque não existem swimlanes hierárquicas para expandir.

#### Scenario: Controles disponíveis no modo hierárquico
- **WHEN** usuário está na view Kanban de projeto `HIERARCHICAL`
- **THEN** sistema exibe os controles para expandir ou recolher as lanes existentes

#### Scenario: Controles ocultos no modo simples
- **WHEN** usuário está na view Kanban de projeto `SIMPLE`
- **THEN** sistema não exibe os controles globais de expansão

#### Scenario: Controles ocultos na view Árvore
- **WHEN** usuário está na view Árvore de qualquer projeto
- **THEN** botões "Expandir tudo" e "Recolher tudo" não são exibidos na toolbar
