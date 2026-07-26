## Purpose

Definir os filtros, controles de visualização e regras de ocultação aplicados ao conteúdo do Board.

## Requirements

### Requirement: Filtros no toolbar do board
O sistema SHALL exibir filtros em um painel acionado pela command bar. Os controles de visualização SHALL incluir Mostrar subtasks, alternância de histórias entre lanes e cards, Expandir tudo e Recolher tudo. Os filtros de conteúdo com valor selecionável (Squad, Módulo, Sprint, Responsável, tipos e tags) SHALL manter identificação acessível. O estado SHALL ser persistido no `localStorage` e restaurado nas visitas subsequentes ao board.

#### Scenario: Filtro por módulo
- **WHEN** o usuário seleciona um módulo no filtro
- **THEN** apenas cards cujos épicos pertencem ao módulo selecionado são exibidos

#### Scenario: Filtro por sprint
- **WHEN** o usuário seleciona um sprint no filtro
- **THEN** apenas cards associados ao sprint selecionado são exibidos

#### Scenario: Filtro por responsável
- **WHEN** o usuário seleciona um responsável no filtro
- **THEN** apenas cards atribuídos ao responsável selecionado são exibidos

#### Scenario: Filtro por tipo de card
- **WHEN** o usuário seleciona um ou mais tipos (`TASK`, `BUG`) no filtro
- **THEN** apenas cards dos tipos selecionados são exibidos

#### Scenario: Filtro por tag
- **WHEN** o usuário seleciona uma ou mais tags no filtro
- **THEN** apenas cards que possuem pelo menos uma das tags selecionadas são exibidos

#### Scenario: Múltiplos filtros ativos
- **WHEN** mais de um filtro está ativo simultaneamente
- **THEN** os filtros são combinados com AND — apenas cards que satisfazem todos os filtros são exibidos

#### Scenario: Limpar filtros
- **WHEN** o usuário clica em "Limpar filtros"
- **THEN** filtros de conteúdo e ocultações de lanes vazias são removidos
- **AND** `showSubtasks` e `storyDisplay` são preservados
- **AND** o `localStorage` é atualizado

#### Scenario: Indicador de filtro ativo
- **WHEN** pelo menos um filtro está ativo
- **THEN** um indicador visual (contagem ou ponto) é exibido no toolbar

### Requirement: Filtros aplicados client-side
Os filtros SHALL ser aplicados sobre a lista de tasks em memória (`displayedTasks`), sem re-fetch da API ao mudar filtros.

#### Scenario: Alterar filtro sem recarregar itens
- **WHEN** o usuário altera qualquer filtro do Board
- **THEN** a lista visível é recalculada a partir dos itens já carregados
- **AND** nenhuma nova consulta de itens é necessária

---

### Requirement: Toggle "Ocultar épicos vazios" nos filtros do board
O sistema SHALL oferecer um toggle "Ocultar épicos vazios" na barra de filtros do board. Quando ativado, épicos que não possuem nenhum item visível (não-arquivado, após aplicação dos filtros ativos) são ocultados da visualização do board e da tree view. O toggle é desligado por padrão.

#### Scenario: Toggle desligado — todos os épicos visíveis (padrão)
- **WHEN** toggle "Ocultar épicos vazios" está desativado
- **THEN** todos os épicos não-arquivados são exibidos no board, incluindo os que não possuem cards dentro

#### Scenario: Toggle ligado — épicos sem cards visíveis são ocultados
- **WHEN** usuário ativa o toggle "Ocultar épicos vazios"
- **THEN** sistema filtra client-side a lista de épicos, ocultando aqueles que não possuem nenhum item descendente na lista carregada (`displayedTasks`) após aplicação dos demais filtros ativos

#### Scenario: Interação com outros filtros ativos
- **WHEN** filtro por responsável está ativo E toggle "Ocultar épicos vazios" está ativo
- **THEN** épicos que não possuem cards do responsável selecionado são também ocultados, pois "vazio" é avaliado após a aplicação dos demais filtros

#### Scenario: Toggle incluído no indicador de filtro ativo
- **WHEN** toggle "Ocultar épicos vazios" está ativado
- **THEN** o indicador de filtros ativos no toolbar conta esse toggle como um filtro ativo (contribui para a contagem exibida)

#### Scenario: Limpar filtros desativa o toggle
- **WHEN** usuário clica em "Limpar filtros"
- **THEN** toggle "Ocultar épicos vazios" é desativado junto com os demais filtros

---

### Requirement: Toggle "Ocultar histórias vazias"
O sistema SHALL oferecer `hideEmptyStories` somente quando `storyDisplay = lanes`. Quando ativado, lanes de STORY sem cards visíveis após os filtros SHALL ser omitidas. O toggle SHALL iniciar desligado.

#### Scenario: Controle disponível no modo de lanes
- **WHEN** `storyDisplay = lanes`
- **THEN** o painel de filtros exibe o controle "Histórias vazias"

#### Scenario: Controle indisponível no modo de cards
- **WHEN** `storyDisplay = cards`
- **THEN** o controle "Histórias vazias" não é exibido e não contribui para a contagem de filtros ativos

#### Scenario: Ocultar história sem cards visíveis
- **WHEN** usuário ativa `hideEmptyStories`
- **THEN** cada STORY com zero cards após os demais filtros é omitida

#### Scenario: Limpar filtros restaura histórias vazias
- **WHEN** usuário limpa os filtros
- **THEN** `hideEmptyStories` retorna a `false`
