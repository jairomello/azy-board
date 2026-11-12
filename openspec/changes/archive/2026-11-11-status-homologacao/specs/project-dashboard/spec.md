# Spec Delta

## MODIFIED Requirements

### Requirement: Boxes de estado atual
O sistema SHALL calcular Progresso e Escopo, WIP, Bloqueados, Atrasados, Versões e Carga da Equipe a partir do estado atual, permitindo detalhar os itens que compõem cada valor. O box WIP SHALL considerar `IN_PROGRESS`, `IN_HOMOLOGATION` e `BLOCKED` como trabalho aberto em fluxo.

#### Scenario: Item bloqueado
- **WHEN** folha possui status `BLOCKED`
- **THEN** participa de WIP e Bloqueados, exibindo motivo e responsável quando disponíveis

#### Scenario: Item em homologação
- **WHEN** folha possui status `IN_HOMOLOGATION`
- **THEN** participa de WIP na chave própria `IN_HOMOLOGATION` e não participa de Progresso como concluída

#### Scenario: Item atrasado
- **WHEN** folha não concluída/cancelada possui `dueDate` anterior à data civil atual
- **THEN** participa de Atrasados e pode ser aberta no detalhamento

#### Scenario: Versão sem itens
- **WHEN** versão não possui folhas associadas
- **THEN** box exibe escopo zero sem calcular percentual inválido

#### Scenario: Carga da equipe
- **WHEN** itens ativos possuem responsáveis membros de squads
- **THEN** box agrupa WIP e bloqueios por squad/membro sem score ou ranking de produtividade

### Requirement: Aging WIP observado
O sistema SHALL calcular aging do episódio ativo atual. Entrada em `IN_PROGRESS`, `IN_HOMOLOGATION` ou `BLOCKED` inicia o episódio, transição entre eles não zera, saída para `NOT_STARTED`, `PLANNED`, `DONE`, `CANCELLED` ou `ARCHIVED` encerra e uma nova entrada, inclusive por restauração ativa, inicia outro. Para item já ativo no baseline sem início conhecido, SHALL exibir idade mínima desde `coverageStartedAt`.

#### Scenario: Card planejado não acumula aging
- **WHEN** um card passa de `IN_PROGRESS` para uma coluna `PLANNED`
- **THEN** o episódio ativo encerra e o card não acumula aging enquanto estiver planejado

#### Scenario: Item iniciado após cobertura
- **WHEN** item entra em trabalho após `coverageStartedAt`
- **THEN** aging usa o instante da primeira transição observada

#### Scenario: Item ativo legado
- **WHEN** baseline encontra item já ativo sem evento de início
- **THEN** box identifica a idade como mínima conhecida e não afirma a data real de início
