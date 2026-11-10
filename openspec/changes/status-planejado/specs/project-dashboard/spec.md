# Spec Delta

## MODIFIED Requirements

### Requirement: Distribuição por status
O sistema SHALL distribuir os cards ativos por status em `DONE`, `IN_PROGRESS`, `BLOCKED`, `PLANNED` e `NOT_STARTED`, tanto em contagem quanto em pontos, de forma que o trabalho priorizado não seja somado ao backlog não priorizado.

#### Scenario: Planejado tem bucket próprio
- **WHEN** o projeto tem cards em colunas `PLANNED` e `NOT_STARTED`
- **THEN** a distribuição mostra "Planejada" e "Não iniciada" em buckets separados

### Requirement: Aging WIP observado
O sistema SHALL calcular aging do episódio ativo atual. Entrada em `IN_PROGRESS`/`BLOCKED` inicia o episódio, transição entre ambos não zera, saída para `NOT_STARTED`, `PLANNED`, `DONE`, `CANCELLED` ou `ARCHIVED` encerra e uma nova entrada, inclusive por restauração ativa, inicia outro. Para item já ativo no baseline sem início conhecido, SHALL exibir idade mínima desde `coverageStartedAt`.

#### Scenario: Card planejado não acumula aging
- **WHEN** um card passa de `IN_PROGRESS` para uma coluna `PLANNED`
- **THEN** o episódio ativo encerra e o card não acumula aging enquanto estiver planejado

#### Scenario: Item iniciado após cobertura
- **WHEN** item entra em trabalho após `coverageStartedAt`
- **THEN** aging usa o instante da primeira transição observada

#### Scenario: Item ativo legado
- **WHEN** baseline encontra item já ativo sem evento de início
- **THEN** box identifica a idade como mínima conhecida e não afirma a data real de início
