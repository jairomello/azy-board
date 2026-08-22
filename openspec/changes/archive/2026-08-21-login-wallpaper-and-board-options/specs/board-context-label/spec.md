## ADDED Requirements

### Requirement: Rótulo de progresso geral

O cabeçalho de contexto do Board SHALL exibir `Progresso Geral` quando não houver uma sprint ativa selecionada.

#### Scenario: Sem sprint ativa

- **WHEN** o Board não possui sprint ativa
- **THEN** o cabeçalho exibe `Progresso Geral`

#### Scenario: Sprint ativa

- **WHEN** existe uma sprint ativa
- **THEN** o cabeçalho exibe o nome da sprint e não substitui esse nome por `Progresso Geral`
