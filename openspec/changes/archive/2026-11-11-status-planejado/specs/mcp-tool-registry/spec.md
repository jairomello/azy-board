# Spec Delta

## ADDED Requirements

### Requirement: Catálogo de colunas com status base explícito

O catálogo MCP SHALL declarar `create_column` com `name` e `baseStatus` obrigatórios, sendo `baseStatus` um enum explícito com `NOT_STARTED`, `PLANNED`, `IN_PROGRESS`, `BLOCKED`, `DONE` e `CANCELLED`. A execução SHALL enviar à rota `POST /projects/:projectId/columns` somente `name` e `baseStatus`, nunca o `projectId` no corpo.

#### Scenario: Criar coluna planejada via MCP

- **WHEN** agente chama `create_column` com `name = "Planejado"` e `baseStatus = "PLANNED"`
- **THEN** a coluna é criada e a resposta traz o `baseStatus` aplicado

#### Scenario: Corpo estrito sem projectId

- **WHEN** agente chama `create_column` informando `projectId`
- **THEN** o `projectId` é usado apenas no path da rota e a chamada não é rejeitada por campo desconhecido no corpo

#### Scenario: Enum inválido é rejeitado antes da rede

- **WHEN** agente informa um `baseStatus` fora do enum
- **THEN** o catálogo rejeita a chamada com erro de validação acionável, sem executar a mutation

### Requirement: Status planejado nas ferramentas de item

O catálogo SHALL incluir `PLANNED` nos enums de status de `create_task`, `update_item`, `update_items` e nos filtros de `list_tasks`, e SHALL descrever a transição de sprint como elegível para `NOT_STARTED`, `PLANNED`, `IN_PROGRESS` e `BLOCKED`.

#### Scenario: Criar card com status planejado

- **WHEN** agente chama `create_task` com `status = "PLANNED"`
- **THEN** o card é aceito com o status informado

#### Scenario: Filtrar por planejado

- **WHEN** agente chama `list_tasks` com `status = "PLANNED"`
- **THEN** a resposta traz apenas cards planejados
