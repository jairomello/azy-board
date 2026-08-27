## MODIFIED Requirements

### Requirement: Filtros e opções no toolbar do board
O sistema SHALL exibir filtros de conteúdo em um painel acionado pelo botão `Filtros` da command bar. O painel SHALL conter Squad, Módulo, Sprint, Responsável, Autor, Versão, Prioridade, Status, tipos e tags. Os controles de visualização, incluindo Mostrar subtasks, alternância de histórias entre lanes e cards, Hierarquia/Abas, Expandir tudo, Recolher tudo e ocultação de lanes vazias, SHALL estar no painel separado acionado pelo botão `Opções`. O estado SHALL ser persistido no `localStorage` e o modo de módulos SHALL ser persistido por projeto e restaurado nas visitas subsequentes ao board.

#### Scenario: Filtro por módulo
- **WHEN** o usuário seleciona um módulo no painel Filtros
- **THEN** apenas cards cujos épicos pertencem ao módulo selecionado são exibidos

#### Scenario: Filtro por sprint
- **WHEN** o usuário seleciona um sprint no painel Filtros
- **THEN** apenas cards associados ao sprint selecionado são exibidos

#### Scenario: Filtro por responsável
- **WHEN** o usuário seleciona um responsável no painel Filtros
- **THEN** apenas cards atribuídos ao responsável selecionado são exibidos

#### Scenario: Filtro por autor
- **WHEN** o usuário seleciona um autor no painel Filtros
- **THEN** apenas cards cujo `authorId` corresponde ao autor selecionado são exibidos

#### Scenario: Filtro por versão
- **WHEN** o usuário seleciona uma versão no painel Filtros
- **THEN** apenas itens cujo `versionId` corresponde à versão selecionada são exibidos

#### Scenario: Filtro por prioridade
- **WHEN** o usuário seleciona uma prioridade no painel Filtros
- **THEN** apenas cards com a prioridade selecionada são exibidos

#### Scenario: Filtro por status
- **WHEN** o usuário seleciona um status no painel Filtros
- **THEN** apenas cards com o status selecionado são exibidos

#### Scenario: Filtro por tipo de card
- **WHEN** o usuário seleciona um ou mais tipos (`TASK`, `BUG`) no painel Filtros
- **THEN** apenas cards dos tipos selecionados são exibidos

#### Scenario: Filtro por tag
- **WHEN** o usuário seleciona uma ou mais tags no painel Filtros
- **THEN** apenas cards que possuem pelo menos uma das tags selecionadas são exibidos

#### Scenario: Múltiplos filtros ativos
- **WHEN** mais de um filtro está ativo simultaneamente
- **THEN** os filtros são combinados com AND entre dimensões e OR entre as tags selecionadas da mesma dimensão

#### Scenario: Item sem vínculo correspondente
- **WHEN** um filtro de versão, autor ou tag está ativo e um item não possui esse vínculo
- **THEN** o item não é exibido

#### Scenario: Filtros no modo simples
- **WHEN** usuário aplica autor, versão, prioridade, status ou tag em projeto `SIMPLE`
- **THEN** os filtros são aplicados aos cards do fluxo único sem exigir módulo ou épico

#### Scenario: Limpar filtros
- **WHEN** o usuário clica em "Limpar filtros" no painel Filtros
- **THEN** filtros de conteúdo e ocultações de lanes vazias são removidos
- **AND** `showSubtasks`, `storyDisplay` e `moduleViewMode` são preservados
- **AND** o `localStorage` é atualizado

#### Scenario: Indicador de filtro ativo
- **WHEN** pelo menos um filtro de conteúdo está ativo
- **THEN** um indicador visual (contagem ou ponto) é exibido no botão Filtros

#### Scenario: Alternar modo de módulos
- **WHEN** o usuário alterna entre `Hierarquia` e `Abas` no painel Opções
- **THEN** o Board preserva os filtros aplicados e restaura o modo selecionado ao recarregar o projeto

### Requirement: Filtros aplicados client-side
Os filtros SHALL ser aplicados sobre a lista de tasks em memória (`displayedTasks`), sem re-fetch da API ao mudar filtros, usando os campos de prioridade, status, autor, versão e tags já carregados ou derivados do projeto.

#### Scenario: Alterar filtro sem recarregar itens
- **WHEN** o usuário altera qualquer filtro do Board
- **THEN** a lista visível é recalculada a partir dos itens já carregados
- **AND** nenhuma nova consulta de itens é necessária

#### Scenario: Filtrar por versão sem nova consulta
- **WHEN** o usuário altera a versão selecionada
- **THEN** o Board recalcula os itens visíveis usando `versionId` em memória
- **AND** não solicita novamente os itens à API
