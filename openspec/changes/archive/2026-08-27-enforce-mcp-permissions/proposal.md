## Why

As ferramentas MCP atualmente autenticam pela API Key do proprietário, mas precisam garantir de forma explícita que o agente nunca ultrapasse o grupo global e o escopo de projetos desse proprietário. Sem uma política centralizada, um Membro de Equipe poderia usar o MCP para tentar executar operações administrativas ou acessar projetos fora de sua associação.

## What Changes

- Fazer o MCP resolver as permissões do proprietário da API Key no servidor, usando o grupo persistido no tenant ativo.
- Aplicar ao MCP os grupos `TEAM_MEMBER`, `MANAGER`, `ADMIN` e `ROOT` e suas regras cumulativas de escopo e operação.
- Garantir que toda ferramenta MCP aplique as mesmas autorizações das APIs REST, incluindo membership, papel local e escopo da API Key.
- Negar no servidor operações administrativas, configurações, criação de projetos e acesso a projetos conforme o grupo efetivo do proprietário.
- Impedir que payloads, parâmetros, nomes de ferramentas ou escopos da API Key concedam privilégios adicionais.
- Retornar erros seguros e estáveis para operações MCP não autorizadas, sem revelar recursos de outros tenants ou projetos.
- Adicionar cobertura de testes por grupo, tenant, ferramenta e tentativa de bypass.

## Capabilities

### New Capabilities

- `mcp-permissions`: herança e aplicação rigorosa das permissões globais e locais do proprietário da API Key no MCP.

### Modified Capabilities

- `mcp-server`: exigir autorização efetiva do Owner em cada ferramenta MCP.
- `mcp-ai-first-workflow`: aplicar o escopo e as permissões do Owner nos fluxos completos de descoberta, configuração e execução.
- `api-key-management`: tornar explícito que a API Key de agente não amplia as permissões do Owner e que seu escopo só pode restringir acesso.
- `user-permissions`: aplicar os grupos globais também à autenticação e autorização de agentes que atuam em nome do usuário.

## Impact

- Middleware de autenticação por API Key, resolução de Owner e autorização server-side da API e do servidor MCP.
- Handlers e catálogo de ferramentas MCP, incluindo operações de leitura, criação, edição, exclusão, membros, configurações e projetos.
- Contratos de erro e testes de segurança, isolamento multi-tenant e prevenção de escalada de privilégios.
- Nenhuma nova dependência externa ou funcionalidade de administração de tenants será introduzida.
