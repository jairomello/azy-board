# Spec Delta

## Purpose

Disponibilizar o servidor MCP do Azy Board por transporte remoto (Streamable HTTP), hospedado junto da aplicação, para que code agents se conectem por URL sem subir um processo local nem configurar credenciais por ambiente.

## ADDED Requirements

### Requirement: Endpoint MCP remoto por Streamable HTTP

A instalação SHALL expor um endpoint MCP por transporte Streamable HTTP, hospedado no mesmo serviço da API, reutilizando o catálogo de ferramentas, as policies e a execução compartilhada já usados pelos demais acessos. O endpoint SHALL anunciar o mesmo catálogo público de ferramentas disponível ao transporte local.

#### Scenario: Cliente remoto se conecta por URL
- **WHEN** um code agent é configurado com a URL do endpoint MCP da instalação e a credencial válida
- **THEN** ele completa o handshake do protocolo e lista as ferramentas sem precisar executar processo local

#### Scenario: Mesmo catálogo do transporte local
- **WHEN** o cliente remoto solicita a listagem de ferramentas
- **THEN** recebe as mesmas ferramentas (nomes e schemas) oferecidas pelo transporte stdio, sujeitas às políticas de acesso

### Requirement: Autenticação por credencial a cada requisição

O endpoint MCP SHALL autenticar cada requisição HTTP por API Key, resolvendo no servidor o Owner persistido, seu tenant, grupo global e escopos. O endpoint NÃO SHALL usar a sessão do protocolo como autenticação, NÃO SHALL aceitar identidade, tenant, grupo ou privilégio vindos do payload e NÃO SHALL repassar a credencial do cliente a serviços de terceiros.

#### Scenario: Requisição sem credencial
- **WHEN** uma requisição chega ao endpoint sem API Key válida
- **THEN** a requisição é recusada sem executar ferramenta e sem revelar dados de recurso

#### Scenario: Revogação ou rebaixamento têm efeito imediato
- **WHEN** a API Key é revogada, expira, ou o grupo do Owner é reduzido enquanto o cliente mantém a conexão
- **THEN** a próxima requisição é revalidada e perde o acesso correspondente

#### Scenario: Sessão não autentica
- **WHEN** um cliente reapresenta apenas um identificador de sessão do protocolo sem credencial válida
- **THEN** a operação é negada

### Requirement: Isolamento de tenant, projeto e permissão

Cada chamada remota SHALL aplicar o tenant do Owner, o grupo global, a membership no projeto, o `projectScope` e o `permissionScope` da chave, e SHALL revalidar autorização no momento do uso, sem permitir acesso cross-tenant ou a projeto fora do escopo.

#### Scenario: Escopo de projeto restringe
- **WHEN** a API Key possui `projectScope` que não inclui o projeto informado
- **THEN** a chamada é negada sem ler nem alterar dados

#### Scenario: Projeto de outro tenant
- **WHEN** a chamada referencia recurso de outro tenant
- **THEN** a operação é rejeitada sem acessar dados de outro escopo

#### Scenario: Autorização revalidada por chamada
- **WHEN** a membership do Owner é revogada após o handshake
- **THEN** a ferramenta é negada mesmo que já tenha sido listada

### Requirement: Contexto de projeto explícito

No modo remoto, o endpoint NÃO SHALL depender de configuração de ambiente por cliente para definir um projeto padrão. O contexto de projeto SHALL ser informado explicitamente na chamada ou em contexto de sessão fornecido pelo cliente.

#### Scenario: Sem projeto padrão de ambiente
- **WHEN** o cliente remoto não define projeto padrão
- **THEN** ferramentas que exigem `projectId` o recebem como argumento explícito e falham de forma acionável quando ausente

#### Scenario: Contexto de sessão aceito
- **WHEN** o cliente fornece um projeto de contexto na inicialização
- **THEN** o endpoint aplica esse contexto às ferramentas que aceitam `projectId` opcional

### Requirement: Idempotência de mutações

O endpoint MCP SHALL permitir repetição segura de uma chamada de mutação, de modo que uma nova tentativa após o commit não produza efeito duplicado.

#### Scenario: Retry após commit
- **WHEN** a mesma mutação é repetida com a mesma chave de idempotência e payload após o commit
- **THEN** o endpoint retorna o mesmo resultado lógico sem nova mutação

### Requirement: Operação sem afinidade de sessão

O endpoint MCP SHALL operar sem exigir afinidade de sessão entre requisições, de modo que requisições sucessivas de um mesmo cliente possam ser atendidas por instâncias diferentes.

#### Scenario: Requisição atendida em instância distinta
- **WHEN** duas requisições da mesma sessão lógica são encaminhadas a instâncias diferentes com identidade válida
- **THEN** ambas são atendidas corretamente, sem depender de estado local da instância

### Requirement: Erros normalizados e saída sem vazamento

O endpoint MCP SHALL preservar o envelope de erro comum (código, mensagem, retryabilidade e detalhes) e SHALL sanitizar a saída, sem expor a credencial, caminhos físicos, nem dados fora do escopo autorizado.

#### Scenario: Erro da camada de execução
- **WHEN** uma ferramenta falha por validação, autorização ou conflito
- **THEN** o endpoint devolve o envelope normalizado correspondente, sem conversão semântica própria

#### Scenario: Credencial nunca exposta
- **WHEN** qualquer chamada é processada
- **THEN** a API Key não aparece em resposta, mensagem de erro ou log
