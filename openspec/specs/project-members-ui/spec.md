## ADDED Requirements

### Requirement: Seção de Membros & Squads nas Settings
O sistema SHALL exibir uma seção "Membros & Squads" na página de configurações do projeto (`SettingsPage`).

#### Scenario: Listar membros do projeto
- **WHEN** o usuário acessa a seção "Membros & Squads"
- **THEN** sistema exibe a lista de membros do projeto com nome, e-mail e role (ADMIN/MEMBER/VIEWER)

#### Scenario: Criar squad
- **WHEN** o usuário clica em "Novo squad" e digita um nome
- **THEN** sistema chama `POST /projects/:id/squads` e o novo squad aparece na lista

#### Scenario: Adicionar membro a squad
- **WHEN** o usuário seleciona um membro da lista e o arrasta ou associa a um squad
- **THEN** sistema chama `POST /projects/:id/squads/:squadId/members` com o userId e role
- **AND** o membro aparece listado dentro do squad

#### Scenario: Remover membro de squad
- **WHEN** o usuário clica no "×" ao lado de um membro dentro de um squad
- **THEN** sistema remove a associação e o membro sai da lista do squad

#### Scenario: Membros disponíveis como responsável nos cards
- **WHEN** a `CardModal` é aberta e o campo "Responsável" é clicado
- **THEN** um select exibe os membros do projeto (carregados via `GET /projects/:id/members`) como opções

### Requirement: Endpoints de listagem de membros e squads
O sistema SHALL expor `GET /projects/:id/members` retornando usuários com role e squad atual, e `GET /projects/:id/squads` retornando squads com seus membros.
