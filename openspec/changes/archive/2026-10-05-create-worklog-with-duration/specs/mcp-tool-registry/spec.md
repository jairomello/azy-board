## ADDED Requirements

### Requirement: Duração no descritor de criação de apontamento

O descritor de `create_item_log` SHALL declarar `durationMin` (inteiro não-negativo de minutos, opcional) e `duration` (string humano-legível, opcional) como campos do catálogo, permanecendo a fonte única de schema, validação, normalização e descrição. A normalização de `duration` para `durationMin` SHALL ocorrer antes da validação de negócio, do preview de aprovação, do hash de operação e da execução. O parser SHALL aceitar `H:MM`, `Nh`, `NhMM`, `N`, `Nmin` e `Nm`, rejeitando valores negativos, minutos `> 59` quando houver separador de hora e entradas inválidas. Quando `durationMin` e `duration` forem informados simultaneamente e os minutos divergirem, a validação SHALL rejeitar com erro acionável citando os dois valores. O parser do caminho de ferramenta NÃO SHALL alterar o contrato `H:MM` do formulário do Diário.

#### Scenario: Campo de duração exposto como opcional

- **WHEN** o schema exposto de `create_item_log` é inspecionado
- **THEN** `durationMin` e `duration` aparecem como opcionais e a forma mínima continua exigindo apenas `projectId`, `itemId` e `activity`

#### Scenario: Duração legível normalizada antes do preview

- **WHEN** `create_item_log` recebe `duration: "1h30"`
- **THEN** a canonicalização produz `durationMin: 90` antes da validação, do preview de aprovação e do hash da operação

#### Scenario: Formatos aceitos

- **WHEN** `duration` é `"90"`, `"1h"`, `"1:30"`, `"90min"` ou `"1h30min"`
- **THEN** a normalização produz respectivamente 90, 60, 90, 90 e 90 minutos

#### Scenario: Duração inválida é rejeitada de forma acionável

- **WHEN** `durationMin` é negativo ou `duration` não corresponde a nenhum formato aceito
- **THEN** a validação rejeita a chamada, cita o valor recebido e o formato aceito, e nenhum apontamento é criado

#### Scenario: Conflito entre representações é rejeitado

- **WHEN** a chamada informa `durationMin: 30` e `duration: "1h"`
- **THEN** a validação rejeita com mensagem citando os dois valores, sem executar a criação

#### Scenario: Paridade entre schema, validação e executor

- **WHEN** `bun test packages/tool-registry` e `bun run test:mcp-catalog` executam
- **THEN** schema exposto, validação, campos declarados e dispatcher concordam sobre `durationMin`/`duration` em `create_item_log`
