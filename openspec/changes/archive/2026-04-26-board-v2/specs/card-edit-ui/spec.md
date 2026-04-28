## MODIFIED Requirements

### Requirement: Campo tipo na modal de edição de card

**MODIFIED** — Adicionar campo tipo à `CardModal`.

#### Scenario: Exibir e editar tipo do card
- **WHEN** a `CardModal` é aberta
- **THEN** exibe um campo "Tipo" com select: `Task`, `Bug`, `Story`
- **AND** ao salvar, o `type` é incluído no body do `PATCH /projects/:id/tasks/:id`

#### Scenario: Card do tipo Story abre StoryModal
- **WHEN** o usuário clica no card de uma história (type = STORY) no board
- **THEN** a `StoryModal` é aberta em lugar da `CardModal`
- **AND** a `StoryModal` carrega os dados da história correspondente via `GET /projects/:id/stories/:storyId`
