## ADDED Requirements

### Requirement: Exibição do sequenceCode no card do Kanban
O sistema SHALL exibir o `sequenceCode` do item no card do Kanban, substituindo o UUID truncado quando disponível.

#### Scenario: Card com sequenceCode exibe o código
- **WHEN** card possui `sequenceCode` não nulo (ex: "T3")
- **THEN** o código é exibido na área de identificação do card (ao lado do badge de tipo), substituindo o UUID truncado

#### Scenario: Card sem sequenceCode exibe UUID truncado
- **WHEN** card possui `sequenceCode` nulo
- **THEN** o card exibe o UUID truncado (primeiros 8 caracteres) como fallback, mantendo o comportamento atual

#### Scenario: Código atualizado em tempo real
- **WHEN** um item tem seu `sequenceCode` alterado via API
- **THEN** o card no Kanban atualiza o código exibido via WebSocket broadcast
