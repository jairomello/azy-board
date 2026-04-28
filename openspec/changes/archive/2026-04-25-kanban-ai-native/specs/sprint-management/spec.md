## ADDED Requirements

### Requirement: CRUD de sprints
O sistema SHALL permitir criar, editar e encerrar sprints vinculadas a um projeto, com nome, data de início e data de fim.

#### Scenario: Criação de sprint
- **WHEN** admin cria sprint com nome, data início e data fim
- **THEN** sistema registra a sprint vinculada ao projeto com status PLANNED

#### Scenario: Ativação de sprint
- **WHEN** admin ativa uma sprint
- **THEN** sistema marca a sprint como ACTIVE e garante que apenas uma sprint esteja ativa por vez no projeto

#### Scenario: Encerramento de sprint
- **WHEN** admin encerra a sprint ativa
- **THEN** sistema marca sprint como DONE e cards não concluídos ficam disponíveis para inclusão na próxima sprint

---

### Requirement: Consulta de sprint ativa por agentes de IA
O sistema SHALL expor endpoint dedicado `GET /projects/{id}/current-sprint` retornando dados da sprint ativa de forma minimalista.

#### Scenario: Sprint ativa encontrada
- **WHEN** agente de IA consulta current-sprint de um projeto com sprint ativa
- **THEN** sistema retorna `{ id, name, startDate, endDate, status: "ACTIVE" }` em JSON

#### Scenario: Sem sprint ativa
- **WHEN** agente consulta current-sprint e não há sprint ativa
- **THEN** sistema retorna `{ status: "NONE" }` com HTTP 200

---

### Requirement: Associação de cards a sprints
O sistema SHALL permitir incluir e remover cards de uma sprint.

#### Scenario: Inclusão de card em sprint
- **WHEN** membro adiciona card à sprint ativa
- **THEN** card é associado à sprint e aparece no filtro de sprint ativa do board

#### Scenario: Card sem sprint
- **WHEN** card não está associado a nenhuma sprint
- **THEN** card aparece apenas na visão "Todos" do board, não no filtro de sprint
