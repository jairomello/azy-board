## ADDED Requirements

### Requirement: Apontamento de trabalho com duração na conversa

O harness SHALL conduzir a criação de apontamento de trabalho com duração pelo mesmo fluxo de aprovação das demais mutações, exibindo no preview a atividade e a duração formatada (por exemplo, `90 min (1h30)`). Como a normalização de duração ocorre antes do hash, chamadas equivalentes — mesma atividade com a mesma duração, independentemente da representação — SHALL ser tratadas como a mesma operação, de modo que a repetição do pedido na mesma run não crie registro duplicado. O harness NÃO SHALL prometer data retroativa, pois o domínio registra o apontamento no momento atual.

#### Scenario: Preview mostra atividade e duração

- **WHEN** o agente propõe `create_item_log` com atividade e duração `"1h30"`
- **THEN** o preview de aprovação exibe a atividade e a duração formatada `90 min (1h30)` antes de executar

#### Scenario: Repetição do mesmo apontamento não duplica

- **WHEN** o modelo emite duas vezes a mesma chamada de apontamento na mesma run
- **THEN** o harness não cria um segundo registro, tratando a repetição como `REPEATED_TOOL_CALL` ou operação já executada

#### Scenario: Representações equivalentes têm a mesma assinatura

- **WHEN** o modelo repete o apontamento como `durationMin: 90` depois de ter proposto `duration: "1h30"`
- **THEN** o hash/assinatura canônica é o mesmo e não há duplicação

#### Scenario: Retroativo não é prometido

- **WHEN** o usuário pede “registre 1h30 referente a ontem”
- **THEN** o agente informa que a data do registro é o momento atual e cria o apontamento sem afirmar data retroativa
