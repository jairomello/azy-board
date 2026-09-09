## ADDED Requirements

### Requirement: Metadados adaptativos no registry compartilhado
O registry usado pelo MCP e Azy Agent SHALL fornecer domínio, escopo, operação, risco, dependencies, tipos de alvo e policy para cada tool, preservando nomes e schemas públicos.

#### Scenario: Busca por domínio
- **WHEN** o resolver procura capability Projects, Items ou Evidence
- **THEN** o registry retorna definições nominais compatíveis e dependency tools declaradas

#### Scenario: MCP externo
- **WHEN** cliente MCP autenticado solicita `tools/list`
- **THEN** continua recebendo o catálogo público permitido sem restrição baseada na tela do produto

### Requirement: Paridade schema-validator-executor
O catálogo SHALL falhar em teste quando metadata, campos obrigatórios, nullable, filtros, validator, policy ou dispatcher divergirem.

#### Scenario: Attachment exige item
- **WHEN** `list_attachments` é validada
- **THEN** schema e validator concordam sobre `itemId`

#### Scenario: Filtros de listagem
- **WHEN** `list_tasks` ou `get_tree` suporta um filtro no executor
- **THEN** o schema estrito e validator representam o mesmo filtro

#### Scenario: Datas de sprint
- **WHEN** `create_sprint` exige datas na execução
- **THEN** schema e validator representam a mesma obrigatoriedade
