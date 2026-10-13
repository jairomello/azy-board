## Purpose

Definir os requisitos da capacidade project members ui.

## Requirements

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
- **THEN** sistema exibe a lista de membros como recorte dos usuários do tenant, com nome, e-mail, papel (ADMIN/MEMBER/VIEWER badge) e squad associado (ou "— Sem squad —" se não houver)

#### Scenario: Botão "+ Adicionar membro" abre dialog de convite
- **WHEN** administrador do projeto clica em "+ Adicionar membro"
- **THEN** sistema abre um dialog que lista os usuários do tenant com busca por nome ou e-mail, select de papel e squad opcional; ao confirmar, adiciona o usuário escolhido com os dados informados

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

### Requirement: Endpoints de listagem de membros e squads
O sistema SHALL expor `GET /projects/:id/members` retornando usuários com role e squad atual (id e nome do squad), e `GET /projects/:id/squads` retornando squads com contagem de membros.

#### Scenario: Consultar membros e squads
- **WHEN** usuário autorizado solicita os endpoints de membros e squads de um projeto
- **THEN** o sistema retorna os membros com papel e squad atual e os squads com suas respectivas contagens de membros

### Requirement: Seleção de membro a partir dos usuários do tenant
O dialog "Adicionar membro" SHALL compor a lista de pessoas a partir dos usuários do tenant, com busca por nome ou e-mail, e SHALL NOT aceitar e-mail digitado livremente como identidade do novo membro. O dialog SHALL sinalizar quais usuários já possuem membership ativa no projeto e SHALL impedir que sejam adicionados novamente. A confirmação SHALL enviar o identificador do usuário escolhido, o papel e o squad opcional.

#### Scenario: Dialog lista os usuários do tenant
- **WHEN** administrador do projeto abre o dialog "Adicionar membro"
- **THEN** o sistema exibe os usuários do tenant com nome e e-mail, sem campo de e-mail livre

#### Scenario: Busca filtra por nome ou e-mail
- **WHEN** administrador digita parte do nome ou do e-mail de uma pessoa
- **THEN** a lista exibe somente os usuários do tenant correspondentes ao termo

#### Scenario: Usuário já membro não pode ser escolhido
- **WHEN** a lista inclui um usuário que já possui membership ativa no projeto
- **THEN** o sistema o apresenta como já membro e impede sua seleção

#### Scenario: Confirmação adiciona o usuário escolhido
- **WHEN** administrador escolhe um usuário, define papel e squad e confirma
- **THEN** o sistema adiciona esse usuário ao projeto com o papel e o squad informados

#### Scenario: Nenhum candidato disponível
- **WHEN** todos os usuários do tenant já são membros do projeto
- **THEN** o sistema informa que não há usuários disponíveis e não permite confirmar

#### Scenario: Falha ao carregar os candidatos
- **WHEN** a lista de candidatos não pode ser carregada
- **THEN** o sistema exibe mensagem de erro no dialog e mantém a confirmação desabilitada

### Requirement: Listagem de candidatos a membro do projeto
O sistema SHALL expor `GET /projects/:id/member-candidates` retornando os usuários do tenant ativo com `id`, `name`, `email`, `avatarUrl`, `globalGroup` e o indicador booleano `isMember`. A resposta SHALL conter somente usuários do tenant ativo e SHALL NOT expor usuários de outro tenant. O endpoint SHALL aplicar a mesma regra de administração de projeto usada para adicionar, editar e remover membros.

#### Scenario: Administrador do projeto lista candidatos
- **WHEN** quem administra o projeto solicita os candidatos a membro
- **THEN** o sistema retorna os usuários do tenant com o indicador `isMember` de cada um

#### Scenario: Candidato já membro vem sinalizado
- **WHEN** um usuário do tenant possui membership ativa no projeto
- **THEN** ele é retornado com `isMember = true`

#### Scenario: Usuário sem administração no projeto
- **WHEN** um usuário sem permissão de administração no projeto solicita os candidatos a membro
- **THEN** o sistema responde 403 e não retorna dados de usuários

#### Scenario: Projeto de outro tenant
- **WHEN** a requisição informa o identificador de um projeto que não pertence ao tenant ativo
- **THEN** o sistema responde 404 e não retorna usuários do projeto nem de outro tenant

#### Scenario: Candidatos de projeto restrito sem vínculo
- **WHEN** um usuário sem vínculo solicita os candidatos de um projeto restrito
- **THEN** o sistema responde 404 e não revela a existência do projeto nem seus candidatos

### Requirement: Adição de membro por identificador de usuário
`POST /projects/:id/members` SHALL aceitar exatamente um entre `userId` e `email`, mantendo `email` para compatibilidade com clientes existentes. Quando `userId` for informado, o sistema SHALL validar que o usuário pertence ao tenant ativo. Um usuário já membro SHALL ser rejeitado com conflito.

#### Scenario: Adição por identificador de usuário
- **WHEN** a requisição informa `userId` de um usuário do tenant ativo
- **THEN** o sistema cria a membership com o papel e o squad informados e responde 201

#### Scenario: Identificador de usuário de outro tenant
- **WHEN** a requisição informa `userId` de um usuário que não pertence ao tenant ativo
- **THEN** o sistema responde 404 e não cria membership

#### Scenario: Nenhum identificador informado
- **WHEN** a requisição não informa nem `userId` nem `email`
- **THEN** o sistema responde 400 e não cria membership

#### Scenario: Ambos os identificadores informados
- **WHEN** a requisição informa `userId` e `email` simultaneamente
- **THEN** o sistema responde 400 e não cria membership

#### Scenario: Adição por e-mail continua válida
- **WHEN** um cliente existente informa o e-mail de um usuário do tenant ativo
- **THEN** o sistema cria a membership como antes e responde 201

#### Scenario: Usuário já é membro
- **WHEN** a requisição informa um usuário que já possui membership no projeto
- **THEN** o sistema responde 409 e não duplica o vínculo
