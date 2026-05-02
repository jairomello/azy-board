## MODIFIED Requirements

### Requirement: Seção de Membros & Squads nas Settings
O sistema SHALL exibir a seção "Membros & Squads" na página de configurações do projeto (`SettingsPage`) dividida em duas subseções distintas: "Squads" e "Membros do Projeto", com gerenciamento independente de cada uma.

#### Scenario: Listar membros do projeto com squad e papel
- **WHEN** o usuário acessa a seção "Membros & Squads"
- **THEN** sistema exibe a lista de membros com nome, e-mail, papel (ADMIN/MEMBER/VIEWER badge) e squad associado (ou "— Sem squad —" se não houver)

#### Scenario: Botão "+ Adicionar membro" abre dialog de convite
- **WHEN** administrador clica em "+ Adicionar membro"
- **THEN** sistema abre um dialog com campo de busca por e-mail, select de papel (ADMIN/MEMBER/VIEWER) e select opcional de squad; ao confirmar, sistema adiciona o usuário ao projeto com os dados informados

#### Scenario: Editar membro — alterar squad e papel
- **WHEN** administrador clica no ícone de edição ao lado de um membro existente
- **THEN** sistema abre dialog de edição pré-preenchido com papel e squad atual; ao salvar, sistema atualiza os dados do membro

#### Scenario: Remover membro do projeto
- **WHEN** administrador clica em "Remover" no item de um membro
- **THEN** sistema exibe confirmação e, após confirmação, remove o membro do projeto e de qualquer squad associado

#### Scenario: Criar squad na subseção "Squads"
- **WHEN** administrador digita nome do squad e clica em "+ Criar squad"
- **THEN** sistema chama `POST /projects/:id/squads` com o nome e o novo squad aparece na lista de squads

#### Scenario: Renomear squad existente
- **WHEN** administrador clica no ícone de edição de um squad e altera o nome
- **THEN** sistema chama `PATCH /projects/:id/squads/:squadId` com o novo nome e a lista é atualizada

#### Scenario: Excluir squad sem membros
- **WHEN** administrador clica em "Excluir" em squad que não possui membros associados
- **THEN** sistema remove o squad e retorna 204

#### Scenario: Excluir squad com membros — desassociação automática
- **WHEN** administrador exclui squad que possui membros
- **THEN** sistema exibe aviso informando a quantidade de membros que terão squad removido; ao confirmar, sistema remove o squad e limpa o `squad_id` dos membros associados

#### Scenario: Membros disponíveis como responsável nos cards
- **WHEN** a `CardModal` é aberta e o campo "Responsável" é clicado
- **THEN** um select exibe os membros do projeto (carregados via `GET /projects/:id/members`) como opções

### Requirement: Endpoints de listagem de membros e squads
O sistema SHALL expor `GET /projects/:id/members` retornando usuários com role e squad atual (id e nome do squad), e `GET /projects/:id/squads` retornando squads com contagem de membros.
