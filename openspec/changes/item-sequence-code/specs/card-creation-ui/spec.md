## ADDED Requirements

### Requirement: Campo sequenceCode no formulário de item
O sistema SHALL incluir um campo editável para `sequenceCode` no formulário de criação e edição de itens (ItemModal, StoryModal, EpicModal).

#### Scenario: Campo exibido no formulário de criação
- **WHEN** membro abre o formulário de criação de item (TASK, BUG, STORY ou EPIC)
- **THEN** campo "Código" é exibido com placeholder "Gerado automaticamente" e permite edição opcional

#### Scenario: Campo exibido no formulário de edição
- **WHEN** membro abre o formulário de edição de um item existente
- **THEN** campo "Código" é exibido com o valor atual do `sequenceCode` e permite edição

#### Scenario: Código enviado na criação
- **WHEN** membro preenche o campo "Código" e salva o item
- **THEN** `sequenceCode` é incluído no payload de `POST /projects/:id/items`

#### Scenario: Código enviado na edição
- **WHEN** membro altera o campo "Código" e salva
- **THEN** `sequenceCode` é incluído no payload de `PATCH /projects/:id/items/:itemId`

#### Scenario: Campo vazio na criação gera código automático
- **WHEN** membro deixa o campo "Código" vazio na criação
- **THEN** o campo não é enviado no payload e o backend gera automaticamente o próximo código disponível
