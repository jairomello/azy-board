# Spec Delta

## ADDED Requirements

### Requirement: Kanban unificado como terceira visualização
O seletor de visualização do Board SHALL oferecer três opções: `Board` (Kanban em lanes),
`Unificado` (uma única faixa de colunas) e `Árvore`. O `Unificado` SHALL apresentar todos
os cards do recorte em uma única sequência de colunas, sem cabeçalhos de módulo, épico ou
história, mantendo o breadcrumb de origem em cada card. O layout SHALL aplicar os mesmos
filtros de população do board e SHALL NOT substituir nem alterar a visualização `Board`.

#### Scenario: Kanban existente preservado
- **WHEN** a pessoa seleciona `Board`
- **THEN** o Kanban continua exibindo lanes por módulo, épico e história, com abas, expandir/recolher e ocultações como antes

#### Scenario: Terceira opção disponível
- **WHEN** a pessoa abre um projeto
- **THEN** o seletor exibe `Board`, `Unificado` e `Árvore`, e a visualização inicial continua sendo `Board`

#### Scenario: Cards de épicos diferentes na mesma coluna
- **WHEN** a pessoa seleciona `Unificado` e existem cards de épicos diferentes na mesma coluna
- **THEN** todos aparecem nessa coluna do quadro único, sem repetir a sequência de colunas por épico

#### Scenario: Filtros recortam o quadro único
- **WHEN** a pessoa aplica filtros de módulo, sprint, responsável, status, tipo ou tag no `Unificado`
- **THEN** o quadro exibe apenas os cards que satisfazem os filtros, mantendo as colunas do fluxo

#### Scenario: Contexto de origem preservado
- **WHEN** um card é exibido no `Unificado`
- **THEN** o card continua identificando épico e história de origem no breadcrumb

#### Scenario: Movimentação e criação na coluna
- **WHEN** a pessoa arrasta um card ou aciona **Adicionar card** no `Unificado`
- **THEN** a coluna de destino é persistida e a criação abre a modal contextual com a coluna escolhida

#### Scenario: Coluna ou recorte sem cards
- **WHEN** uma coluna não possui cards ou nenhum card satisfaz os filtros
- **THEN** as colunas continuam visíveis, com contagem zero e o controle de criação, e o cabeçalho informa o recorte vazio

#### Scenario: Controles exclusivos das lanes
- **WHEN** o `Unificado` está ativo
- **THEN** os controles de abas de módulo, expandir/recolher e ocultar épicos ou histórias vazias não são oferecidos
- **AND** filtros, subtasks, cronograma, exportação e criação continuam disponíveis

#### Scenario: Projeto sem hierarquia
- **WHEN** o projeto é `SIMPLE` e a pessoa seleciona `Unificado`
- **THEN** o Board exibe a faixa única do fluxo simples, sem regressão na visualização `Board`
