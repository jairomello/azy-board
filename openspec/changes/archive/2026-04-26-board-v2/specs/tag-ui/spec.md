## MODIFIED Requirements

### Requirement: Dropdown de tags não deve sobrepor outros campos

**MODIFIED** — Corrigir z-index/posicionamento do `TagSelector`.

#### Scenario: Dropdown de tags abre acima de outros campos
- **WHEN** o usuário clica no `TagSelector` dentro de uma modal
- **THEN** o dropdown de tags é renderizado via portal (`createPortal`) com `position: fixed` e `z-index` suficiente para ficar acima de todos os outros elementos

### Requirement: Tags persistidas ao salvar card

**MODIFIED** — Garantir que tags são salvas corretamente.

#### Scenario: Salvar card com tags selecionadas
- **WHEN** o usuário seleciona tags na `CardModal` e clica em "Salvar"
- **THEN** sistema chama `POST /projects/:id/tasks/:taskId/tags` com `{ tagIds: string[] }` dos IDs das tags selecionadas, antes de fechar a modal
- **AND** ao reabrir o card, as tags selecionadas aparecem pré-selecionadas

#### Scenario: Tags exibidas no card do board após salvar
- **WHEN** o card tem tags associadas
- **THEN** os chips de tags são exibidos no card no board com as cores corretas

## ADDED Requirements

### Requirement: Edição de tag existente na modal
O sistema SHALL permitir editar uma tag já criada diretamente na `CardModal`.

#### Scenario: Clicar sobre chip de tag para editar
- **WHEN** o usuário clica sobre um chip de tag selecionada na `CardModal`
- **THEN** o chip entra em modo de edição: exibe input de texto com o nome atual e a paleta de cores
- **AND** ao confirmar (Enter ou clique fora), sistema chama `PATCH /projects/:id/tags/:tagId` com o novo nome e/ou cor
- **AND** o chip volta ao modo de exibição com os novos valores
