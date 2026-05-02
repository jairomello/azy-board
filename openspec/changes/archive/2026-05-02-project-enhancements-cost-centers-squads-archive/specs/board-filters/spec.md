## ADDED Requirements

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
