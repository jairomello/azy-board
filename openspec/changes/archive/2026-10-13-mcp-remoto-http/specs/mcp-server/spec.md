# Spec Delta

## MODIFIED Requirements

### Requirement: Transporte e autenticação do MCP
O servidor MCP SHALL oferecer transporte stdio para uso local e SHALL oferecer transporte Streamable HTTP hospedado para acesso remoto. Em ambos os transportes, SHALL autenticar por API Key e, a cada chamada, resolver o Owner persistido da chave e aplicar suas permissões globais, membership local, tenant e escopos restritivos; a chave nunca SHALL conceder privilégios superiores aos do Owner.

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
