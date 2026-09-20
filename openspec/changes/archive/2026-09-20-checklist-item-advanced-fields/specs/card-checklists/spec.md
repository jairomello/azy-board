## ADDED Requirements

### Requirement: Campos avançados opcionais em itens de checklist

Quando o projeto estiver com `advancedChecklists = true`, cada item de checklist SHALL poder ter, de forma não obrigatória: `dueDate` (data prevista de término), `assigneeId` (responsável) e `description` (descrição em rich text). O `assigneeId`, quando informado, SHALL referenciar um usuário que seja membro do projeto e do mesmo tenant; caso contrário a operação SHALL ser rejeitada. A `description` SHALL respeitar o limite de 20000 caracteres e o `dueDate` SHALL ser uma data válida.

#### Scenario: Adicionar item com campos avançados
- **WHEN** usuário ou agente envia `POST /projects/:id/items/:itemId/checklists/:checklistId/items` com `text` e, opcionalmente, `dueDate`, `assigneeId` e `description`, em projeto com a opção ligada
- **THEN** o sistema cria o item com `checked: false` e persiste os campos avançados informados
- **AND** retorna `201` com o item contendo os campos avançados

#### Scenario: Atualizar apenas a descrição detalhada
- **WHEN** usuário envia `PATCH .../items/:checklistItemId` com `{ description: "<p>...</p>" }` em projeto com a opção ligada
- **THEN** o sistema atualiza somente a descrição, preservando `text`, `checked`, `dueDate` e `assigneeId`

#### Scenario: Limpar um campo avançado
- **WHEN** usuário envia `PATCH .../items/:checklistItemId` com `assigneeId: null` ou `dueDate: null`
- **THEN** o sistema remove o valor correspondente sem afetar os demais campos

#### Scenario: Responsável não é membro do projeto
- **WHEN** é informado `assigneeId` de usuário que não pertence ao projeto ou ao tenant
- **THEN** o sistema rejeita a operação com erro de validação e não altera o item

#### Scenario: Descrição acima do limite
- **WHEN** a `description` informada excede 20000 caracteres
- **THEN** o sistema rejeita a operação com erro de validação informando o limite

### Requirement: Exposição e propagação dos campos avançados

No modo detalhado, o detalhe do card e o payload do board SHALL incluir `dueDate`, `assigneeId`, `assignee` (com `id`, `name` e `avatarUrl`) e `description` nos itens de checklist. Toda mutação de item de checklist SHALL emitir o evento WebSocket `CHECKLIST_UPDATED`, e o progresso agregado (`checklistProgress`) SHALL continuar contando apenas itens `checked` sobre o total, independentemente dos campos avançados.

#### Scenario: Leitura no modo detalhado
- **WHEN** cliente carrega `GET /projects/:id/items/:itemId` ou `GET /projects/:id/items` em projeto com a opção ligada
- **THEN** os itens de checklist incluem os campos avançados e o `assignee` resolvido, quando houver

#### Scenario: Atualização de campo avançado em tempo real
- **WHEN** `dueDate`, `assigneeId` ou `description` de um item é alterado
- **THEN** o sistema emite `CHECKLIST_UPDATED` com o `itemId` e o progresso, para que observers do board atualizem sem reload

#### Scenario: Progresso independe dos campos avançados
- **WHEN** um item com data, responsável e descrição é marcado como concluído
- **THEN** `checklistProgress` incrementa `checked` normalmente, mantendo `total` inalterado

### Requirement: Isolamento multi-tenant nos campos avançados

O responsável de um item de checklist SHALL pertencer ao mesmo tenant e ao mesmo projeto do checklist. Toda operação sobre campos avançados SHALL aplicar `tenantId` como filtro obrigatório via join com `items`, sem expor dados de outro tenant.

#### Scenario: Responsável de outro tenant
- **WHEN** é informado `assigneeId` pertencente a outro tenant
- **THEN** o sistema retorna erro de validação sem revelar a existência do usuário e não altera o item

#### Scenario: Acesso cross-tenant ao item
- **WHEN** usuário do tenant A tenta ler ou atualizar campos avançados de checklist do tenant B
- **THEN** o sistema retorna `404` sem expor dados do outro tenant
