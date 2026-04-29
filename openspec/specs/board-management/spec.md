## MODIFIED Requirements

### Requirement: Swimlanes colapsáveis por EPIC no board
O sistema SHALL exibir o board com uma raia (swimlane) por item com `type = EPIC`, lida da tabela `items` via `GET /projects/:id/items?type=EPIC`. Cards dentro da swimlane são items com `type IN (TASK, BUG)` e leaf rule aplicada.

#### Scenario: Colapsar swimlane de épico
- **WHEN** usuário clica no header da swimlane de um EPIC
- **THEN** raia colapsa, exibindo apenas o título do épico, progresso geral e contagem de cards por coluna

#### Scenario: Expandir swimlane de épico
- **WHEN** usuário clica no header colapsado do EPIC
- **THEN** raia expande exibindo todos os cards de items TASK/BUG folha daquele EPIC nas colunas correspondentes

#### Scenario: Estado de colapso persistido na sessão
- **WHEN** usuário colapsa um EPIC e navega para outra página e retorna
- **THEN** estado colapsado é mantido durante a mesma sessão do browser

#### Scenario: Progresso do EPIC no header da swimlane
- **WHEN** swimlane de um EPIC é exibida
- **THEN** header exibe o percentual de progresso calculado com base nos items TASK/BUG folha descendentes concluídos

---

### Requirement: Raia de Items Órfãos
O sistema SHALL exibir uma swimlane especial "Itens Órfãos" para items TASK/BUG folha que não possuem EPIC ancestral.

#### Scenario: Item TASK/BUG sem EPIC aparece em Itens Órfãos
- **WHEN** item TASK ou BUG é criado sem `parentId` ou com pai que não tem ancestral EPIC
- **THEN** item aparece na swimlane "Itens Órfãos" do board

#### Scenario: Item vinculado a EPIC sai de Itens Órfãos
- **WHEN** item órfão é editado e vinculado a uma STORY/EPIC
- **THEN** item desaparece de "Itens Órfãos" e aparece na swimlane do EPIC em tempo real

---

### Requirement: Filtros combinados do board
O sistema SHALL oferecer filtros independentes e combináveis para: Módulo, Sprint, Responsável, Tipo (TASK, BUG, STORY) e Tags. O filtro de Tipo passa a incluir STORY para o toggle "Mostrar histórias".

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

### Requirement: Toggle "Mostrar histórias" no board
O sistema SHALL exibir um toggle "Mostrar histórias" no toolbar. Quando ativado, items com `type = STORY` são exibidos como cards virtuais na primeira coluna, lidos de `GET /projects/:id/items?type=STORY`.

#### Scenario: Toggle desativado (padrão)
- **WHEN** toggle "Mostrar histórias" está desativado
- **THEN** apenas items com `type IN (TASK, BUG)` e leaf rule são exibidos no board

#### Scenario: Toggle ativado
- **WHEN** toggle "Mostrar histórias" está ativado
- **THEN** items com `type = STORY` são exibidos como cards na primeira coluna com badge `Story` e sem possibilidade de arrastar

#### Scenario: Clicar em card de história no board
- **WHEN** toggle está ativado e usuário clica em card de `type = STORY`
- **THEN** modal de edição de história é aberta em modo de edição com os campos ágeis e rich text

---

### Requirement: Persistência de posição vertical de cards na coluna
O sistema SHALL persistir a posição (ordem) dos cards dentro de uma coluna ao realizar drag-and-drop vertical via `PATCH /projects/:id/items/reorder`.

#### Scenario: Reordenar cards na mesma coluna
- **WHEN** usuário arrasta um card para outra posição na mesma coluna e solta
- **THEN** card permanece na nova posição após soltar
- **AND** sistema chama `PATCH /projects/:id/items/reorder` com `{ columnId, order: string[] }`

#### Scenario: Rollback de reordenação em erro
- **WHEN** chamada de API de reorder falha
- **THEN** cards voltam à ordem anterior (rollback visual)

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
O sistema SHALL oferecer toggle no toolbar para alternar entre "mostrar apenas items TASK/BUG folha" (padrão — Leaf Rule) e "mostrar por nível".

#### Scenario: Toggle desativado (padrão)
- **WHEN** toggle de subtasks está desativado
- **THEN** apenas items TASK/BUG folha aparecem como cards no board

#### Scenario: Toggle ativado (mostrar por nível)
- **WHEN** usuário ativa o toggle de subtasks
- **THEN** board exibe o primeiro nível de items TASK/BUG de cada STORY, independente de terem filhos

---

### Requirement: Controles globais de expansão de swimlanes
O sistema SHALL exibir no toolbar dois botões para controlar o estado de expansão de todas as swimlanes simultaneamente: "Expandir tudo" e "Recolher tudo". Esses controles são visíveis apenas na view Kanban.

#### Scenario: Expandir tudo
- **WHEN** usuário clica em "Expandir tudo"
- **THEN** todas as swimlanes de EPICs e a swimlane de items órfãos são expandidas de uma só vez

#### Scenario: Recolher tudo
- **WHEN** usuário clica em "Recolher tudo"
- **THEN** todas as swimlanes de EPICs e a swimlane de items órfãos são recolhidas, exibindo apenas os headers com título e contagem por coluna

#### Scenario: Controles ocultos na view Árvore
- **WHEN** usuário está na view Árvore
- **THEN** botões "Expandir tudo" e "Recolher tudo" não são exibidos na toolbar
