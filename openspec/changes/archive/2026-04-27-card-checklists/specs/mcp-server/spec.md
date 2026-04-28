## ADDED Requirements

### Requirement: Ferramenta MCP list_checklists
O sistema SHALL expor ferramenta `list_checklists` que retorna todos os checklists de um card com seus itens e progresso.

#### Scenario: Agente lista checklists de um card
- **WHEN** agente invoca `list_checklists` com `{ projectId, itemId }`
- **THEN** servidor retorna array de checklists com `[{ id, name, items: [{ id, text, checked }], progress: { checked, total } }]`

#### Scenario: Card sem checklists
- **WHEN** agente invoca `list_checklists` para card sem checklists
- **THEN** servidor retorna array vazio `[]`

### Requirement: Ferramenta MCP create_checklist
O sistema SHALL expor ferramenta `create_checklist` para que agentes criem um checklist nomeado em um card.

#### Scenario: Agente cria checklist antes de iniciar execução
- **WHEN** agente invoca `create_checklist` com `{ projectId, itemId, name: "Plano de execução" }`
- **THEN** sistema cria o checklist e retorna `{ id, name }` para uso nas chamadas subsequentes de `add_checklist_item`

### Requirement: Ferramenta MCP add_checklist_item
O sistema SHALL expor ferramenta `add_checklist_item` para adicionar itens a um checklist existente.

#### Scenario: Agente adiciona passo ao plano
- **WHEN** agente invoca `add_checklist_item` com `{ projectId, itemId, checklistId, text: "Analisar requisitos" }`
- **THEN** sistema cria o item com `checked: false` e retorna `{ id, text, checked, position }`

### Requirement: Ferramenta MCP check_item
O sistema SHALL expor ferramenta `check_item` para marcar um item de checklist como concluído ou não-concluído.

#### Scenario: Agente marca passo como concluído
- **WHEN** agente invoca `check_item` com `{ projectId, itemId, checklistId, checklistItemId, checked: true }`
- **THEN** sistema atualiza `checked` e emite evento WebSocket `CHECKLIST_UPDATED`; humanos acompanhando o board veem o progresso atualizar em tempo real
