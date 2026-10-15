# Spec Delta

## ADDED Requirements

### Requirement: Indicador de avanço no dashboard

O dashboard SHALL apresentar o avanço do projeto pela regra do peso de coluna, ao lado da conclusão, dentro do quadro de progresso e escopo, com rótulo que distinga avanço no fluxo de entrega concluída. A lista de quadros permanece a atual; o avanço não SHALL substituir a métrica de conclusão nem alterar escopo, burnup ou cobertura de estimativa.

#### Scenario: Avanço com cards em progresso

- **WHEN** o dashboard é aberto em um projeto com folhas em `IN_PROGRESS` e nenhuma concluída
- **THEN** o avanço mostra o percentual derivado das colunas, distinto do 0% de conclusão

#### Scenario: Avanço respeita filtros aplicáveis

- **WHEN** o usuário aplica filtros de módulo, sprint, versão, squad, responsável ou tipo
- **THEN** o avanço é recalculado sobre a mesma população filtrada usada pelos demais quadros

#### Scenario: Rótulos não confundem avanço com entrega

- **WHEN** o quadro de progresso e escopo exibe os dois indicadores
- **THEN** a conclusão é rotulada como concluídos e o avanço como avanço no fluxo

### Requirement: Ausência de estimativas tratada explicitamente

Quando a cobertura de estimativa de um projeto for zero, o dashboard SHALL NOT apresentar valores de pontos como resultado: as visões de pontos SHALL ser omitidas e substituídas por uma orientação acionável de que o projeto não tem estimativas. As visões de pontos SHALL voltar a aparecer quando existir ao menos um item estimado na população.

#### Scenario: Projeto sem estimativas

- **WHEN** nenhum item da população tem pontos
- **THEN** as visões de pontos não exibem `0/0` nem percentuais de cobertura como se fossem resultado, e o quadro orienta a definir estimativas

#### Scenario: Projeto com estimativas parciais

- **WHEN** parte da população tem pontos
- **THEN** as visões de pontos aparecem com a cobertura de estimativa informada

### Requirement: Cobertura parcial explicada na origem da série

Quadros históricos com cobertura parcial SHALL explicar que a série começa na data de início da cobertura e que itens cujo início do episódio coincide com essa data estão saturados no limite da cobertura observada. A explicação SHALL NOT ser apresentada quando a cobertura for completa.

#### Scenario: Burnup com cobertura parcial

- **WHEN** o quadro de burnup é exibido em um projeto cuja cobertura começou depois do início do projeto
- **THEN** o quadro informa a data de início da cobertura e que a série é limitada a ela

#### Scenario: Aging saturado no início da cobertura

- **WHEN** itens do aging têm o início do episódio igual à data de início da cobertura
- **THEN** o quadro sinaliza que esses itens têm idade mínima conhecida, e não idade real

#### Scenario: Cobertura completa não explica nada

- **WHEN** a cobertura do quadro é completa
- **THEN** nenhuma mensagem de cobertura parcial é exibida

### Requirement: Rótulos legíveis nos rankings do dashboard

Os rankings do dashboard SHALL rotular cada item com o código sequencial ou o título do card, e SHALL NOT usar o identificador técnico. O título completo SHALL permanecer acessível por tooltip ou detalhe do item.

#### Scenario: Ranking do aging

- **WHEN** o quadro de aging lista os itens mais antigos
- **THEN** cada barra é rotulada com o código ou o título do card, e não com o identificador

#### Scenario: Ranking de bloqueados

- **WHEN** o quadro de bloqueados lista itens
- **THEN** cada barra é rotulada com o código ou o título do card

#### Scenario: Título completo acessível

- **WHEN** o rótulo é abreviado para caber no eixo
- **THEN** o título completo permanece disponível no tooltip ou no detalhe do item

### Requirement: Estados vazios e legendas sem ambiguidade

Os quadros do dashboard SHALL usar estado vazio compacto quando não houver dados, sem reservar a altura de um gráfico, e SHALL apresentar legendas sem repetição e sem repetir a unidade já indicada pelo rótulo.

#### Scenario: Quadro sem dados

- **WHEN** um quadro não tem dados na população filtrada
- **THEN** ele exibe uma mensagem vazia compacta, sem área de gráfico reservada

#### Scenario: Legenda de gráfico com dois recortes

- **WHEN** um quadro apresenta dois gráficos do mesmo conjunto
- **THEN** a legenda de cada categoria aparece uma única vez

#### Scenario: Unidade não repetida

- **WHEN** a métrica principal de um quadro tem rótulo e unidade equivalentes
- **THEN** a unidade não é repetida no mesmo valor
