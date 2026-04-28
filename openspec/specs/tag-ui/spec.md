## ADDED Requirements

### Requirement: Criação de tags do projeto pela UI
O sistema SHALL permitir criar tags diretamente do board ou das configurações do projeto, sem precisar de acesso à API.

#### Scenario: Criar nova tag a partir do seletor de tags
- **WHEN** usuário está no seletor de tags do modal de edição e digita um nome não existente
- **THEN** opção "Criar tag '[nome]'" é exibida no dropdown; ao clicar, tag é criada via API e já adicionada ao card

#### Scenario: Criar tag com cor customizada
- **WHEN** usuário cria uma nova tag
- **THEN** pode selecionar uma cor de uma paleta predefinida; a tag aparece com a cor escolhida como chip no card

---

### Requirement: Atribuição de tags aos cards pela UI
O sistema SHALL exibir um seletor de tags na modal de edição do card que permite adicionar e remover tags.

#### Scenario: Adicionar tag ao card
- **WHEN** usuário seleciona uma tag no seletor dentro da modal
- **THEN** chip colorido da tag aparece no card e a associação é salva via API

#### Scenario: Remover tag do card
- **WHEN** usuário clica no "×" de um chip de tag dentro da modal
- **THEN** tag é removida do card e a desassociação é salva via API

#### Scenario: Tags visíveis no card do board
- **WHEN** card possui tags associadas
- **THEN** chips coloridos das tags são exibidos na área inferior do card no board

---

### Requirement: Dropdown de tags não deve sobrepor outros campos

O sistema SHALL renderizar o `TagSelector` via portal para evitar sobreposição incorreta dentro de modais.

#### Scenario: Dropdown de tags abre acima de outros campos
- **WHEN** o usuário clica no `TagSelector` dentro de uma modal
- **THEN** o dropdown de tags é renderizado via portal (`createPortal`) com `position: fixed` e `z-index` suficiente para ficar acima de todos os outros elementos

---

### Requirement: Tags persistidas ao salvar card

O sistema SHALL garantir que as tags selecionadas sejam salvas corretamente ao confirmar a edição do card.

#### Scenario: Salvar card com tags selecionadas
- **WHEN** o usuário seleciona tags na `CardModal` e clica em "Salvar"
- **THEN** sistema chama `POST /projects/:id/tasks/:taskId/tags` com `{ tagIds: string[] }` dos IDs das tags selecionadas, antes de fechar a modal
- **AND** ao reabrir o card, as tags selecionadas aparecem pré-selecionadas

#### Scenario: Tags exibidas no card do board após salvar
- **WHEN** o card tem tags associadas
- **THEN** os chips de tags são exibidos no card no board com as cores corretas

---

### Requirement: Edição de tag existente na modal

O sistema SHALL permitir editar uma tag já criada diretamente na `CardModal`.

#### Scenario: Clicar sobre chip de tag para editar
- **WHEN** o usuário clica sobre um chip de tag selecionada na `CardModal`
- **THEN** o chip entra em modo de edição: exibe input de texto com o nome atual e a paleta de cores
- **AND** ao confirmar (Enter ou clique fora), sistema chama `PATCH /projects/:id/tags/:tagId` com o novo nome e/ou cor
- **AND** o chip volta ao modo de exibição com os novos valores
