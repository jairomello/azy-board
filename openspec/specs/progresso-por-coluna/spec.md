# progresso-por-coluna Specification

## Purpose

Definir como o avanço do trabalho é derivado da posição do card no fluxo, para que itens sem checklist também apresentem progresso, mantendo a conclusão como indicador separado.

## Requirements
### Requirement: Peso de avanço por coluna

Cada coluna SHALL ter um peso de avanço inteiro entre 0 e 100. Sem valor explícito, o peso SHALL ser derivado do `baseStatus` e da posição entre as colunas do mesmo status, de modo que colunas de trabalho não iniciado valham 0, a coluna concluída valha 100 e nenhuma coluna em progresso valha 100. Um peso explícito SHALL ter precedência sobre o valor derivado.

#### Scenario: Projeto sem peso explícito

- **WHEN** um projeto tem duas colunas `IN_PROGRESS` ("Fazendo" e "A Testar") e nenhum peso definido
- **THEN** "Fazendo" vale 50 e "A Testar" vale 90

#### Scenario: Uma única coluna em progresso

- **WHEN** um projeto tem apenas uma coluna `IN_PROGRESS`
- **THEN** essa coluna vale 90, e não 100

#### Scenario: Peso explícito tem precedência

- **WHEN** o projeto define o peso de "A Testar" como 80
- **THEN** o cálculo usa 80 no lugar do valor derivado, e as demais colunas seguem o derivado

#### Scenario: Colunas de trabalho não iniciado e concluído

- **WHEN** um projeto tem colunas `NOT_STARTED` e `DONE`
- **THEN** as colunas não iniciadas valem 0 e a coluna concluída vale 100

### Requirement: Cálculo do avanço de um card

O sistema SHALL calcular o avanço de um card como o peso da sua coluna quando ele não tem checklist e, quando tem, a posição do checklist dentro da faixa delimitada pelo peso da coluna anterior no fluxo e o peso da própria coluna. Marcar itens de checklist nunca SHALL reduzir o avanço. Agrupadores SHALL apresentar a média do avanço das suas folhas não arquivadas, e agrupador sem folhas SHALL apresentar 0%.

#### Scenario: Card sem checklist usa o peso da coluna

- **WHEN** um card sem checklist está em "A Testar", cujo peso é 90
- **THEN** seu avanço é 90%

#### Scenario: Checklist afina dentro da faixa da coluna

- **WHEN** um card em "Fazendo" (faixa de 0 a 50) tem 5 de 10 itens de checklist marcados
- **THEN** seu avanço é 25%

#### Scenario: Marcar itens nunca reduz o avanço

- **WHEN** um card passa a ter um checklist com nenhum item marcado
- **THEN** seu avanço permanece o mesmo que o card sem checklist teria naquela coluna

#### Scenario: Agrupador calcula a média das folhas

- **WHEN** uma história tem três folhas com avanço 90%, 90% e 0%
- **THEN** a história apresenta 60%

#### Scenario: Agrupador sem folhas

- **WHEN** um item agrupador não possui folha `TASK`/`BUG` descendente
- **THEN** seu avanço é 0%, sem erro

### Requirement: Avanço e conclusão como indicadores distintos

O sistema SHALL manter a conclusão calculada como a proporção de folhas com status `DONE` sobre o total de folhas, e SHALL apresentar o avanço como indicador separado. Escopo, burnup e a métrica de conclusão SHALL NOT ser redefinidos pelo avanço, e onde os dois indicadores aparecem juntos os rótulos SHALL deixar claro qual é qual.

#### Scenario: Board mostra os dois indicadores

- **WHEN** um projeto tem 33 folhas, nenhuma concluída, e avanço médio de 74%
- **THEN** o board apresenta "0 de 33 concluídos" e o avanço de 74% como indicadores distintos

#### Scenario: Escopo continua sendo conclusão

- **WHEN** o dashboard calcula a box de progresso e escopo
- **THEN** ela continua comparando folhas concluídas com o escopo total, sem incorporar o avanço

#### Scenario: Barras de agrupador usam o avanço

- **WHEN** uma história tem folhas em `IN_PROGRESS` e nenhuma concluída
- **THEN** a barra da história reflete o avanço, e não 0%

### Requirement: Configuração do peso de avanço

O sistema SHALL permitir editar o peso de avanço de cada coluna nas configurações do projeto, ao lado do status base, exibindo o valor derivado como sugestão e oferecendo a restauração do valor derivado. A alteração SHALL refletir nos indicadores de avanço sem exigir recarregar a aplicação.

#### Scenario: Editar o peso de uma coluna

- **WHEN** um ADMIN altera o peso de "A Testar" para 80 nas configurações do projeto
- **THEN** os indicadores de avanço do board, da árvore e do dashboard passam a usar 80

#### Scenario: Restaurar o valor derivado

- **WHEN** um ADMIN restaura o peso derivado de uma coluna
- **THEN** a coluna volta a usar o valor calculado a partir do status base e da posição

#### Scenario: Sem permissão de administração

- **WHEN** um usuário sem papel de administração abre as configurações do projeto
- **THEN** ele não consegue alterar o peso da coluna

### Requirement: Avanço no dashboard

O dashboard SHALL apresentar o avanço do projeto como indicador próprio, calculado pela regra do peso de coluna, ao lado da box de progresso e escopo. A apresentação SHALL informar que se trata de avanço no fluxo e não de entrega concluída.

#### Scenario: Avanço com cards em progresso

- **WHEN** o dashboard é aberto em um projeto com folhas em `IN_PROGRESS` e nenhuma concluída
- **THEN** o indicador de avanço mostra o percentual derivado das colunas, distinto do 0% de conclusão

#### Scenario: Avanço respeita filtros aplicáveis

- **WHEN** o usuário aplica filtros de módulo, sprint, versão, squad, responsável ou tipo
- **THEN** o avanço é recalculado sobre a mesma população filtrada usada pelos demais quadros
