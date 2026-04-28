## ADDED Requirements

### Requirement: Endpoints REST minimalistas para agentes de IA
O sistema SHALL expor endpoints REST com respostas JSON enxutas, sem campos desnecessários, otimizados para consumo por LLMs.

#### Scenario: Listar tasks de um projeto
- **WHEN** agente faz GET `/projects/{id}/tasks`
- **THEN** sistema retorna array com `{ id, title, status, column, assignee, epic, priority }` — sem metadados de paginação desnecessários para projetos pequenos/médios

#### Scenario: Criar task via API
- **WHEN** agente faz POST `/projects/{id}/tasks` com `{ title, columnId?, epicId?, priority? }`
- **THEN** sistema cria a task e retorna o objeto criado

#### Scenario: Mover task para outra coluna
- **WHEN** agente faz PATCH `/projects/{id}/tasks/{taskId}/move` com `{ columnId }`
- **THEN** sistema move o card, atualiza status base e retorna o objeto atualizado

#### Scenario: Fazer claim de task
- **WHEN** agente faz PATCH `/projects/{id}/tasks/{taskId}/claim`
- **THEN** sistema atribui a task ao agente (identificado pela API Key) e retorna o objeto atualizado

---

### Requirement: Shadow Markdown — leitura do board
O sistema SHALL expor `GET /projects/{id}/board.md` retornando o estado atual do board formatado em Markdown, legível por qualquer LLM sem necessidade de parsing de JSON.

#### Scenario: Leitura do board em Markdown
- **WHEN** agente faz GET `/projects/{id}/board.md`
- **THEN** sistema retorna texto Markdown com estrutura:
  ```
  # {Nome do Projeto} — Sprint: {Nome da Sprint ou "Sem sprint ativa"}
  ## {Nome da Coluna}
  - [ ] #{id}: {título} @{responsável ou "unassigned"} [{prioridade}]
  - [/] #{id}: {título} @{responsável} [{prioridade}]  ← em progresso
  - [x] #{id}: {título} @{responsável}  ← concluído
  ```

---

### Requirement: Shadow Markdown — escrita por diff
O sistema SHALL aceitar `PATCH /projects/{id}/board.md` com o markdown editado completo e processar as diferenças para mover, atribuir ou atualizar cards no banco.

#### Scenario: Agente move card editando markdown
- **WHEN** agente envia PATCH com card `#102` que foi movido de "## To Do" para "## In Progress" no markdown
- **THEN** sistema detecta a mudança de seção e move o card para a coluna correspondente no banco, propagando via WebSocket

#### Scenario: Card identificado por ID no markdown
- **WHEN** markdown contém `#{id}: {título}` e o título foi editado mas o ID permanece
- **THEN** sistema usa o ID como âncora para identificar o card, não o título

#### Scenario: Markdown inválido ou inconsistente
- **WHEN** agente envia markdown com card em coluna inexistente
- **THEN** sistema retorna erro 422 com lista de inconsistências encontradas

---

### Requirement: Autenticação por API Key para agentes
O sistema SHALL autenticar agentes de IA via header `Authorization: Bearer {api_key}`. A API Key MUST ser vinculada a um usuário humano Owner.

#### Scenario: Requisição com API Key válida
- **WHEN** agente envia requisição com API Key válida
- **THEN** sistema identifica o agente e seu Owner humano, e aplica as permissões do Owner no projeto

#### Scenario: API Key inválida ou expirada
- **WHEN** agente envia API Key inválida
- **THEN** sistema retorna 401
