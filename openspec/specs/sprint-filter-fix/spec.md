## Purpose

Definir os requisitos da capacidade de filtro por sprint no Board, garantindo que a API exponha os vínculos item-sprint (`itemSprints`) e que o filtro client-side e o indicador de progresso funcionem corretamente.

## Requirements
### Requirement: API preserva itemSprints na resposta de listagem de itens

O endpoint `GET /projects/:projectId/items` SHALL incluir o array `itemSprints` na resposta para cada item, contendo todos os sprints vinculados ao item. O campo achatado `sprintId` SHALL continuar presente para compatibilidade.

#### Scenario: Item com uma sprint vinculada

- **WHEN** um item está vinculado a uma sprint
- **THEN** a resposta da API incluirá `itemSprints: [{ sprintId: "<id-da-sprint>" }]` e `sprintId: "<id-da-sprint>"` para esse item

#### Scenario: Item com múltiplas sprints vinculadas

- **WHEN** um item está vinculado a mais de uma sprint
- **THEN** a resposta da API incluirá `itemSprints` com todos os `sprintId` vinculados, e `sprintId` conterá o `sprintId` do primeiro vínculo

#### Scenario: Item sem sprint vinculada

- **WHEN** um item não está vinculado a nenhuma sprint
- **THEN** a resposta da API incluirá `itemSprints: []` e `sprintId: null` para esse item

### Requirement: Filtro por sprint no Board exibe apenas cards vinculados

O Board SHALL filtrar os cards exibidos conforme a sprint selecionada no filtro, mostrando apenas os itens vinculados à sprint escolhida.

#### Scenario: Filtrar por sprint com itens vinculados

- **WHEN** o usuário seleciona uma sprint no filtro do Board
- **THEN** apenas os cards vinculados àquela sprint serão exibidos nas colunas

#### Scenario: Filtrar por sprint sem itens vinculados

- **WHEN** o usuário seleciona uma sprint que não tem itens vinculados
- **THEN** o Board exibirá todas as colunas vazias (nenhum card)

#### Scenario: Remover filtro de sprint

- **WHEN** o usuário limpa o filtro de sprint (seleciona "Todas")
- **THEN** todos os cards do projeto serão exibidos novamente

#### Scenario: Item com múltiplas sprints aparece em ambas

- **WHEN** um item está vinculado a sprint A e sprint B
- **THEN** ao filtrar por sprint A, o item SHALL aparecer; ao filtrar por sprint B, o item SHALL aparecer

### Requirement: Indicador de progresso da sprint ativa usa itemSprints

O indicador de progresso da sprint ativa no Board SHALL usar o array `itemSprints` para contar itens vinculados à sprint.

#### Scenario: Contagem de itens da sprint ativa

- **WHEN** existe uma sprint ativa com itens vinculados
- **THEN** o indicador de progresso mostrará a contagem correta baseada em `itemSprints`
