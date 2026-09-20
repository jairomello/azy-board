## ADDED Requirements

### Requirement: Campos avançados opcionais nas ferramentas MCP de checklist

As ferramentas MCP de checklist SHALL aceitar e retornar, como campos opcionais, `dueDate`, `assigneeId` e `description` quando o projeto estiver com `advancedChecklists = true`, respeitando o mesmo gate da API. A ferramenta `update_checklist_item` SHALL usar um schema de alteração próprio de item de checklist (e não o schema genérico de item), com limites e descrições semânticas documentados no catálogo. As ferramentas SHALL continuar válidas e inalteradas no comportamento quando a opção do projeto estiver desligada.

#### Scenario: Agente adiciona item com campos avançados
- **WHEN** agente invoca `add_checklist_item` (ou `add_checklist_item_to_task`) com `{ projectId, itemId, checklistId, text, dueDate?, assigneeId?, description? }` em projeto com a opção ligada
- **THEN** o servidor repassa os campos à API e retorna o item criado com os campos avançados

#### Scenario: Agente atualiza campo avançado
- **WHEN** agente invoca `update_checklist_item` com um `changes` contendo `dueDate`, `assigneeId` ou `description`
- **THEN** o servidor aceita as alterações usando o schema de item de checklist e retorna o item atualizado

#### Scenario: Agente lista checklists detalhados
- **WHEN** agente invoca `list_checklists` em projeto com a opção ligada
- **THEN** o servidor retorna os itens com os campos avançados presentes (ou `null` quando vazios)

#### Scenario: Projeto no modo simples
- **WHEN** agente tenta enviar campos avançados em projeto com `advancedChecklists = false`
- **THEN** o servidor retorna erro de validação claro e não altera o item

#### Scenario: Catálogo e limites em sincronia
- **WHEN** `bun run test:mcp-catalog` é executado após a mudança
- **THEN** todas as ferramentas de checklist permanecem documentadas no README, com schema completo, `case` no dispatcher e limites de texto coerentes
