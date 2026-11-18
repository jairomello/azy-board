## MODIFIED Requirements

### Requirement: Linha de etiquetas com tipo textual único
O sistema SHALL exibir tags à esquerda e, à direita, a etiqueta textual do status do card seguida de uma única etiqueta textual do tipo, usando cores legíveis nos temas claro e escuro. A etiqueta de status SHALL trazer o nome do status no idioma da interface e um marcador na mesma família de cor da faixa lateral. Quando o status do card não combina com a coluna em que ele está e o projeto tem coluna própria para esse status, a etiqueta SHALL ficar em destaque de alerta, com dica e texto acessível que nomeiam a coluna atual. A etiqueta SHALL aparecer igual no Board e no Kanban unificado. Tags múltiplas SHALL poder quebrar linha sem sobreposição.

#### Scenario: Tags à esquerda e tipo à direita
- **WHEN** o card possui tags e tipo
- **THEN** as tags ficam à esquerda e o tipo aparece uma única vez à direita

#### Scenario: Tags múltiplas quebram linha
- **WHEN** as tags não cabem em uma linha
- **THEN** elas quebram linha e o card aumenta de altura sem cobrir outras regiões

#### Scenario: Status visível no card
- **WHEN** um card com status `IN_PROGRESS` está na coluna "Fazendo", de status base `IN_PROGRESS`
- **THEN** o card mostra a etiqueta "Em andamento" ao lado do tipo, sem destaque de alerta

#### Scenario: Status diferente da coluna
- **WHEN** um card com status `IN_HOMOLOGATION` está na coluna Backlog e o projeto tem a coluna "Em Homologação"
- **THEN** a etiqueta "Em homologação" aparece em destaque de alerta, com a dica "Status diferente da coluna "Backlog""

#### Scenario: Status sem coluna própria não é desencontro
- **WHEN** um card `BLOCKED` está em "A Fazer" e o projeto não tem coluna de status base `BLOCKED`
- **THEN** a etiqueta "Bloqueada" aparece sem destaque de alerta

#### Scenario: Mesma etiqueta no Kanban unificado
- **WHEN** o usuário alterna entre o Board e o Kanban unificado
- **THEN** cada card mostra a mesma etiqueta de status e o mesmo destaque nas duas visões
