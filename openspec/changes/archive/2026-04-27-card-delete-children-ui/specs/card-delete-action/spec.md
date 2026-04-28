## ADDED Requirements

### Requirement: Botão excluir no card

O card do Kanban SHALL exibir um botão de exclusão (ícone `Trash2` do Lucide React) no canto superior direito, visível ao passar o mouse sobre o card (hover). O botão SHALL ser visível apenas para usuários com papel ADMIN ou MEMBER no tenant.

#### Scenario: Botão aparece no hover

- **WHEN** o usuário passa o mouse sobre um card no Kanban
- **THEN** o ícone de lixeira (Trash2) aparece no canto superior direito do card

#### Scenario: Botão oculto para VIEWER

- **WHEN** o usuário autenticado tem papel VIEWER no tenant
- **THEN** o botão de exclusão NÃO é renderizado no card

---

### Requirement: Confirmação antes de excluir

Antes de executar a exclusão, o sistema SHALL exibir uma mensagem de confirmação informando que o item e todos os seus filhos (subtasks, checklists) serão permanentemente excluídos.

#### Scenario: Usuário confirma exclusão

- **WHEN** o usuário clica no botão excluir e confirma a mensagem
- **THEN** o sistema envia a requisição de exclusão ao backend e remove o card da interface após resposta de sucesso

#### Scenario: Usuário cancela exclusão

- **WHEN** o usuário clica no botão excluir mas cancela a mensagem de confirmação
- **THEN** nenhuma requisição é enviada e o card permanece na interface

---

### Requirement: Exclusão em cascata no backend

O endpoint `DELETE /api/items/:id` SHALL excluir o item alvo e todos os seus descendentes recursivos (filhos, netos, etc.) junto com seus checklists e checklist-items, em uma única transação atômica, sempre filtrando por `tenantId`.

#### Scenario: Exclusão de item folha

- **WHEN** o backend recebe `DELETE /api/items/:id` para um item sem filhos
- **THEN** o item e seus checklists são excluídos; resposta HTTP 200 retornada

#### Scenario: Exclusão de item pai com subtasks

- **WHEN** o backend recebe `DELETE /api/items/:id` para um item com N subtasks
- **THEN** o item, todas as subtasks recursivas e todos os checklists associados são excluídos atomicamente; resposta HTTP 200 retornada

#### Scenario: Tentativa de exclusão de item de outro tenant

- **WHEN** o backend recebe `DELETE /api/items/:id` para um item de `tenantId` diferente do JWT
- **THEN** o sistema retorna HTTP 404 e nenhum dado é modificado

#### Scenario: Tentativa de exclusão por VIEWER

- **WHEN** o backend recebe `DELETE /api/items/:id` com JWT de papel VIEWER
- **THEN** o sistema retorna HTTP 403 e nenhum dado é modificado
