# Spec Delta

## ADDED Requirements

### Requirement: Catálogo completo de status na edição do card

A modal de edição de card SHALL oferecer todos os status base editáveis —
`NOT_STARTED`, `PLANNED`, `IN_PROGRESS`, `IN_HOMOLOGATION`, `BLOCKED`, `DONE` e
`CANCELLED` — na ordem do fluxo, com o status atual selecionado. `ARCHIVED` SHALL
NOT ser oferecido: arquivamento é ciclo de vida, não etapa escolhível. O rótulo
de cada status SHALL vir do catálogo comum de traduções (`common:status.*`), e o
mesmo rótulo SHALL ser usado no chip do cabeçalho da modal e no painel de
subtasks.

#### Scenario: Seletor lista os sete status
- **WHEN** o usuário abre as propriedades de uma Task ou Bug
- **THEN** o campo Status lista Não iniciada, Planejada, Em andamento, Em homologação, Bloqueada, Concluída e Cancelada, com o valor atual selecionado
- **AND** Arquivada não aparece entre as opções

#### Scenario: Status de homologação selecionável
- **WHEN** o projeto possui coluna com status base `IN_HOMOLOGATION` e o usuário abre a modal de um card
- **THEN** o campo Status oferece Em homologação e o salvamento persiste `IN_HOMOLOGATION`

#### Scenario: Cabeçalho não rotula Planejada nem Homologação como Cancelada
- **WHEN** o card está em `PLANNED` ou `IN_HOMOLOGATION`
- **THEN** o chip do cabeçalho exibe Planejada ou Em homologação, nunca Cancelada

#### Scenario: Subtask usa o mesmo rótulo
- **WHEN** o painel de subtasks exibe um filho em `IN_HOMOLOGATION` ou `PLANNED`
- **THEN** o badge do filho mostra o rótulo traduzido, não o código do status

#### Scenario: Rótulo traduzido nos três idiomas
- **WHEN** o idioma da interface é pt-BR, en ou es
- **THEN** cada um dos sete status tem rótulo próprio no idioma ativo
