## ADDED Requirements

### Requirement: Ferramentas MCP retornam erro normalizado
As ferramentas MCP SHALL preservar o contrato único de erro para falhas de validação, autorização, recurso, conflito e infraestrutura, sem emitir `error` como string ou `code` e `retryable` fora do objeto `error`.

#### Scenario: Parâmetro inválido em ferramenta MCP
- **WHEN** um agente invoca uma ferramenta com parâmetros inválidos
- **THEN** a ferramenta retorna o envelope comum com código de validação e detalhes dos campos rejeitados

#### Scenario: Erro da API durante ferramenta MCP
- **WHEN** a API HTTP retorna um erro normalizado
- **THEN** o MCP repassa o código, mensagem, retryabilidade e detalhes sem uma segunda conversão semântica
