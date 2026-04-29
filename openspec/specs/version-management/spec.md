## ADDED Requirements

### Requirement: CRUD de versões de projeto em Settings
O sistema SHALL permitir que administradores criem, editem, visualizem e excluam versões de um projeto na seção "Versões" da tela de configurações. Campos de uma versão: nome (obrigatório), data de lançamento (opcional), descrição (opcional), situação (`PLANNED` | `IN_DEV` | `RELEASED` | `CANCELLED`).

#### Scenario: Criar nova versão
- **WHEN** admin preenche o formulário de nova versão com nome obrigatório e confirma
- **THEN** versão é criada via `POST /projects/:id/versions` e aparece na lista com situação "Planejada"

#### Scenario: Editar versão existente
- **WHEN** admin clica em "Editar" em uma versão
- **THEN** `VersionDetailModal` abre em modo edição com os campos preenchidos e a lista de itens vinculados; ao salvar, chama `PATCH /projects/:id/versions/:versionId`

#### Scenario: Visualizar versão (somente leitura)
- **WHEN** usuário clica em "Ver" em uma versão
- **THEN** `VersionDetailModal` abre em modo leitura com campos somente leitura e lista de itens vinculados

#### Scenario: Excluir versão
- **WHEN** admin clica em "Excluir" e confirma o diálogo
- **THEN** versão é removida via `DELETE /projects/:id/versions/:versionId`; itens vinculados têm `version_id` definido como null (sem cascata de exclusão)

#### Scenario: VIEWER não pode criar ou editar versões
- **WHEN** usuário com papel VIEWER acessa Settings
- **THEN** botões de criar/editar/excluir versão não são exibidos (ou retornam 403 na API)

---

### Requirement: Modal de detalhe de versão com lista de itens
O sistema SHALL exibir uma `VersionDetailModal` que combina o formulário de edição da versão com a lista paginada de itens (épicos, histórias, tasks, bugs) vinculados a ela.

#### Scenario: Lista de itens vinculados na modal
- **WHEN** `VersionDetailModal` abre para uma versão que possui itens vinculados
- **THEN** lista exibe cada item com: título, tipo (ícone), status (badge), responsável (avatar)

#### Scenario: Versão sem itens vinculados
- **WHEN** `VersionDetailModal` abre para uma versão sem itens
- **THEN** exibe mensagem "Nenhum item vinculado a esta versão"

#### Scenario: Paginação da lista de itens
- **WHEN** versão possui mais de 20 itens vinculados
- **THEN** lista exibe 20 por página com botão "Carregar mais"

---

### Requirement: Campo versão opcional nos itens
O sistema SHALL permitir associar qualquer item (EPIC, STORY, TASK, BUG) a uma versão do projeto, de forma opcional, nas respectivas modais de edição.

#### Scenario: Associar versão a um item
- **WHEN** usuário seleciona uma versão no campo "Versão" da modal do item e salva
- **THEN** `version_id` é persistido no item via API e o campo exibe o nome da versão selecionada

#### Scenario: Remover versão de um item
- **WHEN** usuário seleciona "Sem versão" no campo "Versão" e salva
- **THEN** `version_id` é definido como null no item

#### Scenario: Campo versão ausente para projetos sem versões
- **WHEN** projeto não possui nenhuma versão cadastrada
- **THEN** campo "Versão" não é exibido nas modais de edição de itens

---

### Requirement: API de versões de projeto
O sistema SHALL expor endpoints REST para gerenciar versões, respeitando tenant e RBAC.

#### Scenario: Listar versões do projeto
- **WHEN** `GET /projects/:id/versions` é chamado por membro autenticado
- **THEN** retorna array de versões ordenado por `position`, com campos id, name, releaseDate, description, status

#### Scenario: Criar versão
- **WHEN** `POST /projects/:id/versions` com `{ name, releaseDate?, description?, status? }` é chamado por ADMIN
- **THEN** versão é criada com `tenant_id` do middleware e retorna 201 // [TENANT]

#### Scenario: Atualizar versão
- **WHEN** `PATCH /projects/:id/versions/:versionId` é chamado por ADMIN
- **THEN** campos fornecidos são atualizados; `version_id` não pode ser alterado

#### Scenario: Excluir versão
- **WHEN** `DELETE /projects/:id/versions/:versionId` é chamado por ADMIN
- **THEN** versão é removida; todos os itens com `version_id` igual ficam com `version_id = null`

#### Scenario: Listar itens de uma versão
- **WHEN** `GET /projects/:id/versions/:versionId/items?page&limit` é chamado
- **THEN** retorna lista paginada de itens com `version_id` igual ao da versão // [TENANT]

#### Scenario: VIEWER não pode criar/editar/excluir versões
- **WHEN** usuário VIEWER chama POST, PATCH ou DELETE em versões
- **THEN** API retorna 403
