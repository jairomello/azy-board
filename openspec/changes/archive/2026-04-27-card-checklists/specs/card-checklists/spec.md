## ADDED Requirements

### Requirement: Múltiplos checklists nomeados por card
O sistema SHALL permitir que qualquer card (independente do `type`) tenha zero ou mais checklists. Cada checklist SHALL ter um nome obrigatório e uma posição para ordenação. Os checklists de um card SHALL ser retornados em ordem de `position` pelo endpoint de detalhe do card.

#### Scenario: Criar checklist em um card
- **WHEN** usuário ou agente envia `POST /projects/:id/items/:itemId/checklists` com `{ name: "Passos de execução" }`
- **THEN** sistema cria o checklist com `id` gerado, `position` = último + 1, e retorna `201` com o checklist criado

#### Scenario: Listar checklists de um card
- **WHEN** cliente envia `GET /projects/:id/items/:itemId` (detalhe do card)
- **THEN** resposta inclui campo `checklists: [{ id, name, position, items: [{ id, text, checked, position }] }]` ordenados por `position`

#### Scenario: Renomear checklist
- **WHEN** usuário ou agente envia `PATCH /projects/:id/items/:itemId/checklists/:checklistId` com `{ name: "Novo nome" }`
- **THEN** sistema atualiza o nome e retorna o checklist atualizado

#### Scenario: Deletar checklist apaga todos os seus itens
- **WHEN** usuário envia `DELETE /projects/:id/items/:itemId/checklists/:checklistId`
- **THEN** sistema deleta o checklist e todos os seus `checklist_items` em cascade, retorna `204`

### Requirement: Itens de checklist com estado checked/unchecked
Cada checklist SHALL ter zero ou mais itens. Cada item SHALL ter `text` (obrigatório), `checked` (boolean, padrão `false`) e `position` para ordenação.

#### Scenario: Adicionar item ao checklist
- **WHEN** usuário ou agente envia `POST /projects/:id/items/:itemId/checklists/:checklistId/items` com `{ text: "Rodar testes" }`
- **THEN** sistema cria o item com `checked: false`, `position` = último + 1, retorna `201`

#### Scenario: Marcar item como concluído
- **WHEN** usuário ou agente envia `PATCH /projects/:id/items/:itemId/checklists/:checklistId/items/:itemId` com `{ checked: true }`
- **THEN** sistema atualiza `checked` e retorna o item atualizado; evento WebSocket `CHECKLIST_UPDATED` é emitido

#### Scenario: Deletar item do checklist
- **WHEN** usuário envia `DELETE /projects/:id/items/:itemId/checklists/:checklistId/items/:checklistItemId`
- **THEN** sistema remove o item e retorna `204`

### Requirement: Isolamento multi-tenant nos checklists
Todas as operações de checklist SHALL incluir `tenantId` como filtro obrigatório via join com a tabela `items`.

#### Scenario: Tentativa de acesso cross-tenant
- **WHEN** agente autenticado como tenant A tenta acessar checklist de card pertencente ao tenant B
- **THEN** sistema retorna `404` (item não encontrado para o tenant) sem expor dados do outro tenant

### Requirement: Progresso agregado no payload do board
O endpoint `GET /projects/:id/items` SHALL incluir campo `checklistProgress: { checked: number; total: number } | null` para cada item. O campo SHALL ser `null` quando o item não possui nenhum checklist.

#### Scenario: Card com checklists no board
- **WHEN** board é carregado via `GET /projects/:id/items`
- **THEN** cada item com ao menos um checklist retorna `checklistProgress: { checked: 3, total: 7 }` calculado pela soma de todos os itens de todos os checklists do card

#### Scenario: Card sem checklists no board
- **WHEN** card não possui nenhum checklist
- **THEN** `checklistProgress` é `null` na resposta do board
