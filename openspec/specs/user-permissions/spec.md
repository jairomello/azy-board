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
O sistema SHALL exibir um grupo de menu `Admin` e disponibilizar nele a listagem e o cadastro de usuários do tenant para Admin e Root. Admin SHALL poder definir os grupos `TEAM_MEMBER`, `MANAGER` e `ADMIN`, mas SHALL não poder atribuir `ROOT`.

#### Scenario: Admin visualiza menu e usuários
- **WHEN** um Admin acessa a aplicação
- **THEN** o menu lateral exibe `Admin` e a área exibe usuários do tenant ativo

#### Scenario: Membro não visualiza Administração
- **WHEN** um Membro de Equipe ou Gerente acessa a aplicação
- **THEN** o menu `Admin` não é exibido e a rota retorna 403 se acessada diretamente

#### Scenario: Admin cadastra usuário
- **WHEN** um Admin cadastra um usuário e escolhe um grupo não Root
- **THEN** o sistema cria o usuário no tenant ativo com o grupo escolhido

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
