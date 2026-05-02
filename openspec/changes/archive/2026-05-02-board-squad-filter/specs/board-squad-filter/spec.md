## ADDED Requirements

### Requirement: Filtro por squad no board
O sistema SHALL exibir um select de squad na barra de filtros do board, listando todas as squads do projeto. Quando uma squad está selecionada, apenas cards cujo responsável (`assignedTo`) é membro dessa squad SHALL ser exibidos.

#### Scenario: Selecionar squad oculta cards de outras squads
- **WHEN** o usuário seleciona uma squad no filtro
- **THEN** apenas cards atribuídos a membros da squad selecionada são exibidos no board

#### Scenario: Cards sem responsável são ocultados com filtro ativo
- **WHEN** o usuário seleciona uma squad no filtro
- **THEN** cards sem responsável (`assignedTo` nulo) são ocultados

#### Scenario: Épicos vazios são ocultados automaticamente
- **WHEN** o usuário seleciona uma squad no filtro
- **THEN** épicos que não possuem cards visíveis após o filtro são ocultados automaticamente, sem necessidade de ativar o toggle "Ocultar épicos vazios" manualmente

#### Scenario: Limpar filtro de squad restaura todos os cards
- **WHEN** o usuário remove a seleção de squad (opção "Todas as squads")
- **THEN** o board volta a exibir todos os cards, respeitando os demais filtros ativos

#### Scenario: Select de squad fica vazio quando projeto não tem squads
- **WHEN** o projeto não possui squads cadastradas
- **THEN** o select de squad não é exibido na barra de filtros

#### Scenario: Filtro de squad combina com outros filtros ativos
- **WHEN** o usuário tem filtro de squad ativo e ativa um segundo filtro (ex.: tipo de card)
- **THEN** os filtros são combinados com AND — apenas cards que satisfazem todos os filtros são exibidos
