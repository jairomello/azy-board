# Spec Delta

## ADDED Requirements

### Requirement: Controle de layout do Kanban no painel Opções
O painel `Opções` do Kanban SHALL oferecer um controle `Quadro` com os estados `Por épico`
(lanes por módulo, épico e história) e `Unificado` (uma faixa de colunas para todo o
recorte). O controle SHALL aparecer apenas na visualização Kanban de projetos
hierárquicos e SHALL iniciar em `Unificado`. A troca de layout SHALL preservar filtros,
densidade, caminho crítico e a ordem das colunas, e SHALL NOT contar como filtro ativo nem
ser desfeita por **Limpar**.

#### Scenario: Alternar para o layout por épico
- **WHEN** a pessoa seleciona `Por épico` no painel Opções
- **THEN** o Board volta a exibir as lanes de módulo, épico e história com os mesmos filtros aplicados

#### Scenario: Alternar para o layout unificado
- **WHEN** a pessoa seleciona `Unificado` no painel Opções
- **THEN** o Board passa a exibir uma única faixa de colunas com todo o recorte

#### Scenario: Layout não é filtro
- **WHEN** o layout unificado ou por épico está ativo
- **THEN** ele não é contado no indicador de filtros ativos nem aparece nos chips de filtros
- **AND** **Limpar** preserva o layout escolhido

#### Scenario: Controles exclusivos das lanes
- **WHEN** o layout unificado está ativo
- **THEN** os controles de abas de módulo, expandir/recolher, ocultar épicos vazios e ocultar histórias vazias não são oferecidos
- **AND** os demais filtros e a exibição de subtasks continuam disponíveis

#### Scenario: Controle fora do Kanban hierárquico
- **WHEN** a visualização é a árvore ou o projeto é `SIMPLE`
- **THEN** o controle `Quadro` não é exibido
