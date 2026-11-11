# Spec Delta

## MODIFIED Requirements

### Requirement: Peso de avanço por coluna

Cada coluna SHALL ter um peso de avanço inteiro entre 0 e 100. Sem valor explícito, o peso SHALL ser derivado do `baseStatus` e da posição entre as colunas do mesmo status, de modo que colunas de trabalho não iniciado valham 0, a coluna concluída valha 100 e nenhuma coluna em progresso valha 100. `IN_PROGRESS`, `IN_HOMOLOGATION` e `BLOCKED` SHALL compor a mesma faixa do fluxo (50 a 90), distribuída pela posição da coluna. Um peso explícito SHALL ter precedência sobre o valor derivado.

#### Scenario: Projeto sem peso explícito

- **WHEN** um projeto tem duas colunas `IN_PROGRESS` ("Fazendo" e "A Testar") e nenhum peso definido
- **THEN** "Fazendo" vale 50 e "A Testar" vale 90

#### Scenario: Homologação no fim do fluxo

- **WHEN** a última coluna de fluxo do projeto tem `baseStatus = IN_HOMOLOGATION`
- **THEN** ela vale 90, e a coluna `DONE` continua valendo 100

#### Scenario: Uma única coluna em progresso

- **WHEN** um projeto tem apenas uma coluna de fluxo (`IN_PROGRESS`, `IN_HOMOLOGATION` ou `BLOCKED`)
- **THEN** essa coluna vale 90, e não 100

#### Scenario: Peso explícito tem precedência

- **WHEN** o projeto define o peso de "A Testar" como 80
- **THEN** o cálculo usa 80 no lugar do valor derivado, e as demais colunas seguem o derivado

#### Scenario: Colunas de trabalho não iniciado e concluído

- **WHEN** um projeto tem colunas `NOT_STARTED` e `DONE`
- **THEN** as colunas não iniciadas valem 0 e a coluna concluída vale 100
