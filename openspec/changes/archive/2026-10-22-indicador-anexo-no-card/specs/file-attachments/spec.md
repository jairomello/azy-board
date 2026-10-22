# Spec Delta

## ADDED Requirements

### Requirement: Indicador de anexos no card do board
O card do Kanban SHALL exibir um ícone de clipe acompanhado do contador de anexos do item, somente quando o item tiver ao menos um anexo e a capacidade de anexos estiver habilitada no tenant. O contador SHALL refletir a quantidade real de anexos do item, derivado de leitura agregada por projeto, sem consulta individual por item.

#### Scenario: Card com anexos mostra o contador
- **WHEN** o board é exibido em um tenant com anexos habilitados e um card tem N anexos, com N maior ou igual a 1
- **THEN** o card mostra o clipe com o número N

#### Scenario: Card sem anexos não mostra o indicador
- **WHEN** o card não tem nenhum anexo
- **THEN** o card não mostra nem o clipe nem o contador

#### Scenario: Capacidade de anexos desabilitada no tenant
- **WHEN** a capacidade de anexos está desabilitada no tenant
- **THEN** nenhum card mostra o indicador de anexos, mesmo que existam anexos registrados no projeto

#### Scenario: Contagem sem consulta por item
- **WHEN** o board é carregado com vários cards
- **THEN** a contagem de anexos de cada card vem de uma única leitura agregada por projeto, sem consulta individual por item

#### Scenario: Anúncio acessível do indicador
- **WHEN** o indicador de anexos é lido por tecnologia assistiva
- **THEN** ele expõe rótulo traduzido com a quantidade de anexos do card
