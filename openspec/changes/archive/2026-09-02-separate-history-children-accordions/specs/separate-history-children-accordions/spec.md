## ADDED Requirements

### Requirement: Accordions independentes
A modal de item SHALL exibir Histórico/Atividades e Filhos/Subtasks em accordions distintos, cada um com conteúdo e estado independente.

#### Scenario: Seções separadas
- **WHEN** usuário abre uma Task, Bug ou Subtask
- **THEN** Histórico e Filhos aparecem como dois cabeçalhos distintos, sem misturar logs, horas, filhos ou ações de subtask

#### Scenario: Expansão independente
- **WHEN** usuário expande ou recolhe Histórico
- **THEN** o estado de Filhos não é alterado, e vice-versa

### Requirement: Resumos específicos
Cada seção SHALL exibir resumo coerente com seu conteúdo.

#### Scenario: Resumo de Histórico
- **WHEN** existem atividades ou horas registradas
- **THEN** o cabeçalho de Histórico exibe um resumo de atividade/horas, sem apresentar contagem de filhos

#### Scenario: Resumo de Filhos
- **WHEN** existem filhos diretos ou nenhuma subtask
- **THEN** o cabeçalho de Filhos exibe a contagem/estado de filhos, sem apresentar conteúdo de logs

### Requirement: Controles e modais empilhadas
A separação SHALL funcionar com Expandir tudo, Recolher tudo, teclado e abertura de modal filha.

#### Scenario: Controles globais
- **WHEN** usuário ativa Expandir tudo ou Recolher tudo
- **THEN** os accordions de Histórico e Filhos obedecem ao comando sem perder dados

#### Scenario: Abrir filho
- **WHEN** usuário abre uma subtask a partir da seção Filhos
- **THEN** a modal filha fica sobre a modal atual e, ao retornar, as seções e valores da modal anterior permanecem intactos

#### Scenario: Acessibilidade
- **WHEN** usuário navega por teclado
- **THEN** cada cabeçalho possui foco, `aria-expanded`, `aria-controls` e rótulo distinto para Histórico e Filhos
