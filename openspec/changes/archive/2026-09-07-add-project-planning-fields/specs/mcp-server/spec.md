## MODIFIED Requirements

### Requirement: Servidor MCP nativo com ferramentas de board
O sistema SHALL disponibilizar um servidor MCP (Model Context Protocol) expondo ferramentas para que agentes de IA interajam com o board sem necessidade de código adicional. O catálogo de definições, schemas, políticas e executores SHALL ser reutilizável pelo harness interno do Azy Agent sem duplicar regras de domínio. As ferramentas `create_project`, `create_project_structure` e `update_project` SHALL aceitar os campos opcionais de planejamento `startDate`, `plannedEndDate`, `plannedPoints`, `plannedHours` e `scope`. A ferramenta `get_project` SHALL retornar esses campos quando preenchidos.

#### Scenario: Listar tasks disponíveis
- **WHEN** agente invoca ferramenta `list_tasks` com `{ projectId, sprintId?, type?, onlyLeaves? }`
- **THEN** servidor retorna lista de items filtrados; `type` aceita EPIC, STORY, TASK, BUG ou combinações separadas por vírgula; `onlyLeaves=true` (padrão) retorna apenas items sem filhos

#### Scenario: Navegar hierarquia antes de criar items
- **WHEN** agente precisa criar uma STORY ou TASK e não possui os IDs dos ancestrais
- **THEN** agente usa `list_tasks` com `type=EPIC` ou `type=STORY` e `onlyLeaves=false` para obter IDs sem precisar saber a hierarquia de memória

#### Scenario: Verificar sprint atual
- **WHEN** agente invoca ferramenta `get_current_sprint` com `{ projectId }`
- **THEN** servidor retorna dados da sprint ativa ou informa que não há sprint ativa

#### Scenario: Criar projeto com campos de planejamento via MCP
- **WHEN** agente invoca `create_project` com `{ name, startDate, plannedEndDate, plannedPoints, plannedHours, scope }`
- **THEN** servidor cria o projeto com os campos de planejamento informados e os retorna na resposta

#### Scenario: Atualizar campos de planejamento via MCP
- **WHEN** agente invoca `update_project` com `{ projectId, plannedPoints: 120, scope: "<p>Escopo revisado</p>" }`
- **THEN** servidor atualiza apenas os campos enviados e retorna o projeto atualizado

#### Scenario: Obter projeto com planejamento via MCP
- **WHEN** agente invoca `get_project` com `{ projectId }`
- **THEN** servidor retorna o projeto incluindo `startDate`, `plannedEndDate`, `plannedPoints`, `plannedHours` e `scope` (null quando não preenchidos)
