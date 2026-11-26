## MODIFIED Requirements

### Requirement: Transporte e autenticação do MCP
O servidor MCP SHALL oferecer transporte stdio para uso local e SHALL oferecer transporte Streamable HTTP hospedado para acesso remoto, inclusive por projeto em `/mcp/projects/{projectId}`. O transporte remoto SHALL autenticar por OAuth 2.1 como forma recomendada e SHALL continuar aceitando API Key de forma depreciada; o stdio SHALL autenticar por API Key e é depreciado. Em todos os casos, SHALL, a cada chamada, resolver o usuário persistido (autor da conexão OAuth ou Owner da chave) e aplicar suas permissões globais, membership local, tenant e escopos restritivos; nenhuma credencial SHALL conceder privilégios superiores aos desse usuário.

#### Scenario: Configuração do MCP em agente de IA
- **WHEN** agente configura o servidor MCP com `EASYBOARD_API_KEY` e URL do backend
- **THEN** todas as ferramentas operam autenticadas com as permissões efetivas do Owner humano da API Key

#### Scenario: Chave não amplia privilégios
- **WHEN** API Key possui escopo de permissão mais amplo que o grupo ou membership do Owner
- **THEN** o MCP aplica a interseção restritiva e nega operações acima das permissões do Owner

#### Scenario: Estado alterado após inicialização
- **WHEN** o grupo do Owner é reduzido ou a API Key é revogada enquanto o processo MCP continua ativo
- **THEN** a próxima chamada é revalidada e perde o acesso correspondente

#### Scenario: Acesso remoto por Streamable HTTP
- **WHEN** um cliente se conecta ao transporte Streamable HTTP hospedado com uma API Key válida
- **THEN** as ferramentas operam autenticadas com as permissões efetivas do Owner da API Key, sem depender de variável de ambiente no cliente

#### Scenario: Acesso remoto por OAuth
- **WHEN** um cliente se conecta ao transporte Streamable HTTP apenas com a URL e conclui a autorização OAuth no Azy Board
- **THEN** as ferramentas operam com as permissões efetivas do usuário que autorizou, sem API Key nem variável de ambiente no cliente

#### Scenario: stdio depreciado
- **WHEN** o servidor stdio é iniciado
- **THEN** ele funciona com a API Key como antes e avisa em stderr que o modo está depreciado em favor do MCP remoto com OAuth
