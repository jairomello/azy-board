# Spec Delta

## MODIFIED Requirements

### Requirement: Execução compartilhada independente de aplicativo de transporte

A camada de execução de ferramentas SHALL permanecer compartilhada e sem dependência de `apps/mcp`, do SDK MCP, do Hono ou de driver de banco. O catálogo, schemas e policies SHALL permanecer em `packages/tool-registry` sem transporte. A API SHALL compilar e inicializar sem as fontes do app `apps/mcp`; SHALL poder hospedar o adaptador de transporte MCP por meio de pacote neutro dedicado, que concentra a dependência do SDK MCP.

#### Scenario: API isolada do MCP
- **WHEN** a API é construída e inicializada em staging descartável contendo seus pacotes necessários e sem `apps/mcp`, em SIMPLE e ADVANCED
- **THEN** build e readiness passam sem importar fontes de `apps/mcp`; o transporte MCP hospedado, quando presente, é provido pelo pacote neutro

#### Scenario: Import do pacote sem efeitos colaterais
- **WHEN** o pacote de execução é importado sem variáveis de conexão, servidor ou SDK MCP
- **THEN** ele não inicia conexões nem processos e exige dependências de execução por composição

#### Scenario: SDK concentrado no pacote neutro
- **WHEN** as dependências dos pacotes são inspecionadas
- **THEN** somente o pacote neutro de transporte MCP declara o SDK MCP, e nem a API nem a camada de execução o declaram
