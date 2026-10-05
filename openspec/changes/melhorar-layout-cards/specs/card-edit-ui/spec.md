## MODIFIED Requirements

### Requirement: Indicador de progresso de checklist no KanbanCard
O sistema SHALL exibir um indicador compacto de progresso de checklists no `KanbanCard` quando o card possui ao menos um checklist com ao menos um item. O indicador SHALL ocupar região própria entre a linha de etiquetas e o rodapé.

#### Scenario: Card com checklists no board
- **WHEN** card possui checklists e é exibido no board
- **THEN** região própria entre etiquetas e rodapé exibe ícone de checklist + texto `checked/total` (ex: `✓ 3/7`); barra de progresso pequena abaixo do texto

#### Scenario: Card sem checklists no board
- **WHEN** card não possui nenhum checklist
- **THEN** nenhuma região de indicador de checklist é renderizada e o rodapé sucede diretamente as etiquetas
