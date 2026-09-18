## Purpose

Definir a composição, o agrupamento hierárquico e as principais interações do Board Kanban.

## Requirements

### Requirement: Lanes colapsáveis de EPIC e STORY no board
O sistema SHALL exibir uma lane principal por item com `type = EPIC` somente em projetos `HIERARCHICAL`. Quando `storyDisplay = lanes`, cada item `STORY` SHALL formar uma lane horizontal aninhada no EPIC e conter os cards `TASK` e `BUG` pertencentes à sua ancestralidade. Em projetos `SIMPLE`, SHALL exibir somente a STORY fixa, suas colunas e cards TASK/BUG, sem lanes de módulo ou EPIC.

#### Scenario: Colapsar swimlane de épico
- **WHEN** usuário clica no header da swimlane de um EPIC
- **THEN** a lane colapsa, exibindo apenas o título do épico, progresso geral e contagem de histórias e cards

#### Scenario: Expandir swimlane de épico
- **WHEN** usuário clica no header colapsado do EPIC
- **THEN** a lane expande exibindo as lanes de histórias daquele EPIC

#### Scenario: Colapsar lane de história
- **WHEN** usuário clica no header de uma STORY no modo `lanes`
- **THEN** a lane da história colapsa independentemente do EPIC e mantém apenas título, contagem e progresso

#### Scenario: Expandir lane de história
- **WHEN** usuário clica no header colapsado de uma STORY
- **THEN** a lane expande exibindo suas colunas e cards descendentes

#### Scenario: Estado de colapso persistido por projeto
- **WHEN** usuário colapsa um EPIC ou uma STORY e navega para outra página e retorna
- **THEN** os estados colapsados são restaurados separadamente para o projeto

#### Scenario: Board simples oculta swimlanes hierárquicas
- **WHEN** usuário abre um projeto `SIMPLE`
- **THEN** sistema mostra a STORY fixa com colunas e cards TASK/BUG, sem swimlanes de módulo ou EPIC

#### Scenario: Progresso do EPIC no header da swimlane
- **WHEN** swimlane de um EPIC é exibida
- **THEN** header exibe o percentual de progresso calculado com base nos items TASK/BUG folha descendentes concluídos

#### Scenario: Cards do épico sem história ancestral
- **WHEN** um card possui EPIC ancestral, mas não possui STORY ancestral
- **THEN** o card aparece no agrupamento `Sem história` dentro do EPIC

---

### Requirement: Raia de Items Órfãos
O sistema SHALL exibir uma lane especial "Sem épico" para items TASK/BUG visíveis que não possuem EPIC ancestral.

#### Scenario: Item TASK/BUG sem EPIC aparece em Itens Órfãos
- **WHEN** item TASK ou BUG é criado sem `parentId` ou com pai que não tem ancestral EPIC
- **THEN** item aparece na lane "Sem épico" do board

#### Scenario: Item vinculado a EPIC sai de Itens Órfãos
- **WHEN** item órfão é editado e vinculado a uma STORY/EPIC
- **THEN** item desaparece de "Sem épico" e aparece na lane de STORY do EPIC em tempo real

---

### Requirement: Filtros combinados do board
O sistema SHALL oferecer filtros independentes e combináveis para: Módulo, Sprint, Responsável, Tipo (`TASK`, `BUG`) e Tags. A representação de `STORY` SHALL ser controlada separadamente por `storyDisplay`.

#### Scenario: Filtro por módulo via EPIC
- **WHEN** usuário seleciona um módulo no filtro
- **THEN** board exibe apenas swimlanes cujo EPIC tem `moduleId` igual ao módulo selecionado

#### Scenario: Filtro por responsável
- **WHEN** usuário seleciona um membro no filtro de responsável
- **THEN** board exibe apenas cards atribuídos a esse membro

#### Scenario: Filtro por sprint
- **WHEN** usuário seleciona uma sprint específica
- **THEN** board exibe apenas items pertencentes à sprint selecionada via `item_sprints`

#### Scenario: Filtro por tag
- **WHEN** usuário seleciona uma ou mais tags
- **THEN** board exibe apenas items que possuem ao menos uma das tags selecionadas via `item_tags`

#### Scenario: Filtros combinados
- **WHEN** usuário aplica filtros de módulo + responsável + tag simultaneamente
- **THEN** board exibe apenas items que satisfazem todos os filtros (AND entre categorias)

#### Scenario: Limpar filtros
- **WHEN** usuário clica em "Limpar filtros"
- **THEN** todos os filtros são removidos e o board exibe todos os items TASK/BUG folha do projeto

---

### Requirement: Toggle de modo de histórias no board
O sistema SHALL exibir um toggle que alterna `storyDisplay` entre `lanes` e `cards`. O valor padrão SHALL ser `lanes`.

#### Scenario: Histórias como lanes por padrão
- **WHEN** o board é aberto sem preferência persistida
- **THEN** cada STORY é exibida como lane aninhada no EPIC
- **AND** suas colunas contêm os cards descendentes

#### Scenario: Alternar para histórias como cards
- **WHEN** usuário ativa o modo `cards`
- **THEN** STORYs folha são exibidas como cards reais e móveis
- **AND** STORYs com filhos são exibidas como referências virtuais não arrastáveis na primeira coluna

#### Scenario: Clicar em card de história no board
- **WHEN** o modo `cards` está ativo e usuário clica em card de `type = STORY`
- **THEN** modal de edição de história é aberta em modo de edição com os campos ágeis e rich text

#### Scenario: Editar história pela lane
- **WHEN** o modo `lanes` está ativo e usuário aciona editar no header de uma STORY
- **THEN** modal de edição de história é aberta em modo de edição

#### Scenario: Criar card dentro da lane de história
- **WHEN** usuário cria uma TASK ou BUG pela ação contextual de uma coluna da STORY
- **THEN** o item é criado com `parentId` igual ao ID da STORY

---

### Requirement: Persistência de posição vertical de cards na coluna
O sistema SHALL persistir a posição (ordem) dos cards dentro de uma coluna ao realizar drag-and-drop vertical via `PATCH /projects/:id/items/reorder`. Ao resolver o drop, SHALL aceitar o ID do card alvo ou um marcador de coluna compatível com o Board, SHALL enviar a ordem completa dos cards persistíveis da coluna e SHALL excluir cards virtuais ou itens não persistíveis.

#### Scenario: Reordenar cards na mesma coluna
- **WHEN** usuário arrasta um card folha para outra posição na mesma coluna e solta sobre um card alvo válido
- **THEN** card permanece na nova posição após soltar
- **AND** sistema chama `PATCH /projects/:id/items/reorder` com `{ columnId, order: string[] }` contendo todos os cards persistíveis da coluna na nova ordem

#### Scenario: Soltar em marcador de coluna
- **WHEN** usuário arrasta um card folha e o evento de drop informa um marcador `:drop:` ou `:col:` associado à coluna
- **THEN** sistema resolve a coluna sem confundir o marcador com um card alvo
- **AND** não envia um reorder vertical sem uma âncora de card válida

#### Scenario: Cards virtuais não são persistidos
- **WHEN** a coluna contém referências virtuais de histórias ou itens que não existem como cards persistíveis
- **THEN** o payload de reorder omite essas referências e contém somente IDs persistíveis

#### Scenario: Rollback de reordenação em erro
- **WHEN** chamada de API de reorder falha
- **THEN** cards voltam à ordem anterior (rollback visual)
- **AND** mensagem de erro é exibida ao usuário

---

### Requirement: Drag-and-drop de cards entre colunas
O sistema SHALL persistir a mudança de coluna de um card ao soltar no destino via `PATCH /projects/:id/items/:id/move`.

#### Scenario: Card fixado na nova coluna após drop
- **WHEN** usuário arrasta card de uma coluna e solta em outra
- **THEN** card aparece na coluna destino e o status base da coluna é aplicado via `PATCH /items/:id/move`

#### Scenario: Rollback em caso de erro da API
- **WHEN** chamada à API de move falha após o drop
- **THEN** card retorna visualmente para a coluna original e mensagem de erro é exibida

---

### Requirement: Colunas customizáveis por projeto
O sistema SHALL permitir que administradores criem, renomeiem, reordenem e excluam colunas do board de um projeto.

#### Scenario: Criação de coluna com mapeamento de status
- **WHEN** admin cria coluna informando nome e status base
- **THEN** sistema cria a coluna e qualquer item movido para ela receberá o status base configurado

#### Scenario: Reordenar coluna arrastando o header
- **WHEN** usuário arrasta o header de uma coluna para outra posição
- **THEN** nova ordem é salva via `PATCH /projects/:id/columns/reorder` e refletida em tempo real

#### Scenario: Exclusão de coluna com cards
- **WHEN** admin tenta excluir coluna que contém cards
- **THEN** sistema solicita confirmação e move os cards para coluna especificada antes de excluir

---

### Requirement: Toggle de visualização subtasks no board
O sistema SHALL oferecer toggle para alternar entre o primeiro nível operacional abaixo de cada STORY e os items TASK/BUG folha descendentes.

#### Scenario: Toggle desativado mostra primeiro nível
- **WHEN** toggle de subtasks está desativado
- **THEN** o board exibe TASKs e BUGs cujo pai imediato é uma STORY, além dos itens sem pai
- **AND** cards com filhos permanecem não arrastáveis

#### Scenario: Toggle ativado mostra folhas
- **WHEN** usuário ativa o toggle de subtasks
- **THEN** o board exibe os items TASK/BUG folha descendentes
- **AND** pais agregadores deixam de ser exibidos como cards

---

### Requirement: Controles globais de expansão de swimlanes
O sistema SHALL exibir no toolbar dois botões para controlar o estado de expansão de todas as swimlanes simultaneamente: "Expandir tudo" e "Recolher tudo". Esses controles são visíveis apenas na view Kanban de projetos `HIERARCHICAL`.

#### Scenario: Expandir tudo
- **WHEN** usuário clica em "Expandir tudo"
- **THEN** todas as lanes de EPICs, STORYs e a lane "Sem épico" são expandidas de uma só vez

#### Scenario: Recolher tudo
- **WHEN** usuário clica em "Recolher tudo"
- **THEN** todas as lanes de EPICs, STORYs e a lane "Sem épico" são recolhidas, exibindo apenas seus headers

#### Scenario: Controles ocultos na view Árvore
- **WHEN** usuário está na view Árvore
- **THEN** botões "Expandir tudo" e "Recolher tudo" não são exibidos na toolbar

#### Scenario: Controles ocultos no modo simples
- **WHEN** usuário está na view Kanban de projeto `SIMPLE`
- **THEN** sistema não exibe os controles globais de expansão
