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
- **THEN** sistema abre um dialog com uma grade compacta dos usuários do tenant, com checkbox de seleção múltipla, colunas de nome, e-mail, squad e papel, filtro por nome ou e-mail no topo e carregamento sob demanda; ao confirmar, adiciona todos os usuários marcados com o papel e o squad definidos em cada linha

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
O dialog "Adicionar membro" SHALL apresentar os usuários do tenant em uma grade compacta com nome e e-mail em colunas, um checkbox de seleção múltipla por linha e as colunas de squad e papel, e SHALL NOT aceitar e-mail digitado livremente como identidade do novo membro. A confirmação SHALL enviar a lista dos usuários marcados com o papel e o squad definidos em cada linha.

#### Scenario: Dialog lista os usuários do tenant
- **WHEN** administrador do projeto abre o dialog "Adicionar membro"
- **THEN** o sistema exibe os usuários do tenant elegíveis em uma grade com checkbox de seleção, nome, e-mail, squad e papel, sem campo de e-mail livre

#### Scenario: Busca filtra por nome ou e-mail
- **WHEN** administrador digita parte do nome ou do e-mail de uma pessoa
- **THEN** a lista exibe somente os usuários do tenant correspondentes ao termo

#### Scenario: Usuário já membro não pode ser escolhido
- **WHEN** a grade inclui um usuário que já possui membership ativa no projeto
- **THEN** o sistema não o apresenta entre os candidatos elegíveis e ele não pode ser selecionado

#### Scenario: Seleção múltipla de pessoas
- **WHEN** administrador marca o checkbox de várias linhas da grade
- **THEN** o sistema mantém todas as linhas marcadas e a confirmação adiciona todas elas

#### Scenario: Desmarcar uma linha
- **WHEN** administrador desmarca o checkbox de uma linha previamente marcada
- **THEN** o sistema remove essa pessoa da adição e mantém as demais seleções

#### Scenario: Confirmação adiciona o usuário escolhido
- **WHEN** administrador marca um ou mais usuários, define papel e squad de cada linha e confirma
- **THEN** o sistema adiciona todos os usuários marcados ao projeto com o papel e o squad definidos em cada linha

#### Scenario: Nenhuma linha marcada
- **WHEN** nenhuma linha da grade está marcada
- **THEN** o sistema mantém a confirmação desabilitada

#### Scenario: Nenhum candidato disponível
- **WHEN** todos os usuários do tenant já são membros do projeto
- **THEN** o sistema informa que não há usuários disponíveis e não permite confirmar

#### Scenario: Falha ao carregar os candidatos
- **WHEN** a lista de candidatos não pode ser carregada
- **THEN** o sistema exibe mensagem de erro no dialog e mantém a confirmação desabilitada

### Requirement: Filtro e carregamento sob demanda na grade de candidatos
A grade de candidatos do dialog "Adicionar membro" SHALL oferecer um campo de filtro no topo que consulta o servidor por nome ou e-mail com filtragem rápida e SHALL carregar os candidatos em páginas, mantendo um controle de carregar mais enquanto houver resultados não carregados.

#### Scenario: Filtro consulta o servidor
- **WHEN** administrador do projeto digita parte do nome ou do e-mail de uma pessoa no campo de filtro
- **THEN** o sistema consulta o servidor com o termo informado e exibe somente os candidatos correspondentes

#### Scenario: Filtro sem correspondência
- **WHEN** o termo digitado não corresponde a nenhum usuário do tenant
- **THEN** o sistema informa que não há usuários correspondentes e não permite confirmar

#### Scenario: Carregar mais acrescenta a próxima página
- **WHEN** administrador do projeto aciona o controle de carregar mais
- **THEN** o sistema acrescenta a próxima página de candidatos à grade, preservando as seleções e os valores já definidos nas linhas existentes

#### Scenario: Fim da lista
- **WHEN** todos os candidatos que atendem ao filtro já foram carregados
- **THEN** o sistema deixa de exibir o controle de carregar mais

#### Scenario: Mudar o filtro reinicia o carregamento
- **WHEN** administrador do projeto altera o termo do filtro
- **THEN** o sistema descarta as páginas carregadas anteriormente e recomeça a listagem pela primeira página do novo termo

### Requirement: Valores pré-definidos de papel e squad na grade
Ao apresentar a grade de candidatos, o sistema SHALL iniciar cada linha com papel `MEMBER` e SHALL pré-selecionar o squad do projeto quando houver exatamente um squad. Sem nenhum squad cadastrado, a linha SHALL permanecer sem squad; com mais de um squad, a linha SHALL permanecer sem squad até que o usuário escolha. Papel e squad SHALL ser alteráveis em cada linha antes da confirmação.

#### Scenario: Projeto sem squad
- **WHEN** o projeto não possui nenhum squad cadastrado
- **THEN** cada linha da grade inicia com papel "Membro" e sem squad associado

#### Scenario: Projeto com exatamente um squad
- **WHEN** o projeto possui exatamente um squad cadastrado
- **THEN** cada linha da grade inicia com esse squad pré-selecionado

#### Scenario: Projeto com mais de um squad
- **WHEN** o projeto possui mais de um squad cadastrado
- **THEN** cada linha da grade inicia sem squad e o usuário escolhe o squad desejado

#### Scenario: Alterar papel e squad de uma linha
- **WHEN** administrador do projeto altera o papel ou o squad de uma linha marcada
- **THEN** o sistema usa os valores daquela linha ao confirmar a adição, sem afetar as demais linhas

### Requirement: Listagem de candidatos a membro do projeto
O sistema SHALL expor `GET /projects/:id/member-candidates` de forma paginada e filtrável, retornando usuários do tenant ativo com `id`, `name`, `email`, `avatarUrl`, `globalGroup` e o indicador booleano `isMember`. Quando a requisição pedir somente elegíveis, o sistema SHALL omitir quem já possui membership no projeto. A resposta SHALL conter somente usuários do tenant ativo e SHALL aplicar a mesma regra de administração de projeto usada para adicionar, editar e remover membros.

#### Scenario: Administrador do projeto lista candidatos
- **WHEN** quem administra o projeto solicita os candidatos a membro
- **THEN** o sistema retorna uma página dos usuários do tenant com o indicador `isMember` de cada um

#### Scenario: Candidato já membro vem sinalizado
- **WHEN** um usuário do tenant possui membership ativa no projeto
- **THEN** ele é retornado com `isMember = true`

#### Scenario: Busca filtra por nome ou e-mail no servidor
- **WHEN** a requisição informa um termo de busca
- **THEN** o sistema retorna somente os candidatos cujo nome ou e-mail corresponde ao termo

#### Scenario: Paginação limita o volume retornado
- **WHEN** o projeto tem mais candidatos do que o tamanho da página solicitada
- **THEN** o sistema retorna apenas a página solicitada e sinaliza que há mais resultados

#### Scenario: Listagem somente de elegíveis
- **WHEN** a requisição pede somente candidatos elegíveis
- **THEN** o sistema omite os usuários que já possuem membership ativa no projeto

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

### Requirement: Adição de membros em lote
O sistema SHALL expor `POST /projects/:id/members/batch` recebendo uma lista de entradas com `userId`, `role` e `squadId` opcional, criando as memberships correspondentes em uma única operação. Entradas cujo usuário não pertença ao tenant ativo ou cujo squad não pertença ao projeto SHALL ser reportadas como inválidas e SHALL NOT criar membership. Entradas de usuários que já são membros SHALL ser ignoradas sem duplicar vínculo.

#### Scenario: Adição de vários usuários válidos
- **WHEN** a requisição informa vários usuários do tenant ativo com papel e squad válidos
- **THEN** o sistema cria todas as memberships na mesma operação e responde com a lista dos criados

#### Scenario: Usuário já membro é ignorado
- **WHEN** a lista inclui um usuário que já possui membership ativa no projeto
- **THEN** o sistema não duplica o vínculo e reporta a entrada como já membro

#### Scenario: Identificador de usuário de outro tenant
- **WHEN** a lista inclui um `userId` que não pertence ao tenant ativo
- **THEN** o sistema reporta a entrada como inválida e não cria membership para ela

#### Scenario: Squad de outro projeto
- **WHEN** a lista inclui um `squadId` que não pertence ao projeto
- **THEN** o sistema reporta a entrada como inválida e não cria membership para ela

#### Scenario: Lista vazia
- **WHEN** a requisição informa uma lista sem nenhuma entrada
- **THEN** o sistema responde 400 e não cria membership

#### Scenario: Sem permissão de administração no projeto
- **WHEN** um usuário sem permissão de administração no projeto chama a adição em lote
- **THEN** o sistema responde 403 e não cria membership
