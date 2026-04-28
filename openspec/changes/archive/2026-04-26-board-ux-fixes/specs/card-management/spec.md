## MODIFIED Requirements

### Requirement: Toggle de visibilidade de subtasks no Kanban
O sistema SHALL oferecer um toggle no board para exibir ou ocultar subtasks com comportamento correto da Leaf Rule.

#### Scenario: Toggle desativado (padrão) — sem subtasks
- **WHEN** toggle "Mostrar subtasks" está desativado (estado padrão)
- **THEN** board exibe apenas tasks do primeiro nível — tasks que NÃO possuem `parentId` — independente de terem filhos ou não; subtasks ficam ocultas

#### Scenario: Toggle ativado — apenas tasks folha (Leaf Rule)
- **WHEN** usuário ativa o toggle "Mostrar subtasks"
- **THEN** board aplica a Leaf Rule e exibe apenas tasks folha (tasks que não são `parentId` de nenhuma outra task carregada); tasks pai com subtasks ficam ocultas e apenas suas folhas aparecem

#### Scenario: Frase de aviso removida dos cards
- **WHEN** qualquer card é exibido no board
- **THEN** a frase "Esta task possui subtasks — mova as subtasks individualmente" NÃO aparece visível ao usuário; o bloqueio de drag em tasks pai é silencioso (cursor not-allowed sem texto)
