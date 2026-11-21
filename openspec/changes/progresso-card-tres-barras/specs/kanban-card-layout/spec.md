# Spec Delta

## MODIFIED Requirements

### Requirement: Região de avanço entre etiquetas e rodapé

O sistema SHALL exibir entre tags/tipo e rodapé uma região de progresso composta por até três barras, nesta ordem: progresso do card, progresso do checklist e avanço das subtasks. A barra principal SHALL aparecer sempre que o avanço for maior que zero, com rótulo acessível de avanço no fluxo e indicador legível nos dois temas; ela SHALL usar trilho com cantos arredondados, preenchimento em gradiente derivado dos tokens do tema e marcas discretas de referência. As barras de checklist e de subtasks SHALL seguir os requisitos próprios e usar estilos e cores distintos entre si e da barra principal. A região SHALL ser omitida apenas quando as três barras estiverem ausentes. O preenchimento SHALL transicionar de largura ao aparecer ou mudar de valor, exceto quando `prefers-reduced-motion` estiver ativa. Ao atingir 100%, a barra principal SHALL usar o token de concluído.

#### Scenario: Card com checklists

- **WHEN** existe pelo menos um item de checklist
- **THEN** a barra de checklist e o contador `marcados/total` aparecem entre tags/tipo e rodapé, junto da barra principal quando houver avanço

#### Scenario: Card sem checklists

- **WHEN** não existe item de checklist e o card está em uma coluna cujo peso de avanço é 90
- **THEN** a região exibe a barra principal em 90%, sem contador de checklist

#### Scenario: Card sem avanço

- **WHEN** o card não tem avanço, checklist com itens nem filhos
- **THEN** a região de avanço é omitida e não deixa espaço vazio

#### Scenario: Barra no tema escuro

- **WHEN** o tema escuro está ativo
- **THEN** trilhos, preenchimentos e marcas das três barras permanecem distinguíveis e com contraste legível

#### Scenario: Movimento reduzido

- **WHEN** o usuário tem `prefers-reduced-motion: reduce`
- **THEN** as barras aparecem preenchidas sem transição de largura nem brilho animado

#### Scenario: Card com as três barras

- **WHEN** o card tem avanço maior que zero, checklist com itens e subtasks
- **THEN** a região exibe, nesta ordem, a barra principal, a barra de checklist e a barra de subtasks, sem sobreposição

#### Scenario: Card com checklist e sem subtasks

- **WHEN** o card tem checklist com itens e nenhum filho
- **THEN** a região exibe a barra principal quando houver avanço e a barra de checklist, sem reservar espaço para a barra de subtasks

#### Scenario: Card com subtasks e sem checklist

- **WHEN** o card tem filhos e nenhum checklist
- **THEN** a região exibe a barra principal quando houver avanço e a barra de subtasks, sem contador de checklist

#### Scenario: Card com checklist e avanço zero

- **WHEN** o card está em coluna de peso 0, mas tem checklist com itens
- **THEN** a barra principal é omitida e a barra de checklist permanece visível

## ADDED Requirements

### Requirement: Barra de progresso do checklist no card

O card SHALL exibir uma barra de checklist apenas quando o item tiver ao menos um checklist com itens. A barra SHALL representar a razão entre marcados e total, agregando todos os checklists, ao lado do contador `marcados/total` existente. A barra SHALL usar cor, estilo e nome acessível próprios, distintos das demais barras, e SHALL manter a identidade de checklist em 100%.

#### Scenario: Card com vários checklists

- **WHEN** o card tem dois checklists, com 4 de 6 e 8 de 14 itens marcados
- **THEN** a barra de checklist mostra 12 de 20 e 60%, e o contador exibe `12/20`

#### Scenario: Checklist sem itens

- **WHEN** o card tem um checklist criado, mas sem nenhum item
- **THEN** a barra de checklist não é exibida

#### Scenario: Checklist concluído

- **WHEN** todos os itens de todos os checklists do card estão marcados
- **THEN** a barra de checklist aparece cheia, com o ícone de checklist concluído, e a barra principal continua refletindo apenas status e coluna

#### Scenario: Cor distinta da barra principal

- **WHEN** as barras principal e de checklist aparecem juntas no mesmo card
- **THEN** cada uma usa sua própria família de cor e estilo, sem ambiguidade entre os dois indicadores

#### Scenario: Nome acessível do checklist

- **WHEN** um leitor de tela percorre o card
- **THEN** a barra de checklist anuncia o progresso de checklist com marcados, total e percentual, em nome distinto da barra principal

### Requirement: Barra de progresso das subtasks no card

O card SHALL exibir uma barra de subtasks apenas quando o item tiver filhos diretos não cancelados e não arquivados. A barra SHALL representar a média do avanço das subtasks diretas, calculada pela mesma regra de status e coluna da barra principal, sem considerar checklist. A barra SHALL usar estilo, cor e nome acessível próprios e SHALL exibir a quantidade de subtasks consideradas junto do percentual.

#### Scenario: Card com subtasks em andamento

- **WHEN** o card tem quatro subtasks com avanços 100%, 100%, 50% e 0%
- **THEN** a barra de subtasks mostra 63% e a quantidade de subtasks consideradas

#### Scenario: Card com todas as subtasks concluídas

- **WHEN** todas as subtasks diretas do card estão com status `DONE`
- **THEN** a barra de subtasks aparece em 100%, mantendo o estilo próprio de subtasks

#### Scenario: Subtasks canceladas ficam fora

- **WHEN** o card tem duas subtasks concluídas e uma cancelada
- **THEN** a barra de subtasks mostra 100% e considera apenas as duas concluídas

#### Scenario: Card sem subtasks válidas

- **WHEN** o card não tem filhos ou todos os filhos estão cancelados ou arquivados
- **THEN** a barra de subtasks não é exibida

#### Scenario: Card virtual de história

- **WHEN** uma história não-folha é exibida como card no Kanban
- **THEN** a barra de subtasks considera as tasks filhas da história

#### Scenario: Nome acessível das subtasks

- **WHEN** um leitor de tela percorre o card
- **THEN** a barra de subtasks anuncia o percentual médio e a quantidade de subtasks, em nome distinto das outras barras
