## MODIFIED Requirements

### Requirement: Breadcrumb dinâmico exibido no card
O sistema SHALL exibir em cada card o caminho hierárquico completo acima do título, entre a linha de topo e o título: `Projeto > Módulo > Épico > Story > Task Pai > ... > Task Atual`.

#### Scenario: Breadcrumb truncado por espaço
- **WHEN** breadcrumb completo ultrapassa o espaço disponível no card
- **THEN** caminho é exibido truncado com reticências no meio (ex: `Projeto > Módulo > ... > Task Atual`)

#### Scenario: Hover expande breadcrumb completo
- **WHEN** usuário passa o mouse sobre o breadcrumb truncado
- **THEN** tooltip ou popover exibe o caminho completo com links clicáveis para cada nível

### Requirement: Exibição do sequenceCode no card do Kanban
O sistema SHALL exibir o `sequenceCode` do item no card do Kanban, na linha de topo ao lado do ícone do item. Quando o item não possuir `sequenceCode`, o sistema SHALL NOT exibir conteúdo substituto (como UUID truncado), mantendo o alinhamento da linha de topo.

#### Scenario: Card com sequenceCode exibe o código
- **WHEN** card possui `sequenceCode` não nulo (ex: "T3")
- **THEN** o código é exibido na linha de topo, ao lado do ícone do item, sem exibir UUID truncado

#### Scenario: Card sem sequenceCode não exibe conteúdo substituto
- **WHEN** card possui `sequenceCode` nulo
- **THEN** o card não exibe UUID truncado nem marcador no lugar do código, e o alinhamento do topo é preservado

#### Scenario: Código atualizado em tempo real
- **WHEN** um item tem seu `sequenceCode` alterado via API
- **THEN** o card no Kanban atualiza o código exibido via WebSocket broadcast
