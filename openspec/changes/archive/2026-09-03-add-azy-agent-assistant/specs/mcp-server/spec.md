## MODIFIED Requirements

### Requirement: Servidor MCP nativo com ferramentas de board
O sistema SHALL disponibilizar um servidor MCP (Model Context Protocol) expondo ferramentas para que agentes de IA interajam com o board sem necessidade de código adicional. O catálogo de definições, schemas, políticas e executores SHALL ser reutilizável pelo harness interno do Azy Agent sem duplicar regras de domínio.

#### Scenario: Listar tasks disponíveis
- **WHEN** agente invoca ferramenta `list_tasks` com `{ projectId, sprintId?, type?, onlyLeaves? }`
- **THEN** servidor retorna lista de items filtrados; `type` aceita EPIC, STORY, TASK, BUG ou combinações separadas por vírgula; `onlyLeaves=true` (padrão) retorna apenas items sem filhos

#### Scenario: Navegar hierarquia antes de criar items
- **WHEN** agente precisa criar uma STORY ou TASK e não possui os IDs dos ancestrais
- **THEN** agente usa `list_tasks` com `type=EPIC` ou `type=STORY` e `onlyLeaves=false` para obter IDs sem precisar saber a hierarquia de memória

#### Scenario: Verificar sprint atual
- **WHEN** agente invoca ferramenta `get_current_sprint` com `{ projectId }`
- **THEN** servidor retorna dados da sprint ativa ou informa que não há sprint ativa

#### Scenario: Harness reutiliza catálogo
- **WHEN** o Azy Agent interno prepara tools para uma run
- **THEN** utiliza as mesmas definições, schemas, políticas e executores do catálogo MCP, aplicando o contexto do usuário humano e sem iniciar uma chamada MCP com credencial compartilhada
