## MODIFIED Requirements

### Requirement: Modal completa de edição ao duplo clique no corpo do card
O sistema SHALL abrir uma modal com todos os campos do card ao dar duplo clique em qualquer área do card que não seja o título. A modal SHALL organizar os grupos de campos em accordions, iniciando com a primeira seção aberta e as demais fechadas, sem remover título, descrição rich text (Tiptap), prioridade, responsável, story pai, tags, pontos, data de início ou data de fim.

#### Scenario: Abrir modal completa com accordions
- **WHEN** usuário dá duplo clique no corpo do card (exceto título)
- **THEN** modal abre com todos os campos organizados em seções, primeira seção aberta e controles para expandir/recolher tudo

#### Scenario: Salvar edições pela modal
- **WHEN** usuário altera campos em qualquer seção e clica em "Salvar"
- **THEN** todas as alterações são enviadas via API e o card no board atualiza em tempo real

#### Scenario: Fechar modal sem salvar
- **WHEN** usuário clica em "Cancelar" ou pressiona Escape
- **THEN** modal fecha sem persistir alterações, inclusive alterações feitas em seções recolhidas
