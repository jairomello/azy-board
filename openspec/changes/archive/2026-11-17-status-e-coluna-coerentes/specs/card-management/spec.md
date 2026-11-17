# Spec Delta

## ADDED Requirements

### Requirement: Status e coluna coerentes na edição do card
Ao atualizar o `status` de um item móvel (`TASK`, `BUG`, `STORY` ou `EXTERNAL`) sem
informar `columnId`, o sistema SHALL posicionar o card na primeira coluna, na ordem do
fluxo, cujo `baseStatus` corresponde ao novo status. Ao atualizar `columnId`, o `status`
SHALL assumir o `baseStatus` da coluna. Quando os dois campos vierem juntos, a coluna SHALL
prevalecer sobre o status. Status sem coluna correspondente (`PLANNED`, `BLOCKED`,
`CANCELLED`) SHALL NOT reposicionar o card. Itens não móveis (`EPIC`) SHALL NOT ter a coluna
alterada por edição de status. A edição pela modal do card, pela grade da árvore, por REST
e por MCP SHALL produzir o mesmo resultado.

#### Scenario: Status em andamento pela grade
- **WHEN** um card no Backlog tem o status alterado para `IN_PROGRESS`
- **THEN** o card passa para a primeira coluna com status base `IN_PROGRESS` e aparece nela no Kanban

#### Scenario: Status não iniciado
- **WHEN** um card com status `IN_PROGRESS` tem o status alterado para `NOT_STARTED`
- **THEN** o card passa para a primeira coluna com status base `NOT_STARTED`

#### Scenario: Coluna alterada sem status
- **WHEN** a atualização informa apenas uma coluna de status base `DONE`
- **THEN** o card passa para essa coluna e seu status assume `DONE`

#### Scenario: Status e coluna juntos
- **WHEN** a atualização informa uma coluna `DONE` e um status diferente
- **THEN** o card fica na coluna informada e o status assume `DONE`

#### Scenario: Status sem coluna correspondente
- **WHEN** o status é alterado para `BLOCKED`, `PLANNED` ou `CANCELLED`, que não possuem coluna
- **THEN** o card permanece na coluna atual e não desaparece do quadro

#### Scenario: Item não móvel
- **WHEN** o status de um `EPIC` é atualizado
- **THEN** a coluna do épico não é alterada

#### Scenario: Já coerente
- **WHEN** o status informado já corresponde ao status base da coluna atual
- **THEN** a coluna e a posição do card não mudam

#### Scenario: Mesmo resultado em qualquer caminho
- **WHEN** a edição parte da modal, da grade, do REST ou do MCP
- **THEN** status e coluna permanecem coerentes da mesma forma
