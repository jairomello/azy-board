## ADDED Requirements

### Requirement: Preservação do filtro por valor vazio
O estado persistido em `board-filters:<projectId>` SHALL preservar o sentinela de valor vazio (`__empty__`) de cada campo. A restauração do Board SHALL manter o filtro por valor vazio, e a limpeza de referências de catálogo inexistentes SHALL NOT descartar o sentinela, pois ele não referencia um item de catálogo.

#### Scenario: Filtro por valor vazio restaurado ao abrir o board
- **WHEN** o usuário aplica `Sem sprint` e retorna ao Board do mesmo projeto
- **THEN** o filtro de Sprint é restaurado no estado de valor vazio e o Board filtra os cards sem sprint

#### Scenario: Invalidação de catálogo não descarta o sentinela
- **WHEN** o Board carrega e o valor persistido de Sprint é o sentinela de valor vazio
- **THEN** o sentinela é mantido, mesmo que não corresponda a nenhuma sprint do catálogo

#### Scenario: Sentinela não colide com referência de catálogo
- **WHEN** o estado persistido contém um valor que não é o sentinela e não existe no catálogo
- **THEN** somente esse valor inválido é limpo para o estado neutro
