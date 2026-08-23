## MODIFIED Requirements

### Requirement: Seção de Membros & Squads nas Settings
O sistema SHALL exibir a seção "Membros & Squads" na página de configurações do projeto somente para usuários cujo grupo global e perfil local permitam configurar o projeto. Membros de Equipe SHALL não visualizar a rota nem os controles de configuração; Gerentes, Admins e Root SHALL poder acessar conforme o escopo de projeto.

#### Scenario: Membro não vê configurações
- **WHEN** Membro de Equipe acessa um projeto
- **THEN** a navegação não exibe Configurações e o acesso direto retorna 403

#### Scenario: Gerente configura projeto associado
- **WHEN** Gerente membro do projeto acessa "Membros & Squads"
- **THEN** sistema exibe a seção e permite as operações de configuração autorizadas

#### Scenario: Admin configura projeto sem membership
- **WHEN** Admin acessa "Membros & Squads" de projeto do tenant
- **THEN** sistema exibe a seção e permite seu gerenciamento

#### Scenario: Listar membros do projeto com squad e papel
- **WHEN** usuário autorizado acessa a seção "Membros & Squads"
- **THEN** sistema exibe a lista de membros com nome, e-mail, papel (ADMIN/MEMBER/VIEWER badge) e squad associado (ou "— Sem squad —" se não houver)

#### Scenario: Botão "+ Adicionar membro" abre dialog de convite
- **WHEN** administrador do projeto clica em "+ Adicionar membro"
- **THEN** sistema abre um dialog com busca por e-mail, select de papel e squad opcional; ao confirmar, adiciona o usuário com os dados informados

#### Scenario: Editar membro — alterar squad e papel
- **WHEN** administrador do projeto edita um membro existente
- **THEN** sistema abre dialog pré-preenchido e atualiza papel e squad ao salvar

#### Scenario: Remover membro do projeto
- **WHEN** administrador do projeto confirma a remoção de um membro
- **THEN** sistema remove o membro do projeto e de qualquer squad associado

#### Scenario: Criar squad na subseção "Squads"
- **WHEN** administrador do projeto digita nome do squad e clica em "+ Criar squad"
- **THEN** sistema chama `POST /projects/:id/squads` e exibe o novo squad

#### Scenario: Renomear squad existente
- **WHEN** administrador do projeto altera o nome de um squad
- **THEN** sistema chama `PATCH /projects/:id/squads/:squadId` e atualiza a lista

#### Scenario: Excluir squad sem membros
- **WHEN** administrador do projeto exclui squad sem membros
- **THEN** sistema remove o squad e retorna 204

#### Scenario: Excluir squad com membros — desassociação automática
- **WHEN** administrador do projeto confirma a exclusão de squad com membros
- **THEN** sistema remove o squad e limpa o `squad_id` dos membros associados após exibir o aviso

#### Scenario: Membros disponíveis como responsável nos cards
- **WHEN** usuário autorizado abre a `CardModal` e seleciona o campo "Responsável"
- **THEN** um select exibe os membros do projeto carregados via `GET /projects/:id/members`
