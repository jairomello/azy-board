## ADDED Requirements

### Requirement: Roteamento de métricas do Dashboard para `get_dashboard_metrics`

O roteamento adaptativo SHALL incluir `get_dashboard_metrics` no conjunto inicial de intenções `read` para perguntas sobre WIP, bloqueios, atrasos, esforço, burnup, aging e sprint, e SHALL listar a ferramenta no catálogo compartilhado (MCP, README gerado e OpenAPI) com a classificação `{ domain: 'board', scope: 'project', operation: 'read' }` e namespace `discovery`. A ferramenta SHALL aparecer no catálogo sem substituir as ferramentas nominais de descoberta e sem exigir navegação do usuário.

#### Scenario: Pergunta de métrica roteada para o tool

- **WHEN** um pedido `read` menciona WIP, bloqueados há mais tempo, atrasos, horas registradas, burnup, aging ou compromisso de sprint
- **THEN** o roteador inclui `get_dashboard_metrics` no conjunto de tools disponível

#### Scenario: Catálogo reflete a nova ferramenta

- **WHEN** o catálogo MCP é gerado (`generate:docs`)
- **THEN** `get_dashboard_metrics` aparece entre as discovery tools registradas, com schema, validação, policy e classificação coerentes

#### Scenario: Capability indisponível não é declarada antes da busca

- **WHEN** a ferramenta existe e o usuário tem permissão de leitura
- **THEN** o sistema a carrega dinamicamente em vez de responder que não há como consultar as métricas
