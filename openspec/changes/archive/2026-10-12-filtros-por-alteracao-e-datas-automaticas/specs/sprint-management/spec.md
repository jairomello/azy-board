# Spec Delta

## ADDED Requirements

### Requirement: Datas automáticas a partir da sprint na criação

Na criação de um card TASK/BUG associado a uma sprint (explícita ou vinculada automaticamente), o sistema SHALL preencher `startDate` e `dueDate` com o `startDate` e o `endDate` da sprint quando o usuário não informar essas datas. Datas informadas explicitamente SHALL ter precedência e a criação SHALL NOT falhar por ausência de datas. A regra SHALL valer na criação individual e em lote, pela API, pelo MCP e pelo Azy Agent.

#### Scenario: Task criada com sprint explícita e sem datas

- **WHEN** um card é criado informando uma sprint e sem `startDate`/`dueDate`
- **THEN** o card recebe as datas de início e fim da sprint

#### Scenario: Task criada com sprint vigente automática e sem datas

- **WHEN** um card é criado sem sprint e sem datas, e existe sprint vigente que é vinculada automaticamente
- **THEN** o card recebe as datas de início e fim dessa sprint

#### Scenario: Datas informadas têm precedência

- **WHEN** a criação informa `startDate` e/ou `dueDate` junto de uma sprint
- **THEN** as datas informadas são preservadas e não são sobrescritas pelas datas da sprint

#### Scenario: Criação sem sprint permanece sem datas

- **WHEN** a criação não tem sprint explícita nem vigente
- **THEN** o card é criado sem datas, como hoje

#### Scenario: Itens existentes não são alterados

- **WHEN** a sprint de um item existente é alterada
- **THEN** as datas do item não são recalculadas nem preenchidas automaticamente
