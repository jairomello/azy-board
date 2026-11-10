# Spec Delta

## MODIFIED Requirements

### Requirement: Status base das tasks

O sistema SHALL manter o status base: `NOT_STARTED`, `PLANNED`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `CANCELLED`. O status de um card SHALL acompanhar o `baseStatus` da coluna em que ele está, inclusive em movimentação e em liberação de atribuição.

#### Scenario: Task bloqueada

- **WHEN** membro marca task como BLOCKED
- **THEN** card exibe indicador visual de bloqueio e pode receber descrição do bloqueio

#### Scenario: Task cancelada

- **WHEN** admin cancela task
- **THEN** card fica visível no board com indicador de cancelado e não pode receber novas atribuições

#### Scenario: Task planejada

- **WHEN** task está em coluna com status base `PLANNED`
- **THEN** a task expõe `status = PLANNED`, editável apenas por movimentação de coluna ou por atualização explícita, e aparece nos filtros de status como "Planejada"

#### Scenario: Liberar task preserva o status da coluna

- **WHEN** task em coluna `PLANNED` ou `IN_PROGRESS` tem a atribuição liberada
- **THEN** o status permanece o da coluna atual e apenas responsável e vínculo de API key são removidos
