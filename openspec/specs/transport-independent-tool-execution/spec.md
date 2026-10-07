## Purpose

Definir a execução compartilhada de ferramentas e casos de uso críticos sem dependência de aplicativos de transporte, preservando autorização, transações e contratos equivalentes para API REST, MCP via HTTP e agente local.

## Requirements

### Requirement: Execução compartilhada independente de aplicativo de transporte

O sistema SHALL disponibilizar execução de ferramentas em camada compartilhada sem dependência de `apps/mcp`, SDK MCP, Hono ou driver de banco. A API SHALL compilar e inicializar sem as fontes MCP. O catálogo, schemas e policies SHALL permanecer em `packages/tool-registry` sem transporte, e os adaptadores SHALL consumir a mesma execução por ports injetados.

#### Scenario: API isolada do MCP
- **WHEN** a API é construída e inicializada em staging descartável contendo seus pacotes necessários e sem `apps/mcp`, em SIMPLE e ADVANCED
- **THEN** build e readiness passam sem importar fontes MCP ou registrar transporte MCP

#### Scenario: Import do pacote sem efeitos colaterais
- **WHEN** o pacote de execução é importado sem variáveis de conexão, servidor ou SDK MCP
- **THEN** ele não inicia conexões nem processos e exige dependências de execução por composição

### Requirement: Casos críticos com autorização e unidade de trabalho explícitas

Criar, editar e mover item, batch de criação/atualização/movimentação e execução de ferramenta do agente SHALL usar casos de uso compartilhados. Esses casos SHALL receber tenant/ator autenticados e ports transacionais; SHALL revalidar membership, escopos, Leaf Rule, relações e revisão no momento do uso; SHALL consumir a unidade transacional de idempotência/auditoria/analytics/eventos e fencing estabelecida pelos cards dependentes sem manter implementação paralela. Adaptadores SHALL NOT aceitar identidade ou privilégio fornecidos pelo modelo.

#### Scenario: Membership revogada após descoberta
- **WHEN** um usuário perde acesso entre a descoberta da ferramenta e a execução local ou HTTP
- **THEN** a execução é negada sem mutação, auditoria de sucesso ou evento de domínio confirmado

#### Scenario: Falha no batch
- **WHEN** uma operação intermediária do batch falha dentro da unidade de trabalho
- **THEN** nenhuma mutação parcial nem resultado idempotente de sucesso é confirmado e nenhuma publicação de sucesso é feita

#### Scenario: Projeto ou tenant divergente
- **WHEN** o comando referencia recurso de outro tenant ou projeto fora do contexto autorizado
- **THEN** REST, MCP e agente rejeitam a ação sem acessar ou modificar dados de outro escopo

#### Scenario: Posse do agente perdida
- **WHEN** a execução do agente chega ao caso de uso com token de posse inválido segundo o contrato de T37
- **THEN** nenhum efeito da ferramenta é confirmado por essa execução

### Requirement: Compatibilidade de execução e efeitos

A extração SHALL preservar nomes e schemas, coerção de opcionais/null/escalares, duração normalizada, resolução de projeto, sanitização, revisões de fotografia, erros e aprovação existentes. REST, MCP via HTTP e agente local SHALL produzir resultados e efeitos lógicos equivalentes para comandos equivalentes autorizados em SIMPLE e ADVANCED. Não SHALL existir cálculo de regra de negócio crítico duplicado no transporte.

#### Scenario: Comando equivalente nos três acessos
- **WHEN** a mesma criação/edição/movimentação é exercitada com fixtures equivalentes e relógio controlado por REST, MCP e agente
- **THEN** os contratos de resposta, revisões e efeitos persistidos são equivalentes, normalizando somente identificadores gerados

#### Scenario: Retry após commit
- **WHEN** uma chamada crítica é repetida com a mesma chave e payload após commit, pelo contrato de T38
- **THEN** retorna o mesmo resultado lógico sem nova mutação ou efeito confirmado

#### Scenario: Coerção e fotografia preservadas
- **WHEN** ferramenta recebe opcionais null, duração humana ou revisões capturadas na fotografia
- **THEN** usa a normalização e a checagem de concorrência existentes, sem descartar revisão nem relaxar validação
