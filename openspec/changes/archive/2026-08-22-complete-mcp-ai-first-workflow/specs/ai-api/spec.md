## ADDED Requirements

### Requirement: Escopo relacional da API para agentes

A API REST SHALL validar `tenant_id`, `project_id` e identificador da entidade em toda operação relacionada a projetos, items, colunas, sprints, tags, versões, anexos, checklists, logs, módulos, membros e centros de custo. Toda referência entre entidades SHALL pertencer ao mesmo projeto e tenant.

#### Scenario: Item de outro projeto do mesmo tenant
- **WHEN** usuário ou agente informa `projectId` de um projeto e `itemId` pertencente a outro projeto do mesmo tenant
- **THEN** API retorna HTTP 404 e não lê nem modifica o item

#### Scenario: Relação cross-project
- **WHEN** agente tenta criar/atualizar item usando `parentId`, `moduleId`, `columnId`, `sprintId`, `tagId`, `versionId`, `costCenterId` ou `assigneeId` de outro projeto
- **THEN** API retorna erro de validação e não grava a operação

#### Scenario: Mutação sem efeito
- **WHEN** uma atualização ou exclusão não encontra entidade no projeto e tenant informados
- **THEN** API retorna HTTP 404 ou erro de domínio explícito, nunca HTTP 200 falso

### Requirement: API orientada a agentes

A API SHALL oferecer consultas estruturadas para projetos, board, árvore e itens, com filtros completos, paginação limitada e respostas estáveis para consumo por MCP e LLMs, incluindo projetos `SIMPLE` e `HIERARCHICAL`.

#### Scenario: Consulta paginada de itens
- **WHEN** agente solicita itens com filtros de tipo, status, responsável, coluna, pai, módulo, sprint, tag e cursor
- **THEN** API retorna somente itens do projeto autorizado, metadados de paginação e filtros aplicados

#### Scenario: Leitura do board simples
- **WHEN** agente consulta board de projeto `SIMPLE`
- **THEN** API retorna colunas, STORY fixa e cards sem exigir ou inventar módulos/EPICs

#### Scenario: Shadow Markdown seguro
- **WHEN** agente lê ou altera o Shadow Markdown de um projeto
- **THEN** API aplica autenticação, membership, tenant/project scope e valida IDs/colunas antes de modificar cards
