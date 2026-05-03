## MODIFIED Requirements

### Requirement: Filtros no toolbar do board
O sistema SHALL exibir filtros no toolbar do board organizados em zonas visuais. Os toggles de estado (Mostrar subtasks, Histórias no board, Ocultar épicos vazios) SHALL ser exibidos como ícones com tooltip. Os filtros de conteúdo com valor selecionável (Squad, Módulo, Responsável, tipos) SHALL manter label visível por necessidade de legibilidade do valor ativo. As ações "Expandir tudo" e "Recolher tudo" SHALL ser ícones com tooltip. O estado dos filtros SHALL ser persistido no `localStorage` e restaurado automaticamente nas visitas subsequentes ao board.

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
- **WHEN** o usuário seleciona um ou mais tipos (Story, Task, Bug) no filtro
- **THEN** apenas cards dos tipos selecionados são exibidos

#### Scenario: Filtro por tag
- **WHEN** o usuário seleciona uma ou mais tags no filtro
- **THEN** apenas cards que possuem pelo menos uma das tags selecionadas são exibidos

#### Scenario: Múltiplos filtros ativos
- **WHEN** mais de um filtro está ativo simultaneamente
- **THEN** os filtros são combinados com AND — apenas cards que satisfazem todos os filtros são exibidos

#### Scenario: Limpar filtros
- **WHEN** o usuário clica em "Limpar filtros"
- **THEN** todos os filtros são removidos, o board volta ao estado padrão, e o `localStorage` é atualizado com o estado padrão (sem filtros)

#### Scenario: Indicador de filtro ativo
- **WHEN** pelo menos um filtro está ativo
- **THEN** um indicador visual (contagem ou ponto) é exibido no toolbar
