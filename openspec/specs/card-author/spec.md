## ADDED Requirements

### Requirement: Campo autor persistido na criação do card
O sistema SHALL registrar automaticamente o `author_id` (usuário que criou a task) no momento da criação, distinto do campo `assignee_id` (responsável atual). O campo é somente leitura após a criação.

#### Scenario: Criação de card por usuário humano
- **WHEN** membro autenticado cria uma nova task via API `POST /projects/:id/tasks`
- **THEN** `author_id` é preenchido com o `userId` extraído do JWT e persistido na tabela `tasks`

#### Scenario: Criação de card por agente de IA
- **WHEN** agente autenticado via API Key cria uma task
- **THEN** `author_id` é preenchido com o `agentId` resolvido pelo middleware de autenticação

#### Scenario: Tasks existentes sem autor
- **WHEN** task foi criada antes desta feature (migration retroativa)
- **THEN** `author_id` é `null` e a interface exibe "Autor desconhecido"

---

### Requirement: Exibição do autor na modal do card
O sistema SHALL exibir o campo "Autor" na `CardModal` como informação somente leitura, distinta do campo "Responsável".

#### Scenario: Exibição quando autor é conhecido
- **WHEN** `CardModal` é aberta para task com `author_id` preenchido
- **THEN** campo "Autor" exibe avatar + nome do usuário criador, sem controles de edição

#### Scenario: Exibição quando autor é desconhecido
- **WHEN** `CardModal` é aberta para task com `author_id = null`
- **THEN** campo "Autor" exibe "—" ou "Desconhecido" sem avatar

#### Scenario: Autor diferente do responsável
- **WHEN** `CardModal` exibe task onde `author_id !== assignee_id`
- **THEN** ambos os campos são exibidos separadamente: "Autor" e "Responsável" com seus respectivos usuários

#### Scenario: Autor igual ao responsável atual
- **WHEN** `CardModal` exibe task onde `author_id === assignee_id`
- **THEN** ambos os campos são exibidos normalmente (sem fusão visual), pois são conceitos distintos

---

### Requirement: Autor retornado nos endpoints de tasks
O sistema SHALL incluir `author` (objeto com `id`, `name`, `avatarUrl`) nas respostas dos endpoints de leitura de tasks.

#### Scenario: GET task única retorna autor
- **WHEN** `GET /projects/:projectId/tasks/:taskId` é chamado
- **THEN** resposta inclui campo `author: { id, name, avatarUrl }` ou `author: null` para tasks sem autor registrado

#### Scenario: GET lista de tasks retorna autor
- **WHEN** `GET /projects/:projectId/tasks` é chamado
- **THEN** cada task na lista inclui `author` com os mesmos campos acima
