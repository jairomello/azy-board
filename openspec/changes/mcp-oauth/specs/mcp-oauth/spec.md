## ADDED Requirements

### Requirement: Descoberta OAuth do MCP

A instalação SHALL publicar Protected Resource Metadata (RFC 9728) para o MCP geral e para cada MCP de projeto, e Authorization Server Metadata (RFC 8414), com URLs derivadas da URL pública configurada. O metadata SHALL anunciar Authorization Code com PKCE `S256`, `refresh_token`, cliente público, registro dinâmico, revogação e os escopos `read`, `write`, `admin` e `delete`. Descoberta, registro, token e revogação SHALL aceitar CORS de qualquer origem sem credenciais.

#### Scenario: Cliente descobre o authorization server
- **WHEN** um cliente MCP consulta o PRM do endpoint `/mcp`
- **THEN** recebe o `resource` igual à URL pública do `/mcp` e o `authorization_servers` da instalação

#### Scenario: Metadata do authorization server
- **WHEN** o cliente consulta `/.well-known/oauth-authorization-server`
- **THEN** recebe `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `revocation_endpoint`, `code_challenge_methods_supported` com `S256` e os escopos suportados

#### Scenario: PRM de projeto não revela existência
- **WHEN** o cliente consulta o PRM de `/mcp/projects/{id}` para um UUID válido de projeto inexistente
- **THEN** a resposta tem o mesmo formato da de um projeto existente

#### Scenario: Instalação sob base path
- **WHEN** a aplicação roda sob um base path
- **THEN** o `resource` e as URLs do metadata incluem o base path

### Requirement: Registro dinâmico de cliente

A instalação SHALL aceitar registro dinâmico de cliente público (RFC 7591), sem segredo, exigindo ao menos um `redirect_uri`, com limite de taxa por origem. O `redirect_uri` usado depois SHALL coincidir exatamente com um registrado.

#### Scenario: Registro de cliente público
- **WHEN** um cliente MCP envia metadados de registro com `redirect_uris` válidos
- **THEN** recebe um `client_id` e `token_endpoint_auth_method` igual a `none`

#### Scenario: Registro sem redirect_uri
- **WHEN** o registro não informa `redirect_uris`
- **THEN** a instalação recusa com `invalid_redirect_uri` sem criar cliente

#### Scenario: Excesso de registros
- **WHEN** uma origem ultrapassa o limite de registros
- **THEN** a instalação responde 429 com indicação de retry

#### Scenario: Nome do app sanitizado
- **WHEN** o registro informa `client_name` longo ou com marcação
- **THEN** o nome é truncado e armazenado como texto puro

### Requirement: Consentimento com usuário logado

O `authorization_endpoint` SHALL ser uma tela da aplicação web que exige sessão humana; sem sessão, o usuário passa pelo login e volta à tela com os parâmetros originais. A tela SHALL mostrar app, host do `redirect_uri` com aviso de app não verificado, conta, projeto (quando houver) e escopos, e SHALL permitir aprovar ou negar. Só a sessão humana aprova; a validação exige `response_type=code`, PKCE `S256`, cliente registrado, `redirect_uri` exato e `resource` conhecido.

#### Scenario: Usuário sem sessão
- **WHEN** o cliente abre a tela de autorização e o usuário não está logado
- **THEN** o usuário é levado ao login e, depois de autenticar, volta à tela de autorização com os parâmetros originais

#### Scenario: Aprovação
- **WHEN** o usuário aprova o consentimento
- **THEN** o navegador é redirecionado ao `redirect_uri` com `code` e `state`, e o code vale uma única vez por 5 minutos

#### Scenario: Negação
- **WHEN** o usuário nega o consentimento
- **THEN** o navegador é redirecionado ao `redirect_uri` registrado com `error=access_denied` e `state`

#### Scenario: redirect_uri não registrado
- **WHEN** o `redirect_uri` não coincide com um registrado pelo cliente
- **THEN** a tela exibe erro e não redireciona para o endereço informado

#### Scenario: Recurso de projeto exibido
- **WHEN** o `resource` é o MCP de um projeto acessível ao usuário
- **THEN** a tela mostra o nome do projeto e o code fica preso a esse recurso

#### Scenario: Recurso desconhecido ou sem acesso
- **WHEN** o `resource` não é um MCP da instalação ou é de projeto sem acesso do usuário
- **THEN** a autorização é recusada com `invalid_target` sem revelar se o projeto existe

#### Scenario: Credencial de agente tenta aprovar
- **WHEN** uma requisição de aprovação chega autenticada por API Key ou token OAuth, sem sessão humana
- **THEN** a aprovação é recusada com 401 e nenhum code é emitido

#### Scenario: Destino de login externo
- **WHEN** o parâmetro de retorno pós-login aponta para fora da aplicação
- **THEN** o retorno é ignorado e o usuário vai para a página padrão

### Requirement: Escopos OAuth do MCP

Os escopos SHALL ser `read`, `write`, `admin` e `delete`, com o mesmo significado do `permissionScope` da API Key. O escopo concedido SHALL ser a interseção entre o pedido e os escopos conhecidos; o papel do usuário no projeto SHALL continuar sendo aplicado em cada chamada. Pedido sem `scope` SHALL usar o padrão `read write`. Escopos desconhecidos SHALL ser descartados.

#### Scenario: Pedido sem escopo
- **WHEN** o cliente inicia a autorização sem `scope`
- **THEN** o consentimento mostra e o token recebe `read write`

#### Scenario: Escopo restringe operação
- **WHEN** um token com escopo `read` chama ferramenta de mutação
- **THEN** a operação é negada como a de uma API Key com `permissionScope` `read`

### Requirement: Emissão, renovação e revogação de tokens

O token endpoint SHALL trocar o code por access token opaco de 1 hora e refresh token de 30 dias, validando cliente, `redirect_uri`, PKCE e `resource` (usado como audiência). Tokens SHALL ser guardados só como hash. Cada renovação SHALL emitir novo par e invalidar o anterior; reuso de refresh fora de uma janela curta de tolerância SHALL revogar a conexão. A revogação (RFC 7009) SHALL responder com sucesso também para token desconhecido.

#### Scenario: Troca do code
- **WHEN** o cliente envia code válido com o `code_verifier` correto
- **THEN** recebe `access_token`, `refresh_token`, `token_type` `Bearer`, `expires_in` e `scope`

#### Scenario: PKCE inválido
- **WHEN** o `code_verifier` não corresponde ao `code_challenge`
- **THEN** a troca falha com `invalid_grant` e o code é consumido

#### Scenario: Code reutilizado
- **WHEN** um code já trocado é reapresentado
- **THEN** a troca falha com `invalid_grant`

#### Scenario: Renovação
- **WHEN** o cliente usa um refresh token válido
- **THEN** recebe novo par de tokens e o refresh anterior deixa de valer

#### Scenario: Reuso de refresh token
- **WHEN** um refresh token já usado é reapresentado depois da janela de tolerância
- **THEN** a troca falha e todos os tokens da conexão são revogados

#### Scenario: Renovação concorrente
- **WHEN** um refresh token recém-rotacionado é reapresentado dentro da janela de tolerância
- **THEN** a troca falha com `invalid_grant` e a conexão continua válida

#### Scenario: Revogação pelo cliente
- **WHEN** o cliente revoga um token
- **THEN** a próxima requisição MCP com ele é recusada com 401

### Requirement: Conexões MCP do usuário

Minha conta SHALL listar as conexões MCP autorizadas pelo usuário (app, recurso, escopos, data de autorização e último uso) e SHALL permitir revogar cada uma. Revogar SHALL invalidar todos os tokens da conexão na próxima requisição. O usuário SHALL ver e revogar somente as próprias conexões, e a gestão SHALL exigir sessão humana.

#### Scenario: Revogar conexão
- **WHEN** o usuário revoga uma conexão em Minha conta
- **THEN** a próxima chamada MCP feita com tokens daquela conexão recebe 401

#### Scenario: Gestão por credencial de agente
- **WHEN** uma API Key ou token OAuth tenta listar ou revogar conexões
- **THEN** a operação é recusada com 401

#### Scenario: Conexão de outro usuário
- **WHEN** um usuário tenta revogar conexão de outro usuário
- **THEN** a operação é recusada sem revelar a conexão

### Requirement: Token OAuth restrito ao MCP

O access token OAuth SHALL autenticar somente o endpoint MCP para cuja audiência foi emitido. As rotas REST em `/api` NÃO SHALL aceitar o token OAuth como credencial; a execução interna das ferramentas SHALL receber a identidade já resolvida pelo MCP por um canal que requisições externas não alcançam.

#### Scenario: Token OAuth na API REST
- **WHEN** um token OAuth é enviado diretamente a uma rota `/api`
- **THEN** a API responde 401

#### Scenario: Token de projeto no MCP geral
- **WHEN** um token emitido para `/mcp/projects/{id}` é usado em `/mcp`
- **THEN** a requisição é recusada com 401

#### Scenario: Token geral no MCP de projeto
- **WHEN** um token emitido para `/mcp` é usado em `/mcp/projects/{id}` de projeto acessível
- **THEN** a requisição é aceita

### Requirement: Conexão OAuth equivale ao Owner

Uma conexão OAuth SHALL operar com a identidade do usuário que a autorizou, recarregada a cada requisição, com as mesmas regras de tenant, grupo, membership, políticas, anti-escalada e revalidação aplicadas ao Owner da API Key. O escopo concedido restringe como `permissionScope` e o recurso de projeto como `projectScope`. As ações SHALL ser registradas com origem `MCP`, ator `AGENT` e o nome do app.

#### Scenario: Usuário desativado
- **WHEN** o usuário que autorizou a conexão é desativado
- **THEN** a próxima requisição MCP com o token é recusada com 401

#### Scenario: Grupo reduzido
- **WHEN** o grupo global do usuário é reduzido depois da autorização
- **THEN** a próxima chamada perde o acesso correspondente

#### Scenario: Badge do agente
- **WHEN** uma conexão OAuth faz claim de um card
- **THEN** o card exibe o avatar do usuário com badge de IA e o nome do app registrado

### Requirement: Desafio de autenticação no MCP

Toda resposta 401 do endpoint MCP (geral ou de projeto) SHALL incluir `WWW-Authenticate: Bearer` com `resource_metadata` apontando para o PRM da rota requisitada, e `error="invalid_token"` quando um token foi apresentado.

#### Scenario: Requisição sem credencial
- **WHEN** um cliente chama `/mcp` sem `Authorization`
- **THEN** recebe 401 com `WWW-Authenticate` apontando para o PRM do `/mcp`

#### Scenario: Token expirado no MCP de projeto
- **WHEN** um cliente chama `/mcp/projects/{id}` com access token expirado
- **THEN** recebe 401 com `error="invalid_token"` e `resource_metadata` do PRM daquele projeto

### Requirement: MCP por projeto

A instalação SHALL expor `/mcp/projects/{projectId}` com o mesmo catálogo e as mesmas regras do `/mcp`, usando o projeto do caminho como contexto padrão. Um `projectId` explícito diferente do caminho SHALL ser rejeitado. Projeto inexistente, de outro tenant ou sem acesso SHALL ter a mesma resposta. A aplicação SHALL oferecer a URL do MCP do projeto para copiar.

#### Scenario: Ferramenta sem projectId
- **WHEN** o cliente conectado ao MCP de um projeto chama `list_tasks` sem `projectId`
- **THEN** a ferramenta opera no projeto do caminho

#### Scenario: projectId divergente
- **WHEN** o cliente conectado ao MCP do projeto A envia `projectId` do projeto B
- **THEN** a chamada é rejeitada sem ler nem alterar dados de B

#### Scenario: Projeto sem acesso
- **WHEN** o usuário não tem acesso ao projeto do caminho
- **THEN** a resposta é igual à de projeto inexistente

#### Scenario: Ferramentas sem contexto de projeto
- **WHEN** o cliente conectado ao MCP de um projeto lista ou chama ferramentas
- **THEN** `create_project` e ferramentas de administração global não aparecem nem executam, e `list_projects` retorna só o projeto do caminho

#### Scenario: URL do MCP do projeto copiável
- **WHEN** o usuário abre a orientação de conexão MCP no projeto
- **THEN** vê e copia a URL `<origem + base path>/mcp/projects/{projectId}`

### Requirement: API Key depreciada no MCP

A API Key SHALL continuar autenticando o MCP remoto e o stdio sem mudança de permissões, mas SHALL ser sinalizada como depreciada: respostas do MCP remoto autenticadas por API Key SHALL incluir `Deprecation` e `Link` com `rel="deprecation"` para a documentação, o uso SHALL gerar log estruturado sem o segredo, e o stdio SHALL emitir aviso ao iniciar.

#### Scenario: API Key no MCP remoto
- **WHEN** um cliente chama `/mcp` com API Key válida
- **THEN** a chamada funciona como antes e a resposta traz `Deprecation` e `Link`

#### Scenario: Inicialização do stdio
- **WHEN** o servidor stdio inicia com `EASYBOARD_API_KEY`
- **THEN** escreve em stderr um aviso de depreciação recomendando o MCP remoto com OAuth, sem expor a chave
