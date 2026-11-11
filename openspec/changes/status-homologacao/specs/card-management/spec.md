# Spec Delta

## MODIFIED Requirements

### Requirement: Status base das tasks
O sistema SHALL manter o status base: `NOT_STARTED`, `PLANNED`, `IN_PROGRESS`, `IN_HOMOLOGATION`, `BLOCKED`, `DONE`, `CANCELLED`. O status de um card SHALL acompanhar o `baseStatus` da coluna em que ele está, inclusive em movimentação e em liberação de atribuição.

#### Scenario: Task bloqueada
- **WHEN** membro marca task como BLOCKED
- **THEN** card exibe indicador visual de bloqueio e pode receber descrição do bloqueio

#### Scenario: Task cancelada
- **WHEN** admin cancela task
- **THEN** card fica visível no board com indicador de cancelado e não pode receber novas atribuições

#### Scenario: Task em homologação
- **WHEN** task está em coluna com status base `IN_HOMOLOGATION`
- **THEN** a task expõe `status = IN_HOMOLOGATION`, aparece como "Em homologação" no card, na grade e nos filtros, e não é contada como concluída

#### Scenario: Homologação não é conclusão
- **WHEN** o avanço do projeto é calculado com cards em coluna `IN_HOMOLOGATION`
- **THEN** esses cards valem o peso da coluna (no máximo 90) e não 100, e a proporção de conclusão não os inclui
