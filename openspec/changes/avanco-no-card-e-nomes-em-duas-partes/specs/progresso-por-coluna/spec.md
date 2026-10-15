# Spec Delta

## ADDED Requirements

### Requirement: Barra de avanço no card do Kanban

O card do Kanban SHALL exibir o avanço calculado pela regra do peso de coluna — o peso da sua coluna quando não houver checklist e, com checklist, a posição do checklist dentro da faixa delimitada pelo peso da coluna anterior e o peso da própria coluna. O avanço exibido no card SHALL ser o mesmo valor que as lanes, a árvore e o dashboard apresentam para o mesmo item, e a barra SHALL NOT substituir o contador de checklist.

#### Scenario: Card sem checklist usa o peso da coluna

- **WHEN** um card sem checklist está em uma coluna `IN_PROGRESS` cujo peso é 90
- **THEN** a barra do card exibe 90%

#### Scenario: Checklist afina dentro da faixa da coluna

- **WHEN** um card em uma coluna cuja faixa é de 0 a 50 tem metade dos itens de checklist marcados
- **THEN** a barra do card exibe 25%, e o contador de checklist segue visível

#### Scenario: Card e lane mostram o mesmo avanço

- **WHEN** uma lane e um dos seus cards estão na mesma coluna de peso 90
- **THEN** ambos exibem 90%, sem divergência entre card e agrupador
