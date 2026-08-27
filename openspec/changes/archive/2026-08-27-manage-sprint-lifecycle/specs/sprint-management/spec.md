## MODIFIED Requirements

### Requirement: CRUD de sprints
O sistema SHALL permitir criar, editar e encerrar N sprints vinculadas a um projeto, com nome, data de início e data de fim obrigatórios e status entre `PROPOSED`, `OPEN` e `CLOSED`. Uma sprint nova SHALL iniciar como `PROPOSED`.

#### Scenario: Criação de sprint
- **WHEN** Admin cria sprint com nome, data de início e data de fim válidos
- **THEN** sistema registra a sprint vinculada ao projeto com status `PROPOSED`

#### Scenario: Datas inválidas
- **WHEN** usuário tenta criar ou editar sprint sem uma das datas ou com início posterior ao fim
- **THEN** sistema retorna erro de validação e não persiste a alteração

#### Scenario: Edição de sprint
- **WHEN** Admin edita nome ou datas de uma sprint do projeto
- **THEN** sistema valida os campos e atualiza a sprint mantendo seu status válido

#### Scenario: Abertura de sprint
- **WHEN** Admin abre uma sprint `PROPOSED`
- **THEN** sistema muda seu status para `OPEN` e garante que no máximo uma sprint esteja aberta por vez no projeto

#### Scenario: Encerramento de sprint
- **WHEN** Admin encerra uma sprint aberta
- **THEN** sistema muda seu status para `CLOSED` e preserva os cards já associados

#### Scenario: Sprint fechada não reabre
- **WHEN** usuário tenta abrir novamente uma sprint `CLOSED`
- **THEN** sistema retorna erro de transição inválida e mantém o status `CLOSED`

### Requirement: Consulta de sprint ativa por agentes de IA
O sistema SHALL expor endpoint dedicado `GET /projects/{id}/current-sprint` retornando dados da sprint `OPEN` de forma minimalista.

#### Scenario: Sprint aberta encontrada
- **WHEN** agente de IA consulta current-sprint de um projeto com sprint aberta
- **THEN** sistema retorna `{ id, name, startDate, endDate, status: "OPEN" }` em JSON

#### Scenario: Sem sprint aberta
- **WHEN** agente consulta current-sprint e não há sprint `OPEN`
- **THEN** sistema retorna `{ status: "NONE" }` com HTTP 200

### Requirement: Associação de cards a sprints
O sistema SHALL permitir incluir e remover cards de uma sprint `PROPOSED` ou `OPEN`, respeitando projeto e tenant. O sistema SHALL rejeitar qualquer nova associação a sprint `CLOSED`, inclusive durante a criação ou edição de um item.

#### Scenario: Inclusão de card em sprint elegível
- **WHEN** membro adiciona card à sprint `PROPOSED` ou `OPEN`
- **THEN** card é associado à sprint e aparece no filtro de sprint do Board

#### Scenario: Inclusão em sprint fechada
- **WHEN** usuário tenta adicionar ou mover card para sprint `CLOSED`
- **THEN** sistema retorna 409 ou 422 e não cria nem altera a associação

#### Scenario: Criação de task sem sprint
- **WHEN** card é criado sem sprint
- **THEN** card é criado normalmente sem associação a sprint

#### Scenario: Card sem sprint
- **WHEN** card não está associado a nenhuma sprint
- **THEN** card aparece apenas na visão "Todos" do board, não no filtro de sprint

#### Scenario: Listagem de sprints
- **WHEN** usuário autorizado consulta sprints do projeto
- **THEN** sistema retorna sprints `PROPOSED`, `OPEN` e `CLOSED` para permitir consulta histórica
