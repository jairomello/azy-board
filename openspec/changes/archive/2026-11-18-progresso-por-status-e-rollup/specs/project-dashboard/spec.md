## MODIFIED Requirements

### Requirement: População sem dupla contagem
O sistema SHALL calcular cada indicador sobre uma população explícita, determinando a condição de folha antes dos filtros. Progresso, conclusão e SPI SHALL usar as folhas de progresso (`TASK`, `BUG`, `STORY` ou `EPIC` sem filhos, exceto a STORY fixa do modo `SIMPLE`) sem `CANCELLED`; tokens SHALL contar em qualquer status; carga da equipe SHALL considerar somente trabalho em andamento; atraso SHALL seguir a regra vigente com universo próprio. Folhas `EXTERNAL` SHALL ser contadas à parte e não SHALL entrar no progresso. Pais SHALL ser usados apenas para agrupamento.

#### Scenario: Pai oculto pelo filtro
- **WHEN** filtro oculta os filhos de uma TASK pai
- **THEN** TASK pai não passa a ser contabilizada como folha

#### Scenario: Pontos parciais
- **WHEN** parte das folhas não possui pontos
- **THEN** progresso por pontos usa somente pontos conhecidos e exibe cobertura de estimativa

#### Scenario: N/A fora do progresso
- **WHEN** uma folha de progresso está em `CANCELLED`
- **THEN** ela não entra em progresso, conclusão nem SPI, e é exibida separadamente como N/A fora do escopo

#### Scenario: Dependência externa à parte
- **WHEN** o projeto possui folhas do tipo `EXTERNAL`
- **THEN** elas são contadas em bloco próprio, fora do progresso de trabalho

#### Scenario: Token de card cancelado
- **WHEN** um card cancelado possui tokens registrados
- **THEN** os tokens continuam contando no escopo e nos recortes, porque representam consumo realizado

#### Scenario: História sem tarefas entra na população

- **WHEN** o projeto tem uma STORY concluída sem filhos
- **THEN** ela entra em progresso, conclusão e SPI como uma folha concluída

### Requirement: Burnup com cobertura explícita
O sistema SHALL exibir o estado ao fim de cada dia UTC com linhas de escopo total e concluído por contagem ou pontos desde `coverageStartedAt`. Escopo SHALL usar as folhas de progresso (`TASK`, `BUG`, `STORY` ou `EPIC` sem filhos) não arquivadas e concluído SHALL significar `DONE`. Mudanças de escopo SHALL aparecer na linha total, sem calcular burndown ou box isolado de churn.

#### Scenario: Pontos alterados
- **WHEN** pontos mudam durante o período coberto
- **THEN** linha de escopo total muda na data do evento e preserva valores anteriores

#### Scenario: Período anterior à cobertura
- **WHEN** intervalo começa antes de `coverageStartedAt`
- **THEN** gráfico inicia no baseline disponível e indica cobertura parcial

### Requirement: Indicador de avanço no dashboard

O dashboard SHALL apresentar o avanço do projeto pela regra por status (o status define a faixa e a coluna refina), a mesma da árvore, do board e da listagem de projetos, ao lado da conclusão, dentro do quadro de progresso e escopo, com rótulo que distinga avanço no fluxo de entrega concluída. A lista de quadros permanece a atual; o avanço não SHALL substituir a métrica de conclusão nem alterar escopo, burnup ou cobertura de estimativa.

#### Scenario: Avanço com cards em progresso

- **WHEN** o dashboard é aberto em um projeto com folhas em `IN_PROGRESS` e nenhuma concluída
- **THEN** o avanço mostra o percentual derivado do status e das colunas, distinto do 0% de conclusão

#### Scenario: Avanço respeita filtros aplicáveis

- **WHEN** o usuário aplica filtros de módulo, sprint, versão, squad, responsável ou tipo
- **THEN** o avanço é recalculado sobre a mesma população filtrada usada pelos demais quadros

#### Scenario: Rótulos não confundem avanço com entrega

- **WHEN** o quadro de progresso e escopo exibe os dois indicadores
- **THEN** a conclusão é rotulada como concluídos e o avanço como avanço no fluxo
