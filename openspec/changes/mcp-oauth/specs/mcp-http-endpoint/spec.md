## MODIFIED Requirements

### Requirement: Autenticação por credencial a cada requisição

O endpoint MCP SHALL autenticar cada requisição HTTP por access token OAuth emitido pela instalação ou, de forma depreciada, por API Key, resolvendo no servidor o usuário persistido (autor da conexão OAuth ou Owner da chave), seu tenant, grupo global e escopos. O endpoint NÃO SHALL usar a sessão do protocolo como autenticação, NÃO SHALL aceitar identidade, tenant, grupo ou privilégio vindos do payload e NÃO SHALL repassar a credencial do cliente a serviços de terceiros.

#### Scenario: Requisição sem credencial
- **WHEN** uma requisição chega ao endpoint sem API Key válida
- **THEN** a requisição é recusada sem executar ferramenta e sem revelar dados de recurso

#### Scenario: Revogação ou rebaixamento têm efeito imediato
- **WHEN** a API Key é revogada, expira, ou o grupo do Owner é reduzido enquanto o cliente mantém a conexão
- **THEN** a próxima requisição é revalidada e perde o acesso correspondente

#### Scenario: Sessão não autentica
- **WHEN** um cliente reapresenta apenas um identificador de sessão do protocolo sem credencial válida
- **THEN** a operação é negada

#### Scenario: Requisição com token OAuth
- **WHEN** uma requisição chega com access token OAuth válido para a audiência da rota
- **THEN** as ferramentas operam com as permissões efetivas do usuário que autorizou a conexão, limitadas pelos escopos concedidos

#### Scenario: Token OAuth inválido ou revogado
- **WHEN** o access token está expirado, revogado ou pertence a uma conexão revogada
- **THEN** a requisição é recusada com 401 e `WWW-Authenticate` sem executar ferramenta

### Requirement: Isolamento de tenant, projeto e permissão

Cada chamada remota SHALL aplicar o tenant do usuário, o grupo global, a membership no projeto, o `projectScope` e o `permissionScope` da credencial (API Key ou conexão OAuth), e SHALL revalidar autorização no momento do uso, sem permitir acesso cross-tenant ou a projeto fora do escopo.

#### Scenario: Escopo de projeto restringe
- **WHEN** a API Key possui `projectScope` que não inclui o projeto informado
- **THEN** a chamada é negada sem ler nem alterar dados

#### Scenario: Projeto de outro tenant
- **WHEN** a chamada referencia recurso de outro tenant
- **THEN** a operação é rejeitada sem acessar dados de outro escopo

#### Scenario: Autorização revalidada por chamada
- **WHEN** a membership do Owner é revogada após o handshake
- **THEN** a ferramenta é negada mesmo que já tenha sido listada

#### Scenario: Conexão OAuth de projeto restringe
- **WHEN** uma conexão OAuth autorizada para o MCP do projeto A tenta operar no projeto B
- **THEN** a chamada é negada sem ler nem alterar dados de B

### Requirement: Contexto de projeto explícito

No modo remoto, o endpoint NÃO SHALL depender de configuração de ambiente por cliente para definir um projeto padrão. O contexto de projeto SHALL ser informado explicitamente na chamada, em contexto de sessão fornecido pelo cliente ou pela URL do MCP do projeto (`/mcp/projects/{projectId}`).

#### Scenario: Sem projeto padrão de ambiente
- **WHEN** o cliente remoto não define projeto padrão
- **THEN** ferramentas que exigem `projectId` o recebem como argumento explícito e falham de forma acionável quando ausente

#### Scenario: Contexto de sessão aceito
- **WHEN** o cliente fornece um projeto de contexto na inicialização
- **THEN** o endpoint aplica esse contexto às ferramentas que aceitam `projectId` opcional

#### Scenario: Projeto definido pela URL
- **WHEN** o cliente está conectado a `/mcp/projects/{projectId}`
- **THEN** o endpoint usa esse projeto como contexto e rejeita `projectId` explícito diferente

### Requirement: Erros normalizados e saída sem vazamento

O endpoint MCP SHALL preservar o envelope de erro comum (código, mensagem, retryabilidade e detalhes) e SHALL sanitizar a saída, sem expor a credencial (API Key ou token OAuth), caminhos físicos, nem dados fora do escopo autorizado.

#### Scenario: Erro da camada de execução
- **WHEN** uma ferramenta falha por validação, autorização ou conflito
- **THEN** o endpoint devolve o envelope normalizado correspondente, sem conversão semântica própria

#### Scenario: Credencial nunca exposta
- **WHEN** qualquer chamada é processada
- **THEN** a API Key não aparece em resposta, mensagem de erro ou log

#### Scenario: Token OAuth nunca exposto
- **WHEN** qualquer chamada autenticada por token OAuth é processada
- **THEN** o access token e o refresh token não aparecem em resposta, mensagem de erro ou log
