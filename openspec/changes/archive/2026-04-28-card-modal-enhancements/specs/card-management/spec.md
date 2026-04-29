## ADDED Requirements

### Requirement: Persistência do autor na criação de tasks
O sistema SHALL capturar e persistir o `author_id` no momento da criação de qualquer task, utilizando o identificador do usuário ou agente autenticado extraído do middleware.

#### Scenario: author_id preenchido automaticamente na criação
- **WHEN** `POST /projects/:id/tasks` é chamado com payload válido
- **THEN** backend preenche `author_id` com o `userId` do JWT (ou `agentId` da API Key) antes de inserir no banco, sem exigir o campo no body da requisição

#### Scenario: author_id não pode ser alterado via PATCH
- **WHEN** `PATCH /projects/:projectId/tasks/:taskId` inclui `author_id` no body
- **THEN** campo `author_id` é silenciosamente ignorado na atualização (não retorna erro, mas não altera o valor)

---

### Requirement: Geração de log automático ao atualizar task
O sistema SHALL gerar um log automático sempre que campos relevantes de uma task forem alterados via API.

#### Scenario: Log automático gerado em PATCH de task
- **WHEN** `PATCH /projects/:projectId/tasks/:taskId` altera título, descrição, prioridade, responsável, tags, pontos ou datas
- **THEN** registro em `task_logs` é criado com `type = 'auto'`, `author_id` do solicitante, `activity` descrevendo mudanças (campos alterados com valor anterior → novo)

#### Scenario: PATCH sem alteração real não gera log
- **WHEN** `PATCH` é chamado com payload idêntico ao estado atual da task
- **THEN** nenhum log é gerado

---

### Requirement: Geração de log automático ao mover task de coluna
O sistema SHALL gerar um log automático quando uma task é movida para outra coluna, seja via drag-and-drop ou API direta.

#### Scenario: Log de movimentação gerado
- **WHEN** status/coluna de uma task é alterado (via `PATCH` ou endpoint de movimentação)
- **THEN** log automático é criado com `activity = "Movido de '[Nome Coluna Origem]' para '[Nome Coluna Destino]'"`
