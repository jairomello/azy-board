## ADDED Requirements

### Requirement: Seção de checklists na modal do card
O sistema SHALL exibir uma seção "Checklists" na `ItemModal` (e nas demais modais de card) após carregar o detalhe do item. A seção SHALL permitir criar novos checklists, adicionar/remover/editar itens e marcar itens como concluídos.

#### Scenario: Criar novo checklist na modal
- **WHEN** usuário clica em "+ Novo checklist" e confirma o nome
- **THEN** sistema cria o checklist via API e exibe a lista vazia com campo de adição de item

#### Scenario: Adicionar item ao checklist
- **WHEN** usuário digita o texto do item no campo e pressiona Enter ou clica em "+"
- **THEN** item é criado via API e aparece imediatamente na lista com checkbox desmarcado

#### Scenario: Marcar item como concluído
- **WHEN** usuário clica na checkbox de um item
- **THEN** estado `checked` alterna via API e o item é exibido com texto riscado e checkbox marcado; barra de progresso do checklist atualiza imediatamente

#### Scenario: Excluir item do checklist
- **WHEN** usuário clica no ícone de lixeira do item
- **THEN** item é removido via API e desaparece da lista; barra de progresso atualiza

#### Scenario: Excluir checklist inteiro
- **WHEN** usuário clica em "..." → "Excluir checklist"
- **THEN** checklist e todos os seus itens são removidos via API; seção desaparece da modal

#### Scenario: Barra de progresso por checklist
- **WHEN** checklist tem ao menos um item
- **THEN** modal exibe barra de progresso e texto `X/Y concluídos` no header do checklist; barra fica verde quando `X === Y`

### Requirement: Indicador de progresso de checklist no KanbanCard
O sistema SHALL exibir um indicador compacto de progresso de checklists no rodapé do `KanbanCard` quando o card possui ao menos um checklist com ao menos um item.

#### Scenario: Card com checklists no board
- **WHEN** card possui checklists e é exibido no board
- **THEN** rodapé exibe ícone de checklist + texto `checked/total` (ex: `✓ 3/7`); barra de progresso pequena abaixo do texto

#### Scenario: Card sem checklists no board
- **WHEN** card não possui nenhum checklist
- **THEN** nenhum indicador de checklist é exibido no rodapé do card
