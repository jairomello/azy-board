# Spec Delta

## ADDED Requirements

### Requirement: Filtro de janela de alteração em list_tasks

O catálogo compartilhado SHALL declarar em `list_tasks` um campo de filtro por janela de última alteração, como fonte única de schema, validação e descrição. O campo SHALL aceitar os valores `1d`, `2d`, `3d`, `5d`, `1w`, `1m` e `current-sprint`, SHALL ser opcional e SHALL rejeitar valores fora do conjunto com erro acionável que cita o valor recebido e as opções aceitas.

#### Scenario: Campo exposto como opcional

- **WHEN** o schema exposto de `list_tasks` é inspecionado
- **THEN** o campo de janela de alteração aparece como opcional e a forma mínima continua exigindo apenas `projectId`

#### Scenario: Valor válido aceito

- **WHEN** o agente chama `list_tasks` com a janela `3d`
- **THEN** a validação aceita e a consulta retorna apenas itens alterados desde 00:00 de 3 dias atrás (fuso do projeto)

#### Scenario: Valor inválido rejeitado

- **WHEN** `list_tasks` recebe um valor de janela fora do conjunto aceito
- **THEN** a validação rejeita citando o valor recebido e as opções aceitas, sem consultar itens

#### Scenario: Paridade entre schema, validação e executor

- **WHEN** `bun test packages/tool-registry` e `bun run test:mcp-catalog` executam
- **THEN** schema exposto, validação, campos declarados e dispatcher concordam sobre o filtro de alteração em `list_tasks`
