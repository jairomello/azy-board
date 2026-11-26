# Spec Delta

## MODIFIED Requirements

### Requirement: Cálculo do avanço de um card

O sistema SHALL calcular o avanço de um card a partir do **status** do card, que define a faixa, refinada pela coluna compatível e pelo peso explícito configurado na coluna (requisito "Status define a faixa de avanço"). O checklist SHALL NOT influenciar o percentual de avanço em nenhum cálculo. Agrupadores SHALL apresentar a média do avanço de todas as folhas válidas abaixo deles (folhas não canceladas e não arquivadas), o que equivale à média das filhas ponderada pelo número de itens; agrupador sem folhas SHALL apresentar 0%.

#### Scenario: Card sem checklist usa o peso da coluna

- **WHEN** um card está em "A Testar", cujo peso é 90
- **THEN** seu avanço é 90%

#### Scenario: Checklist afina dentro da faixa da coluna

- **WHEN** um card em "Fazendo" (faixa de 0 a 50) tem 5 de 10 itens de checklist marcados
- **THEN** seu progresso continua 50%, e o percentual do checklist aparece apenas na barra própria de checklist

#### Scenario: Marcar itens nunca reduz o avanço

- **WHEN** um card passa a ter um checklist com nenhum item marcado
- **THEN** seu progresso permanece o mesmo que o card sem checklist teria naquela coluna

#### Scenario: Checklist completo não eleva a faixa

- **WHEN** um card em "Fazendo" tem todos os itens de checklist marcados
- **THEN** seu avanço continua 50%, e não sobe para o peso da próxima coluna

#### Scenario: Agrupador calcula a média das folhas

- **WHEN** uma história tem três folhas com avanço 90%, 90% e 0%
- **THEN** a história apresenta 60%

#### Scenario: Agrupador sem folhas

- **WHEN** um item agrupador não possui folha `TASK`/`BUG` descendente
- **THEN** seu avanço é 0%, sem erro

### Requirement: Barra de avanço no card do Kanban

O card do Kanban SHALL exibir o avanço calculado pela regra por status (requisito "Status define a faixa de avanço") — o peso da coluna compatível, ajustado pelo peso explícito configurado, sem considerar checklist. Card cancelado ou arquivado SHALL NOT exibir avanço. O avanço exibido no card SHALL ser o mesmo valor que as lanes, a árvore e o dashboard apresentam para o mesmo item, e a barra SHALL NOT substituir o contador de checklist nem as barras secundárias de checklist e subtasks definidas em `kanban-card-layout`.

#### Scenario: Card sem checklist usa o peso da coluna

- **WHEN** um card sem checklist está em uma coluna `IN_PROGRESS` cujo peso é 90
- **THEN** a barra do card exibe 90%

#### Scenario: Checklist afina dentro da faixa da coluna

- **WHEN** um card em uma coluna cuja faixa é de 0 a 50 tem metade dos itens de checklist marcados
- **THEN** a barra principal exibe 50%, o contador de checklist segue visível e a barra de checklist mostra o progresso real do checklist

#### Scenario: Card e lane mostram o mesmo avanço

- **WHEN** uma lane e um dos seus cards estão na mesma coluna de peso 90
- **THEN** ambos exibem 90%, sem divergência entre card e agrupador

#### Scenario: Status manda quando a coluna não combina

- **WHEN** um card com status `IN_HOMOLOGATION` está na coluna Backlog, num projeto cuja coluna de homologação vale 90
- **THEN** a barra do card exibe 90%, e não 0%

#### Scenario: Card cancelado sem avanço

- **WHEN** um card tem status `CANCELLED`
- **THEN** o card não exibe a barra de avanço

#### Scenario: Card com checklist exibe barra própria

- **WHEN** um card tem checklist com itens e progresso 50%
- **THEN** a barra principal exibe 50% e a barra de checklist exibe a razão marcados/total, em estilo distinto
