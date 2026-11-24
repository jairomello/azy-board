## Purpose

Definir os requisitos da capacidade user permissions.

## Requirements

### Requirement: Grupos globais cumulativos
O sistema SHALL associar cada usuário a exatamente um grupo global entre `TEAM_MEMBER` (Membro de Equipe), `MANAGER` (Gerente), `ADMIN` (Admin) e `ROOT` (Root), em ordem crescente de privilégio. O grupo SHALL ser avaliado dentro do tenant ativo e nenhum papel de membership de projeto SHALL ampliar o escopo global do usuário.

#### Scenario: Usuário inicia como membro de equipe
- **WHEN** um usuário é criado sem grupo explicitamente informado
- **THEN** o sistema atribui `TEAM_MEMBER`

#### Scenario: Root possui o maior nível
- **WHEN** o sistema compara as permissões de um Root com as dos demais grupos
- **THEN** Root é reconhecido como nível superior a Admin, Gerente e Membro de Equipe

### Requirement: Escopo de projetos por grupo
O sistema SHALL permitir que Membros de Equipe e Gerentes visualizem somente projetos com membership ativa, SHALL permitir que Admins visualizem os projetos do tenant ativo **exceto** os projetos restritos nos quais não possuam membership nem sejam indicados como Gerente Geral, e SHALL conceder ao Root o mesmo escopo operacional de projetos do Admin nesta versão. Agentes autenticados por API Key SHALL herdar exatamente esse escopo do Owner, limitado adicionalmente pelos escopos da chave. Projetos ocultos SHALL ser excluídos do escopo de qualquer grupo, salvo quando a requisição informar `includeHidden=true`.

#### Scenario: Membro lista projetos
- **WHEN** um Membro de Equipe ou seu agente MCP solicita a lista de projetos
- **THEN** o sistema retorna somente projetos em que o Owner possui membership ativa e que estão no escopo da chave, se houver

#### Scenario: Gerente acessa projeto sem associação
- **WHEN** um Gerente ou seu agente MCP tenta acessar projeto do mesmo tenant no qual não possui membership
- **THEN** o sistema nega o acesso e não revela os dados do projeto

#### Scenario: Admin lista projetos do tenant
- **WHEN** um Admin, Root ou seu agente MCP solicita a lista de projetos
- **THEN** o sistema retorna somente projetos do tenant ativo permitidos pelo escopo da API Key, quando aplicável

#### Scenario: Admin não lista projeto restrito sem vínculo
- **WHEN** um Admin, Root ou seu agente MCP solicita a lista de projetos e existe projeto restrito no tenant sem membership e sem gerência do Owner
- **THEN** o sistema não retorna esse projeto e não revela sua existência

#### Scenario: Admin lista projeto restrito do qual participa
- **WHEN** um Admin, Root ou seu agente MCP possui membership em um projeto restrito
- **THEN** o sistema retorna esse projeto na listagem

#### Scenario: Nenhum grupo lista projetos ocultos por padrão
- **WHEN** qualquer grupo solicita a lista de projetos sem `includeHidden`
- **THEN** o sistema não retorna os projetos marcados como ocultos

### Requirement: Permissões dentro do projeto
O sistema SHALL permitir que Membros de Equipe executem as operações de conteúdo autorizadas pelo projeto, mas SHALL negar o módulo Administração e as configurações do projeto. Gerentes SHALL poder criar projetos e administrar suas configurações, mas SHALL não acessar o módulo Administração. Admins e Root SHALL poder operar projetos permitidos pelo tenant, mas projetos restritos SHALL exigir membership ativa ou indicação como Gerente Geral, sem bypass por grupo global. Agentes MCP SHALL obedecer exatamente às mesmas regras do Owner.

#### Scenario: Membro acessa conteúdo do projeto
- **WHEN** um Membro de Equipe usa a API ou seu agente MCP para operar conteúdo em projeto onde é membro
- **THEN** o sistema permite a operação conforme as permissões de conteúdo existentes

#### Scenario: Membro tenta abrir configurações
- **WHEN** um Membro de Equipe ou seu agente MCP acessa a rota ou ferramenta de configurações do projeto
- **THEN** o sistema retorna 403 e não altera nem expõe controles de configuração

#### Scenario: Gerente cria projeto
- **WHEN** um Gerente ou seu agente MCP cria novo projeto
- **THEN** o sistema cria o projeto e associa o Gerente conforme as regras existentes

#### Scenario: Gerente tenta acessar Administração
- **WHEN** um Gerente ou seu agente MCP tenta acessar o módulo Administração
- **THEN** o sistema retorna 403

#### Scenario: Admin sem associação não acessa projeto restrito
- **WHEN** Admin ou Root tenta operar projeto restrito sem membership e sem ser Gerente Geral
- **THEN** o sistema retorna 404 e não expõe nem altera dados do projeto

### Requirement: Administração de usuários por Admin
O sistema SHALL exibir um grupo de menu `Admin` e disponibilizar nele a listagem e o cadastro de usuários do tenant para Admin e Root. Admin SHALL poder definir os grupos `TEAM_MEMBER`, `MANAGER` e `ADMIN`, mas SHALL não poder atribuir `ROOT`. O cadastro de usuário SHALL validar o e-mail como identidade global e SHALL rejeitar endereço já existente em qualquer tenant, inclusive fora do tenant ativo.

#### Scenario: Admin visualiza menu e usuários
- **WHEN** um Admin acessa a aplicação
- **THEN** o menu lateral exibe `Admin` e a área exibe usuários do tenant ativo

#### Scenario: Membro não visualiza Administração
- **WHEN** um Membro de Equipe ou Gerente acessa a aplicação
- **THEN** o menu `Admin` não é exibido e a rota retorna 403 se acessada diretamente

#### Scenario: Admin cadastra usuário
- **WHEN** um Admin cadastra um usuário e escolhe um grupo não Root
- **THEN** o sistema cria o usuário no tenant ativo com o grupo escolhido

#### Scenario: Admin cadastra e-mail já existente em outro tenant
- **WHEN** um Admin tenta cadastrar um e-mail que já pertence a um usuário de outro tenant
- **THEN** o sistema retorna 409 com mensagem explícita e não cria o usuário

#### Scenario: Admin tenta atribuir Root
- **WHEN** um Admin tenta criar ou alterar um usuário para o grupo `ROOT`
- **THEN** o sistema retorna 403 e não persiste a alteração

### Requirement: Proteção contra elevação de privilégios
O sistema SHALL rejeitar qualquer operação em que o usuário tente aumentar o próprio grupo ou obter um nível superior ao permitido pelo seu grupo executor. A autorização SHALL ser validada no servidor usando o grupo persistido e o tenant ativo.

#### Scenario: Usuário tenta elevar o próprio grupo
- **WHEN** um usuário envia uma alteração do próprio grupo para um nível superior
- **THEN** o sistema retorna 403 e mantém o grupo original

#### Scenario: Admin altera usuário para grupo permitido
- **WHEN** um Admin altera outro usuário para `TEAM_MEMBER`, `MANAGER` ou `ADMIN`
- **THEN** o sistema salva a alteração se o usuário pertencer ao tenant ativo

#### Scenario: Usuário de outro tenant é alvo da alteração
- **WHEN** um Admin envia o identificador de usuário pertencente a outro tenant
- **THEN** o sistema rejeita a operação sem revelar ou alterar esse usuário

### Requirement: Root reservado para funções futuras
O sistema SHALL reconhecer `ROOT` como grupo reservado de maior privilégio e SHALL permitir seu uso na identidade e autorização, mas não SHALL criar nesta mudança funcionalidades de parametrização da plataforma, administração de tenants ou outros endpoints globais.

#### Scenario: Root opera projetos
- **WHEN** Root acessa um projeto do tenant ativo
- **THEN** Root pode executar as operações de projeto disponíveis para Admin

#### Scenario: Root não recebe módulo global nesta etapa
- **WHEN** Root acessa o menu da aplicação
- **THEN** o sistema não exibe funcionalidades globais de parametrização ou tenants que ainda não foram implementadas

### Requirement: Usuário de teste é Root
O setup de desenvolvimento SHALL configurar `jairo.silva@ntconsult.com.br` com grupo `ROOT` e SHALL manter sua senha de teste conforme a configuração existente do ambiente, sem armazená-la em texto plano no código ou na documentação.

#### Scenario: Seed promove usuário de teste
- **WHEN** o setup de desenvolvimento é executado
- **THEN** o usuário `jairo.silva@ntconsult.com.br` existe no tenant de teste com grupo `ROOT`

### Requirement: Listagem de usuários do tenant no escopo do projeto
O sistema SHALL permitir que quem administra um projeto liste os usuários do tenant ativo como candidatos a membro desse projeto, aplicando a mesma regra de administração de projeto usada para adicionar, editar e remover membros. Essa listagem SHALL ser restrita ao tenant ativo, SHALL NOT conceder acesso ao módulo Administração e SHALL NOT ampliar o escopo global de projetos do usuário.

#### Scenario: Gerente associado lista usuários do projeto
- **WHEN** Gerente associado ao projeto solicita os candidatos a membro
- **THEN** o sistema retorna os usuários do tenant ativo e permite a operação

#### Scenario: Gerente sem associação não lista usuários
- **WHEN** Gerente sem membership e sem gerência do projeto solicita os candidatos a membro
- **THEN** o sistema nega a operação sem revelar usuários nem dados do projeto

#### Scenario: Membro de Equipe não lista usuários
- **WHEN** Membro de Equipe do projeto solicita os candidatos a membro
- **THEN** o sistema responde 403 e não retorna dados de usuários

#### Scenario: Listagem não concede o módulo Administração
- **WHEN** um Gerente com permissão de administrar o projeto acessa a aplicação
- **THEN** o menu `Admin` continua oculto e a listagem de usuários do tenant fora do projeto continua negada

#### Scenario: Escopo global permanece inalterado
- **WHEN** um Gerente lista os candidatos a membro de um projeto
- **THEN** a lista de projetos que ele visualiza não muda

#### Scenario: Somente o tenant ativo
- **WHEN** qualquer usuário solicita candidatos a membro
- **THEN** o sistema não retorna usuários de outro tenant

### Requirement: Miniatura de foto na listagem de usuários
A área `Admin` → `/admin/users` SHALL exibir, como primeira coluna da grade de usuários, uma miniatura circular da foto de cada usuário posicionada à esquerda do nome. Quando o usuário não tiver foto, a miniatura SHALL exibir o avatar por iniciais. A miniatura SHALL ser um controle acionável por mouse e teclado, com rótulo acessível que identifique o usuário e a ação de foto, e a listagem SHALL continuar paginada e filtrável como hoje.

#### Scenario: Miniatura da foto na linha do usuário
- **WHEN** um Admin abre `/admin/users` com usuários que possuem e que não possuem foto
- **THEN** cada linha exibe uma miniatura circular à esquerda do nome — a foto quando existir e o avatar por iniciais quando não existir

#### Scenario: Miniatura acessível
- **WHEN** o Admin percorre a grade somente com teclado
- **THEN** a miniatura de cada usuário recebe foco, expõe rótulo acessível com o nome do usuário e pode ser acionada por Enter ou Espaço

#### Scenario: Busca, ordenação e paginação preservadas
- **WHEN** o Admin aplica busca por nome ou e-mail, filtro de grupo ou troca de página
- **THEN** a coluna de miniatura acompanha as demais colunas, mantendo a paginação no servidor e a correspondência entre miniatura, nome e e-mail da linha

### Requirement: Gestão da foto de perfil de outro usuário pelo Admin
Admin e Root SHALL poder incluir ou substituir a foto de perfil de qualquer usuário do tenant ativo, inclusive de usuários `ROOT`, sem exigir ação do usuário alvo. O fluxo SHALL reutilizar o editor de recorte e o servidor SHALL aplicar a mesma validação e normalização do upload do próprio perfil. A nova foto SHALL aparecer na lista e no perfil do usuário alvo sem exigir novo login.

#### Scenario: Incluir foto de usuário sem foto
- **WHEN** o Admin aciona a miniatura de um usuário sem foto, escolhe uma imagem, confirma o recorte e o envio
- **THEN** o sistema grava a foto normalizada para o usuário alvo e a miniatura da linha passa a exibir a nova foto

#### Scenario: Substituir foto existente
- **WHEN** o Admin aciona a miniatura de um usuário que já possui foto e confirma um novo recorte
- **THEN** o sistema substitui a foto anterior, invalida o cache da imagem antiga e exibe a nova foto na lista

#### Scenario: Foto refletida no perfil do usuário alvo
- **WHEN** a foto de um usuário é alterada pelo Admin
- **THEN** as próximas exibições do usuário alvo em cards, comentários e demais telas mostram a nova foto, sem que o usuário alvo precise sair e entrar novamente

#### Scenario: Arquivo inválido ou acima do limite
- **WHEN** o Admin envia um arquivo que não é imagem de formato permitido ou que excede o tamanho máximo aceito
- **THEN** o sistema rejeita o envio com mensagem de erro, preserva a foto anterior do usuário alvo e mantém a lista utilizável

#### Scenario: Falha de rede durante o envio
- **WHEN** o envio ou a normalização falha
- **THEN** o sistema informa o erro, mantém a foto anterior e permite nova tentativa sem recarregar a página

#### Scenario: Estado de envio
- **WHEN** o envio da foto está em andamento
- **THEN** a linha ou o diálogo em uso indica o processamento e impede envios duplicados do mesmo usuário

#### Scenario: Textos internacionalizados
- **WHEN** a interface é exibida em pt-BR, en ou es
- **THEN** todos os textos novos da gestão de foto estão traduzidos no namespace `common`

### Requirement: Autorização da gestão de fotos pelo Admin
As operações administrativas de foto de perfil SHALL ser autorizadas exclusivamente no servidor para usuários com grupo global `ADMIN` ou `ROOT`, SHALL ser restritas ao tenant ativo e SHALL exigir que o usuário alvo pertença a esse tenant. Um usuário sem nível Admin SHALL NÃO poder alterar a foto de outro usuário, e o sistema SHALL falhar sem revelar dados de usuários de outros tenants. A operação SHALL ser registrada em log de auditoria com o identificador do executor e do usuário alvo.

#### Scenario: Admin altera foto de usuário do tenant
- **WHEN** um Admin envia a foto para qualquer usuário do tenant ativo, inclusive um Root
- **THEN** o sistema autoriza a operação e persiste a foto apenas para aquele usuário no tenant ativo

#### Scenario: Root altera foto de Admin
- **WHEN** um Root envia a foto de um usuário Admin do tenant ativo
- **THEN** o sistema autoriza a operação e atualiza a foto do usuário alvo

#### Scenario: Membro tenta alterar foto de outro usuário
- **WHEN** um usuário com grupo `TEAM_MEMBER` ou `MANAGER` tenta incluir, substituir ou remover a foto de outro usuário
- **THEN** o sistema responde 403 e não altera nenhuma foto

#### Scenario: Alvo pertence a outro tenant
- **WHEN** um Admin envia o identificador de um usuário de outro tenant
- **THEN** o sistema responde 404 sem alterar a foto e sem revelar a existência desse usuário

#### Scenario: Auditoria da operação
- **WHEN** uma foto de usuário é alterada ou removida por Admin ou Root
- **THEN** o sistema registra em log o executor, o usuário alvo e a operação, sem registrar conteúdo da imagem

### Requirement: Remoção da foto de perfil de outro usuário pelo Admin
Admin e Root SHALL poder remover a foto de perfil de qualquer usuário do tenant ativo, mediante confirmação explícita no diálogo de gestão. Após a remoção, o sistema SHALL descartar a imagem armazenada, limpar o ponteiro de foto do usuário alvo e voltar a exibir o avatar por iniciais na lista e nas demais telas.

#### Scenario: Remover foto de um usuário
- **WHEN** o Admin confirma a remoção da foto de um usuário que possui foto
- **THEN** o sistema descarta a imagem armazenada, limpa a foto do usuário alvo e a miniatura passa a exibir o avatar por iniciais

#### Scenario: Remoção sem foto cadastrada
- **WHEN** o Admin abre o diálogo de um usuário que não possui foto
- **THEN** a ação de remoção não é oferecida e a interface permite apenas incluir uma foto

#### Scenario: Cancelar a remoção
- **WHEN** o Admin cancela a confirmação de remoção
- **THEN** a foto atual do usuário alvo permanece inalterada
