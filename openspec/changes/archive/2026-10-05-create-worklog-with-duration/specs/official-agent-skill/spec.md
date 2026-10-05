## ADDED Requirements

### Requirement: Documentação de apontamento com duração

A skill oficial SHALL documentar a criação de apontamento de trabalho por `create_item_log` com `activity` e duração, apresentando exemplos mínimos com `durationMin` (minutos) e `duration` (formato humano-legível, ex.: `1h30` normalizado para 90). A skill SHALL informar que a data do registro é o momento atual e que não há suporte a data retroativa, além de registrar a duração esperada na confirmação da mutação.

#### Scenario: Exemplo mínimo de apontamento

- **WHEN** o agente consulta a skill sobre como registrar tempo de trabalho
- **THEN** encontra um exemplo de `create_item_log` com `activity` e `durationMin` e a regra de confirmação do resultado

#### Scenario: Formato legível documentado

- **WHEN** a skill descreve o campo de duração
- **THEN** explica que `1h30` equivale a 90 minutos e pode ser enviado como `duration`

#### Scenario: Limitação de data retroativa documentada

- **WHEN** a skill trata da data do apontamento
- **THEN** informa que o registro é sempre no momento atual, sem retroativo, para o agente não prometer o que o domínio não faz

#### Scenario: Verificação de sincronização da skill

- **WHEN** `bun run test:agent-skill` executa após a mudança
- **THEN** a skill canônica e o espelho permanecem sincronizados e o verificador passa
