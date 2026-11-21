# Spec Delta

## REMOVED Requirements

### Requirement: Linha de etiquetas com tipo textual único

**Reason**: A linha misturava tags, status e tipo no mesmo `flex`, sem limite de
largura por tag. Nomes com espaço quebravam dentro da pílula, desalinhavam o
bloco e cresciam sem controle com muitas tags.

**Migration**: O comportamento é substituído pelos requisitos "Faixa de
etiquetas com truncamento e resumo" e "Faixa de status e tipo separada das
tags", que mantêm a semântica das etiquetas de status e tipo.

## ADDED Requirements

### Requirement: Faixa de etiquetas com truncamento e resumo

O sistema SHALL exibir as tags do card em uma faixa própria, em uma única linha,
com altura fixa e sem quebra de texto dentro da pílula. Cada tag SHALL ter largura
máxima e truncar com reticências, expondo o nome completo em tooltip. Quando as
tags não couberem, o sistema SHALL exibir até duas tags e resumir as restantes em
um chip `+N` com tooltip e nome acessível. Card sem tags SHALL omitir a faixa.

#### Scenario: Tags curtas em uma linha

- **WHEN** o card tem duas tags curtas
- **THEN** as duas aparecem na faixa de tags, com altura constante e sem quebrar o texto

#### Scenario: Tag longa truncada

- **WHEN** uma tag tem nome maior que a largura máxima definida
- **THEN** o nome é truncado com reticências, permanece em uma linha e o nome completo aparece no tooltip

#### Scenario: Muitas tags com resumo

- **WHEN** o card tem mais tags do que o espaço permite
- **THEN** no máximo duas tags aparecem e as restantes são resumidas em `+N`, com a lista completa no tooltip e nome acessível

#### Scenario: Card sem tags

- **WHEN** o card não tem tags
- **THEN** a faixa de tags é omitida e não reserva espaço vazio

#### Scenario: Tema escuro e densidade compacta

- **WHEN** o tema escuro ou a densidade compacta está ativa
- **THEN** as tags e o chip `+N` mantêm contraste e alinhamento, sem quebra de texto

### Requirement: Faixa de status e tipo separada das tags

O sistema SHALL exibir status e tipo em uma faixa própria, separada das tags, sem
quebra de linha e com a mesma altura das tags. A etiqueta de status SHALL manter
o nome do status no idioma da interface e o destaque de alerta quando o status
não combina com a coluna. A faixa SHALL permanecer alinhada mesmo quando existir
tag longa ou muitas tags.

#### Scenario: Status e tipo fora da faixa de tags

- **WHEN** o card tem tags, status e tipo
- **THEN** as tags ocupam uma faixa e o status e o tipo ocupam outra, sem competir por largura nem desalinhar

#### Scenario: Card sem tags

- **WHEN** o card não tem tags
- **THEN** status e tipo ocupam a faixa sem lacuna reservada para tags

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
