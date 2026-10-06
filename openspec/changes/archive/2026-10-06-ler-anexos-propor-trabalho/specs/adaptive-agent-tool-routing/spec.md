## ADDED Requirements

### Requirement: Roteamento de leitura de conteúdo de anexo para read_attachment

O roteamento adaptativo SHALL incluir `read_attachment` no conjunto de descoberta/leitura para pedidos que envolvam ler ou interpretar o conteúdo de um anexo, ao lado de `list_attachments`, e SHALL listar a ferramenta no catálogo compartilhado (MCP, README gerado e OpenAPI) com a classificação `{ domain: 'evidence', scope: 'item', operation: 'read' }` e namespace `discovery`. A ferramenta SHALL ser carregável dinamicamente na mesma run, sem exigir nova mensagem do usuário.

#### Scenario: Pedido de leitura de anexo roteado

- **WHEN** um pedido `read` menciona ler, usar ou interpretar o conteúdo de um anexo
- **THEN** o roteador inclui `read_attachment` no conjunto de tools disponível, ao lado de `list_attachments`

#### Scenario: Catálogo reflete a nova ferramenta

- **WHEN** o catálogo MCP é gerado (`generate:docs`)
- **THEN** `read_attachment` aparece entre as discovery tools registradas, com schema, validação, policy e classificação coerentes

#### Scenario: Capability carregada na mesma run

- **WHEN** o agente descobre um anexo com `list_attachments` e precisa do conteúdo
- **THEN** o harness carrega `read_attachment` sem exigir nova mensagem ou mudança de tela
