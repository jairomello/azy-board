## MODIFIED Requirements

### Requirement: Filtros no toolbar do board

O sistema SHALL exibir filtros de conteúdo em um painel acionado pelo botão `Filtros` da command bar. O painel SHALL conter Squad, Módulo, Sprint, Responsável, tipos e tags. Os controles de visualização, incluindo Mostrar subtasks, alternância de histórias entre lanes e cards, Hierarquia/Abas, Expandir tudo, Recolher tudo e ocultação de lanes vazias, SHALL estar no painel separado acionado pelo botão `Opções`. O estado SHALL ser persistido no `localStorage` e restaurado nas visitas subsequentes ao board.

#### Scenario: Filtro por módulo

- **WHEN** o usuário seleciona um módulo no painel Filtros
- **THEN** apenas cards cujos épicos pertencem ao módulo selecionado são exibidos

#### Scenario: Filtro por sprint

- **WHEN** o usuário seleciona um sprint no painel Filtros
- **THEN** apenas cards associados ao sprint selecionado são exibidos

#### Scenario: Filtro por responsável

- **WHEN** o usuário seleciona um responsável no painel Filtros
- **THEN** apenas cards atribuídos ao responsável selecionado são exibidos

#### Scenario: Filtro por tipo de card

- **WHEN** o usuário seleciona um ou mais tipos (`TASK`, `BUG`) no painel Filtros
- **THEN** apenas cards dos tipos selecionados são exibidos

#### Scenario: Filtro por tag

- **WHEN** o usuário seleciona uma ou mais tags no painel Filtros
- **THEN** apenas cards que possuem pelo menos uma das tags selecionadas são exibidos

#### Scenario: Múltiplos filtros ativos

- **WHEN** mais de um filtro está ativo simultaneamente
- **THEN** os filtros são combinados com AND — apenas cards que satisfazem todos os filtros são exibidos

#### Scenario: Limpar filtros

- **WHEN** o usuário clica em Limpar filtros no painel Filtros
- **THEN** filtros de conteúdo e ocultações de lanes vazias são removidos
- **AND** `showSubtasks`, `storyDisplay` e `moduleViewMode` são preservados
- **AND** o `localStorage` é atualizado

#### Scenario: Indicador de filtro ativo

- **WHEN** pelo menos um filtro de conteúdo está ativo
- **THEN** um indicador visual (contagem ou ponto) é exibido no botão Filtros
