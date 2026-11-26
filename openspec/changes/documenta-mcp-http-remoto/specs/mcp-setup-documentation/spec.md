## ADDED Requirements

### Requirement: Guia de configuração do MCP remoto

A documentação de configuração do MCP SHALL apresentar o endpoint remoto
Streamable HTTP em `/mcp` como o modo recomendado para instalações hospedadas,
incluindo autenticação por API Key Bearer, ausência de dependência de processo
local e distinção clara do modo `stdio`.

#### Scenario: Usuário configura uma instalação hospedada

- **WHEN** o usuário consulta o guia para conectar um cliente a uma instalação hospedada
- **THEN** o guia orienta a usar a URL da instalação terminada em `/mcp`, transporte HTTP e cabeçalho `Authorization: Bearer`
- **AND** informa que Bun, repositório local e variáveis de ambiente do processo não são necessários

#### Scenario: Usuário escolhe o transporte local

- **WHEN** o usuário consulta o guia para desenvolvimento local com `stdio`
- **THEN** o guia identifica esse modo como alternativa local e informa os requisitos próprios, incluindo Bun, processo local e variáveis de ambiente aplicáveis

#### Scenario: Usuário define o projeto no modo remoto

- **WHEN** o usuário precisa selecionar o projeto de contexto no MCP remoto
- **THEN** o guia orienta a informar `projectId` nos argumentos ou usar o cabeçalho opcional `X-Azyboard-Project-Id`
- **AND** deixa claro que `AZYBOARD_PROJECT_ID` é aplicável somente ao modo `stdio`
