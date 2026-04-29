## ADDED Requirements

### Requirement: Servidor MCP nativo com ferramentas de board
O sistema SHALL disponibilizar um servidor MCP (Model Context Protocol) expondo ferramentas para que agentes de IA interajam com o board sem necessidade de código adicional.

#### Scenario: Listar tasks disponíveis
- **WHEN** agente invoca ferramenta `list_tasks` com `{ projectId, sprintId?, type?, onlyLeaves? }`
- **THEN** servidor retorna lista de items filtrados; `type` aceita EPIC, STORY, TASK, BUG ou combinações separadas por vírgula; `onlyLeaves=true` (padrão) retorna apenas items sem filhos

#### Scenario: Navegar hierarquia antes de criar items
- **WHEN** agente precisa criar uma STORY ou TASK e não possui os IDs dos ancestrais
- **THEN** agente usa `list_tasks` com `type=EPIC` ou `type=STORY` e `onlyLeaves=false` para obter IDs sem precisar saber a hierarquia de memória

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

### Requirement: Ferramenta list_modules no MCP
O sistema SHALL expor ferramenta `list_modules` que lista os módulos de um projeto, fornecendo `id` e `name` de cada módulo.

#### Scenario: Agente obtém moduleId antes de criar EPIC
- **WHEN** agente invoca `list_modules` com `{ projectId }`
- **THEN** servidor retorna array `[{ id, name, position }]` com todos os módulos do projeto em ordem

---

### Requirement: Ferramenta move_task no MCP
O sistema SHALL expor ferramenta `move_task` para mover cards entre colunas.

#### Scenario: Mover card para coluna destino
- **WHEN** agente invoca `move_task` com `{ projectId, taskId, columnName }` usando nome da coluna (não ID)
- **THEN** servidor resolve o ID da coluna pelo nome e move o card, atualizando status base automaticamente

#### Scenario: Coluna não encontrada
- **WHEN** agente invoca `move_task` com nome de coluna inexistente
- **THEN** servidor retorna erro listando os nomes exatos das colunas disponíveis no projeto

---

### Requirement: Ferramenta complete_task no MCP
O sistema SHALL expor ferramenta `complete_task` que marca uma task como DONE e a move para a coluna de conclusão.

#### Scenario: Concluir task
- **WHEN** agente invoca `complete_task` com `{ projectId, taskId }`
- **THEN** task recebe status DONE e é movida para a coluna mapeada como DONE no projeto

---

### Requirement: Ferramenta create_task no MCP
O sistema SHALL expor ferramenta `create_task` para criação de items respeitando a hierarquia obrigatória EPIC → STORY → TASK/BUG.

#### Scenario: Criação de TASK órfã
- **WHEN** agente invoca `create_task` com `{ projectId, title }` sem `parentId`
- **THEN** sistema cria TASK na primeira coluna do board e retorna o objeto criado com o ID gerado

#### Scenario: Criação respeitando hierarquia completa
- **WHEN** agente cria EPIC (com `moduleId`), depois STORY (com `parentId=epicId`), depois TASK (com `parentId=storyId`)
- **THEN** cada item é criado com vínculo correto e aparece no board dentro da swimlane do EPIC

#### Scenario: Resolução automática de moduleId para EPIC
- **WHEN** agente cria EPIC sem informar `moduleId`
- **THEN** servidor busca automaticamente o primeiro módulo do projeto e o atribui ao EPIC

#### Scenario: Violação de hierarquia — TASK filho de EPIC
- **WHEN** agente invoca `create_task` com `type=TASK` e `parentId` apontando para item do tipo EPIC
- **THEN** servidor detecta a violação antes de chamar a API e retorna erro acionável informando o fluxo correto: criar STORY filho do EPIC e usar o ID da STORY como `parentId` da TASK

#### Scenario: Violação de hierarquia — STORY sem pai EPIC
- **WHEN** agente invoca `create_task` com `type=STORY` e `parentId` apontando para item não-EPIC
- **THEN** servidor retorna erro indicando que STORY deve ser filha de EPIC e orienta a usar `list_tasks(type=EPIC)` para obter os IDs disponíveis

#### Scenario: Decisão de granularidade pelo agente
- **WHEN** agente avalia se deve criar subtarefa (TASK filha) ou checklist em card existente
- **THEN** agente considera: subtarefa quando o trabalho é substancial (>30 min), paralelizável ou rastreável individualmente no Kanban; checklist quando os passos são fases sequenciais de uma mesma unidade de trabalho; nenhum registro quando o passo é trivial (<5 min) e não agrega valor ao observador do board

---

### Requirement: Transporte e autenticação do MCP
O servidor MCP SHALL usar transporte stdio e autenticar via API Key passada como variável de ambiente `EASYBOARD_API_KEY`.

#### Scenario: Configuração do MCP em agente de IA
- **WHEN** agente configura o servidor MCP com `EASYBOARD_API_KEY` e URL do backend
- **THEN** todas as ferramentas operam autenticadas com as permissões do Owner humano da API Key

---

### Requirement: Ferramenta MCP list_checklists
O sistema SHALL expor ferramenta `list_checklists` que retorna todos os checklists de um card com seus itens e progresso.

#### Scenario: Agente lista checklists de um card
- **WHEN** agente invoca `list_checklists` com `{ projectId, itemId }`
- **THEN** servidor retorna array de checklists com `[{ id, name, items: [{ id, text, checked }], progress: { checked, total } }]`

#### Scenario: Card sem checklists
- **WHEN** agente invoca `list_checklists` para card sem checklists
- **THEN** servidor retorna array vazio `[]`

---

### Requirement: Ferramenta MCP create_checklist
O sistema SHALL expor ferramenta `create_checklist` para que agentes criem um checklist nomeado em um card.

#### Scenario: Agente cria checklist antes de iniciar execução
- **WHEN** agente invoca `create_checklist` com `{ projectId, itemId, name: "Plano de execução" }`
- **THEN** sistema cria o checklist e retorna `{ id, name }` para uso nas chamadas subsequentes de `add_checklist_item`

---

### Requirement: Ferramenta MCP add_checklist_item
O sistema SHALL expor ferramenta `add_checklist_item` para adicionar itens a um checklist existente.

#### Scenario: Agente adiciona passo ao plano
- **WHEN** agente invoca `add_checklist_item` com `{ projectId, itemId, checklistId, text: "Analisar requisitos" }`
- **THEN** sistema cria o item com `checked: false` e retorna `{ id, text, checked, position }`

---

### Requirement: Ferramenta MCP check_item
O sistema SHALL expor ferramenta `check_item` para marcar um item de checklist como concluído ou não-concluído.

#### Scenario: Agente marca passo como concluído
- **WHEN** agente invoca `check_item` com `{ projectId, itemId, checklistId, checklistItemId, checked: true }`
- **THEN** sistema atualiza `checked` e emite evento WebSocket `CHECKLIST_UPDATED`; humanos acompanhando o board veem o progresso atualizar em tempo real
