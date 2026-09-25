## Purpose

Definir o package compartilhado do tool registry (`packages/tool-registry`): definições de ferramentas, validação de argumentos, policies de permissão e testes de contrato vivendo juntos, autocontidos e sem dependência de transporte.

## Requirements

### Requirement: Tool registry em package compartilhado

O tool registry (definições de ferramentas, schemas JSON, campos aceitos/obrigatórios, classificações e descrições SHALL viver em `packages/tool-registry`, acessível por `@azy-board/tool-registry`. O package SHALL ser autocontido: sem dependência de transporte HTTP, banco ou framework.

#### Scenario: Definição acessível por package
- **WHEN** a API ou o MCP precisa das definições de ferramentas
- **THEN** importa `getSharedToolDefinitions` de `@azy-board/tool-registry`

#### Scenario: Sem dependência de transporte
- **WHEN** o package `tool-registry` é importado
- **THEN** não há import de `fetch`, `ApiCall`, Hono ou qualquer transporte HTTP

### Requirement: Validation e policies no mesmo package

A validação de argumentos (`validateToolArguments`) e as policies de permissão (`MCP_TOOL_POLICIES`) SHALL viver em `packages/tool-registry`, junto das definições. O import circular entre registry e validation SHALL ser resolvido via módulo interno compartilhado.

#### Scenario: Validação consistente com definições
- **WHEN** `validateToolArguments` é chamado
- **THEN** usa os mesmos campos obrigatórios do descritor da ferramenta

#### Scenario: Policy por ferramenta
- **WHEN** uma ferramenta é executada
- **THEN** a policy é consultada de `MCP_TOOL_POLICIES` no package

#### Scenario: Sem import circular
- **WHEN** o package é compilado
- **THEN** não há dependência circular entre módulos internos

### Requirement: Testes de contrato acompanham o registry

Os testes que garantem a unicidade do catálogo (`registry-contract`, `optional-fields`) SHALL viver junto do registry em `packages/tool-registry`, não no app MCP.

#### Scenario: Teste de contrato no package
- **WHEN** uma ferramenta nova é adicionada
- **THEN** o teste de contrato em `packages/tool-registry` valida schema × requiredFields × validation

#### Scenario: Teste MCP continua passando
- **WHEN** `bun run test:mcp-catalog` roda
- **THEN** valida o catálogo via o package, não via caminho do app
