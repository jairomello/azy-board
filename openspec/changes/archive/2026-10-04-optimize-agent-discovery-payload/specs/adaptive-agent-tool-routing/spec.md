# Delta spec — adaptive-agent-tool-routing

## ADDED Requirements

### Requirement: Roteamento de recortes de tela para `get_screen_overview`
O roteamento adaptativo SHALL incluir `get_screen_overview` no conjunto inicial de tools de intenções `read` sobre board/recortes de tela (ao lado de `list_tasks`, `get_board`, `get_tree`, `get_current_sprint`, `list_columns`) e SHALL listar a nova ferramenta no catálogo compartilhado (MCP, README gerado e OpenAPI), com a classificação `{ domain: 'board', scope: 'project', operation: 'read' }`.

#### Scenario: Pergunta de recorte roteada para o digest
- **WHEN** um pedido `read` menciona contagens/recorte de tela ou coluna
- **THEN** o roteador inclui `get_screen_overview` no conjunto disponível

#### Scenario: Catalogo reflete a nova ferramenta
- **WHEN** o catálogo MCP é gerado (`generate:docs`)
- **THEN** `get_screen_overview` aparece entre as discovery tools registradas
