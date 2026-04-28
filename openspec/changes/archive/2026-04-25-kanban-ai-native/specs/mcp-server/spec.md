## ADDED Requirements

### Requirement: Servidor MCP nativo com ferramentas de board
O sistema SHALL disponibilizar um servidor MCP (Model Context Protocol) expondo ferramentas para que agentes de IA interajam com o board sem necessidade de código adicional.

#### Scenario: Listar tasks disponíveis
- **WHEN** agente invoca ferramenta `list_tasks` com `{ projectId, sprintId? }`
- **THEN** servidor retorna lista de tasks com status, coluna, responsável e prioridade

#### Scenario: Verificar sprint atual
- **WHEN** agente invoca ferramenta `get_current_sprint` com `{ projectId }`
- **THEN** servidor retorna dados da sprint ativa ou informa que não há sprint ativa

---

### Requirement: Ferramenta claim_task no MCP
O sistema SHALL expor ferramenta `claim_task` que atribui uma task ao agente e a move para status IN_PROGRESS.

#### Scenario: Claim bem-sucedido
- **WHEN** agente invoca `claim_task` com `{ projectId, taskId }`
- **THEN** task é atribuída ao agente (vinculado ao Owner humano da API Key), status muda para IN_PROGRESS

#### Scenario: Task já reclamada
- **WHEN** agente tenta claim de task já atribuída
- **THEN** servidor retorna erro descritivo indicando quem está com a task

---

### Requirement: Ferramenta move_task no MCP
O sistema SHALL expor ferramenta `move_task` para mover cards entre colunas.

#### Scenario: Mover card para coluna destino
- **WHEN** agente invoca `move_task` com `{ projectId, taskId, columnName }` usando nome da coluna (não ID)
- **THEN** servidor resolve o ID da coluna pelo nome e move o card, atualizando status base automaticamente

---

### Requirement: Ferramenta complete_task no MCP
O sistema SHALL expor ferramenta `complete_task` que marca uma task como DONE e a move para a coluna de conclusão.

#### Scenario: Concluir task
- **WHEN** agente invoca `complete_task` com `{ projectId, taskId }`
- **THEN** task recebe status DONE e é movida para a coluna mapeada como DONE no projeto

---

### Requirement: Ferramenta create_task no MCP
O sistema SHALL expor ferramenta `create_task` para criação de novas tasks a partir de agentes.

#### Scenario: Criação de task via MCP
- **WHEN** agente invoca `create_task` com `{ projectId, title, description?, priority?, epicId? }`
- **THEN** sistema cria a task na primeira coluna do board e retorna o objeto criado com o ID gerado

---

### Requirement: Transporte e autenticação do MCP
O servidor MCP SHALL usar transporte stdio e autenticar via API Key passada como variável de ambiente `EASYBOARD_API_KEY`.

#### Scenario: Configuração do MCP em agente de IA
- **WHEN** agente configura o servidor MCP com `EASYBOARD_API_KEY` e URL do backend
- **THEN** todas as ferramentas operam autenticadas com as permissões do Owner humano da API Key
