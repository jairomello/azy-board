## ADDED Requirements

### Requirement: Colunas customizáveis por projeto
O sistema SHALL permitir que administradores criem, renomeiem, reordenem e excluam colunas do board de um projeto.

#### Scenario: Criação de coluna com mapeamento de status
- **WHEN** admin cria coluna informando nome e status base (NOT_STARTED | IN_PROGRESS | BLOCKED | DONE | CANCELLED)
- **THEN** sistema cria a coluna e qualquer card movido para ela receberá automaticamente o status base configurado

#### Scenario: Reordenação de colunas por drag-and-drop
- **WHEN** admin arrasta uma coluna para nova posição no board
- **THEN** sistema persiste a nova ordem e todos os usuários veem a atualização em tempo real

#### Scenario: Exclusão de coluna com cards
- **WHEN** admin tenta excluir uma coluna que contém cards
- **THEN** sistema solicita confirmação e, se confirmado, move os cards para a coluna especificada pelo admin antes de excluir

---

### Requirement: Mapeamento coluna → status base
O sistema SHALL permitir que múltiplas colunas mapeiem para o mesmo status base, mantendo posição visual independente do status semântico.

#### Scenario: Duas colunas com mesmo status base
- **WHEN** existem colunas "Em Especificação" e "Em Desenvolvimento" ambas mapeadas para IN_PROGRESS
- **THEN** cards em ambas têm status IN_PROGRESS no banco, mas aparecem em posições visuais distintas no board

---

### Requirement: Filtros combinados do board
O sistema SHALL oferecer filtros independentes e combináveis para: Módulo, Sprint, Responsável e Tags.

#### Scenario: Filtro por módulo
- **WHEN** usuário seleciona um módulo no filtro
- **THEN** board exibe apenas swimlanes e cards cujos épicos pertencem ao módulo selecionado

#### Scenario: Filtro por responsável
- **WHEN** usuário seleciona um membro no filtro de responsável
- **THEN** board exibe apenas cards atribuídos a esse membro; swimlanes de épicos sem cards atribuídos ao membro ficam colapsadas ou ocultas

#### Scenario: Filtro por sprint
- **WHEN** usuário seleciona "Sprint Ativa" ou uma sprint específica
- **THEN** board exibe apenas cards pertencentes à sprint selecionada

#### Scenario: Filtro por tag
- **WHEN** usuário seleciona uma ou mais tags
- **THEN** board exibe apenas cards que possuem ao menos uma das tags selecionadas

#### Scenario: Filtros combinados
- **WHEN** usuário aplica filtros de módulo + responsável + tag simultaneamente
- **THEN** board exibe apenas cards que satisfazem todos os filtros ao mesmo tempo (AND entre categorias de filtro)

#### Scenario: Limpar filtros
- **WHEN** usuário clica em "Limpar filtros"
- **THEN** todos os filtros são removidos e o board exibe todos os cards do projeto

---

### Requirement: Toggle de visualização subtasks no board
O sistema SHALL oferecer um toggle no toolbar do board para alternar entre "mostrar apenas tasks folha" (padrão — Leaf Rule) e "mostrar tasks por nível".

#### Scenario: Toggle desativado (padrão)
- **WHEN** toggle de subtasks está desativado
- **THEN** apenas tasks folha aparecem como cards no board (Leaf Rule aplicada)

#### Scenario: Toggle ativado (mostrar por nível)
- **WHEN** usuário ativa o toggle de subtasks
- **THEN** board exibe o primeiro nível de tasks de cada story, independente de terem subtasks

---

### Requirement: Seletor de visualização Kanban / Tree View
O sistema SHALL oferecer seletor no header do projeto para alternar entre a visualização Kanban e a Tree View, mantendo os filtros ativos.

#### Scenario: Alternar para Tree View
- **WHEN** usuário clica em "Tree View" no seletor de visualização
- **THEN** sistema substitui o board Kanban pela tabela hierárquica, mantendo filtros ativos
