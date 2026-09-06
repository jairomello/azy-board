## ADDED Requirements

### Requirement: Sinalizadores de visibilidade do projeto
O sistema SHALL manter em cada projeto dois sinalizadores booleanos independentes: `isRestricted` (Restrito) e `isHidden` (Oculto). Ambos SHALL ser criados com valor `false` quando não informados, e o sistema SHALL aceitar e persistir os dois sinalizadores tanto na criação (`POST /projects`) quanto na alteração (`PATCH /projects/:id`). O sistema SHALL devolver os dois sinalizadores em toda representação de projeto retornada pela API.

#### Scenario: Projeto criado sem sinalizadores
- **WHEN** usuário cria um projeto informando apenas o nome
- **THEN** o projeto é persistido com `isRestricted = false` e `isHidden = false`

#### Scenario: Projeto criado como restrito
- **WHEN** usuário cria um projeto com `isRestricted = true`
- **THEN** o projeto é persistido como restrito e a resposta devolve `isRestricted = true`

#### Scenario: Projeto criado como oculto
- **WHEN** usuário cria um projeto com `isHidden = true`
- **THEN** o projeto é persistido como oculto e a resposta devolve `isHidden = true`

#### Scenario: Alterar visibilidade nas configurações do projeto
- **WHEN** usuário com acesso às configurações envia `PATCH /projects/:id` com `isRestricted` ou `isHidden`
- **THEN** o sistema persiste apenas os campos enviados e devolve o projeto com os valores atualizados

#### Scenario: Sinalizadores são independentes
- **WHEN** usuário marca um projeto como restrito e oculto
- **THEN** o projeto é persistido com `isRestricted = true` e `isHidden = true` simultaneamente

#### Scenario: Usuário sem permissão tenta alterar visibilidade
- **WHEN** usuário sem acesso às configurações do projeto envia `PATCH /projects/:id` com `isRestricted` ou `isHidden`
- **THEN** o sistema retorna erro 403 e não altera o projeto

### Requirement: Filtragem de projetos restritos na listagem
O sistema SHALL incluir na listagem de projetos (`GET /projects`) apenas os projetos não restritos e os projetos restritos nos quais o usuário autenticado possui vínculo. O sistema SHALL considerar vínculo a existência de membership ativa do usuário no projeto ou a indicação do usuário como Gerente Geral do Projeto. O sistema SHALL excluir projetos restritos sem vínculo para **qualquer** usuário, incluindo Admin e Root.

#### Scenario: Membro vê projeto restrito do qual participa
- **WHEN** um membro da equipe solicita a lista de projetos
- **THEN** projetos restritos nos quais ele possui membership ativa são retornados

#### Scenario: Gerente vê projeto restrito que gerencia
- **WHEN** o Gerente Geral de um projeto restrito solicita a lista de projetos
- **THEN** o projeto restrito é retornado

#### Scenario: Usuário sem vínculo não vê projeto restrito
- **WHEN** um usuário sem membership e sem indicação como gerente solicita a lista de projetos
- **THEN** o projeto restrito não é retornado e sua existência não é revelada

#### Scenario: Admin não vê projeto restrito sem vínculo
- **WHEN** um Admin ou Root do tenant solicita a lista de projetos
- **THEN** projetos restritos nos quais ele não possui membership nem é gerente não são retornados

#### Scenario: Agente MCP herda a filtragem de restritos
- **WHEN** um agente autenticado por API Key de um Owner sem vínculo lista os projetos
- **THEN** o projeto restrito não é retornado e o escopo da chave continua sendo aplicado

#### Scenario: Isolamento entre tenants é preservado
- **WHEN** o usuário solicita a lista de projetos
- **THEN** nenhum projeto de outro tenant é retornado, restrito ou não

### Requirement: Filtragem de projetos ocultos na listagem
O sistema SHALL excluir projetos ocultos de `GET /projects` por padrão. O sistema SHALL retornar projetos ocultos somente quando a requisição informar explicitamente `includeHidden=true`, e SHALL aplicar a filtragem de restritos mesmo nesse caso.

#### Scenario: Projeto oculto fora da listagem padrão
- **WHEN** o usuário solicita `GET /projects` sem parâmetros
- **THEN** nenhum projeto com `isHidden = true` é retornado

#### Scenario: Projeto oculto retornado quando solicitado
- **WHEN** o usuário solicita `GET /projects?includeHidden=true`
- **THEN** os projetos ocultos que ele tem permissão de ver são retornados junto com os demais

#### Scenario: Projeto oculto e restrito sem vínculo continua oculto
- **WHEN** um usuário sem vínculo solicita `GET /projects?includeHidden=true`
- **THEN** o projeto oculto e restrito não é retornado

#### Scenario: Parâmetro inválido é tratado como ausente
- **WHEN** a requisição informa `includeHidden` com valor diferente de `true`
- **THEN** o sistema trata como `false` e não retorna projetos ocultos

### Requirement: Preferência de sessão "mostrar projetos ocultos"
O sistema SHALL disponibilizar uma preferência "mostrar projetos ocultos", desligada por padrão, que controla o envio de `includeHidden=true` na listagem de projetos. A preferência SHALL valer somente para a sessão atual, SHALL ser reiniciada para desligada em todo login e logout, e SHALL NÃO ser persistida em banco de dados nem em `localStorage`.

#### Scenario: Preferência desligada por padrão
- **WHEN** o usuário autentica na aplicação
- **THEN** a preferência "mostrar projetos ocultos" está desligada e projetos ocultos não aparecem na listagem

#### Scenario: Ligar a preferência revela projetos ocultos
- **WHEN** o usuário liga a preferência
- **THEN** a listagem é recarregada com `includeHidden=true` e os projetos ocultos passam a ser exibidos

#### Scenario: Desligar a preferência esconde novamente
- **WHEN** o usuário desliga a preferência
- **THEN** a listagem é recarregada sem `includeHidden` e os projetos ocultos deixam de ser exibidos

#### Scenario: Preferência é reiniciada no login
- **WHEN** o usuário, com a preferência ligada, faz logout e autentica novamente
- **THEN** a preferência volta a estar desligada

#### Scenario: Preferência não vaza entre logins
- **WHEN** outro usuário autentica no mesmo navegador após a preferência ter sido ligada
- **THEN** a preferência está desligada para o novo usuário

### Requirement: Controles de visibilidade na interface de projetos
O sistema SHALL exibir os controles "Restrito" e "Oculto" no formulário de criação de projeto e em uma seção "Visibilidade do projeto" nas configurações do projeto.

#### Scenario: Toggles no formulário de criação
- **WHEN** o usuário abre o formulário de novo projeto
- **THEN** os controles "Restrito" e "Oculto" são exibidos desligados, com texto explicativo de cada comportamento

#### Scenario: Seção de visibilidade nas configurações
- **WHEN** um usuário com acesso abre as configurações do projeto
- **THEN** a seção "Visibilidade do projeto" exibe o estado atual de "Restrito" e "Oculto" e permite alterá-los
