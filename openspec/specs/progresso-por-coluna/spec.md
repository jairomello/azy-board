# progresso-por-coluna Specification

## Purpose

Definir como o avanço do trabalho é derivado da posição do card no fluxo, para que itens sem checklist também apresentem progresso, mantendo a conclusão como indicador separado.

## Requirements

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

- **WHEN** um projeto tem colunas `NOT_STARTED`, `PLANNED` e `DONE`
- **THEN** as colunas não iniciadas e planejadas valem 0 e a coluna concluída vale 100

#### Scenario: Planejado não entra na faixa do fluxo

- **WHEN** um projeto tem `PLANNED` entre `NOT_STARTED` e `IN_PROGRESS`
- **THEN** a coluna `PLANNED` vale 0 e não consome posição na distribuição 50–90 das colunas em progresso

### Requirement: Cálculo do avanço de um card

O sistema SHALL calcular o avanço de um card a partir do **status** do card, que define a faixa, refinada pela coluna compatível e pelo peso explícito configurado na coluna (requisito "Status define a faixa de avanço"). O checklist SHALL NOT influenciar o percentual de avanço em nenhum cálculo. Agrupadores SHALL apresentar a média do avanço de todas as folhas válidas abaixo deles (folhas não canceladas e não arquivadas), o que equivale à média das filhas ponderada pelo número de itens; agrupador sem folhas SHALL apresentar 0%.

#### Scenario: Card sem checklist usa o peso da coluna

- **WHEN** um card está em "A Testar", cujo peso é 90
- **THEN** seu avanço é 90%

#### Scenario: Checklist afina dentro da faixa da coluna

- **WHEN** um card em "Fazendo" (faixa de 0 a 50) tem 5 de 10 itens de checklist marcados
- **THEN** seu progresso continua 50%, e o percentual do checklist aparece apenas na barra própria de checklist

#### Scenario: Marcar itens nunca reduz o avanço

- **WHEN** um card passa a ter um checklist com nenhum item marcado
- **THEN** seu progresso permanece o mesmo que o card sem checklist teria naquela coluna

#### Scenario: Checklist completo não eleva a faixa

- **WHEN** um card em "Fazendo" tem todos os itens de checklist marcados
- **THEN** seu avanço continua 50%, e não sobe para o peso da próxima coluna

#### Scenario: Agrupador calcula a média das folhas

- **WHEN** uma história tem três folhas com avanço 90%, 90% e 0%
- **THEN** a história apresenta 60%

#### Scenario: Agrupador sem folhas

- **WHEN** um item agrupador não possui folha `TASK`/`BUG` descendente
- **THEN** seu avanço é 0%, sem erro

### Requirement: Avanço e conclusão como indicadores distintos

O sistema SHALL manter a conclusão calculada como a proporção de folhas com status `DONE` sobre o total de folhas não canceladas e não arquivadas, e SHALL apresentar o avanço como indicador separado. Escopo, burnup e a métrica de conclusão SHALL NOT ser redefinidos pelo avanço, e onde os dois indicadores aparecem juntos os rótulos SHALL deixar claro qual é qual.

#### Scenario: Board mostra os dois indicadores

- **WHEN** um projeto tem 33 folhas, nenhuma concluída, e avanço médio de 74%
- **THEN** o board apresenta "0 de 33 concluídos" e o avanço de 74% como indicadores distintos

#### Scenario: Escopo continua sendo conclusão

- **WHEN** o dashboard calcula a box de progresso e escopo
- **THEN** ela continua comparando folhas concluídas com o escopo total, sem incorporar o avanço

#### Scenario: Barras de agrupador usam o avanço

- **WHEN** uma história tem folhas em `IN_PROGRESS` e nenhuma concluída
- **THEN** a barra da história reflete o avanço, e não 0%

#### Scenario: Cancelado fora da conclusão

- **WHEN** um recorte tem duas folhas concluídas, uma não iniciada e uma cancelada
- **THEN** a conclusão apresenta "2 de 3 concluídos", sem contar a cancelada no total

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

### Requirement: Barra de avanço no card do Kanban

O card do Kanban SHALL exibir o avanço calculado pela regra por status (requisito "Status define a faixa de avanço") — o peso da coluna compatível, ajustado pelo peso explícito configurado, sem considerar checklist. Card cancelado ou arquivado SHALL NOT exibir avanço. O avanço exibido no card SHALL ser o mesmo valor que as lanes, a árvore e o dashboard apresentam para o mesmo item, e a barra SHALL NOT substituir o contador de checklist nem as barras secundárias de checklist e subtasks definidas em `kanban-card-layout`.

#### Scenario: Card sem checklist usa o peso da coluna

- **WHEN** um card sem checklist está em uma coluna `IN_PROGRESS` cujo peso é 90
- **THEN** a barra do card exibe 90%

#### Scenario: Checklist afina dentro da faixa da coluna

- **WHEN** um card em uma coluna cuja faixa é de 0 a 50 tem metade dos itens de checklist marcados
- **THEN** a barra principal exibe 50%, o contador de checklist segue visível e a barra de checklist mostra o progresso real do checklist

#### Scenario: Card e lane mostram o mesmo avanço

- **WHEN** uma lane e um dos seus cards estão na mesma coluna de peso 90
- **THEN** ambos exibem 90%, sem divergência entre card e agrupador

#### Scenario: Status manda quando a coluna não combina

- **WHEN** um card com status `IN_HOMOLOGATION` está na coluna Backlog, num projeto cuja coluna de homologação vale 90
- **THEN** a barra do card exibe 90%, e não 0%

#### Scenario: Card cancelado sem avanço

- **WHEN** um card tem status `CANCELLED`
- **THEN** o card não exibe a barra de avanço

#### Scenario: Card com checklist exibe barra própria

- **WHEN** um card tem checklist com itens e progresso 50%
- **THEN** a barra principal exibe 50% e a barra de checklist exibe a razão marcados/total, em estilo distinto

### Requirement: Status define a faixa de avanço

O avanço de um item SHALL ser definido pelo seu status, com a coluna apenas refinando dentro da faixa do status. `DONE` SHALL valer 100% em qualquer coluna. `NOT_STARTED` e `PLANNED` SHALL valer 0% em qualquer coluna. `IN_PROGRESS` e `IN_HOMOLOGATION` SHALL usar a faixa da própria coluna quando o `baseStatus` dela for o mesmo do item; caso contrário, SHALL usar a faixa da primeira coluna do projeto com esse status e, se não houver nenhuma, 50% para `IN_PROGRESS` e 90% para `IN_HOMOLOGATION`. `BLOCKED` SHALL usar a faixa da própria coluna quando ela for do fluxo e 0% fora do fluxo. `CANCELLED` e `ARCHIVED` SHALL ficar fora de qualquer indicador de progresso: nem somam nem entram no denominador. Item sem status informado SHALL manter a regra anterior, só pela coluna.

#### Scenario: Concluído parado no Backlog

- **WHEN** um card tem status `DONE` e continua na coluna Backlog
- **THEN** seu avanço é 100%

#### Scenario: Em homologação fora da coluna de homologação

- **WHEN** um card tem status `IN_HOMOLOGATION` e está na coluna Backlog, e a coluna "Em Homologação" vale 90
- **THEN** seu avanço é 90%

#### Scenario: Em andamento em coluna compatível

- **WHEN** um card tem status `IN_PROGRESS` e está em "A Testar", cujo peso é 63
- **THEN** seu avanço é 63%

#### Scenario: Em andamento fora do fluxo

- **WHEN** um card tem status `IN_PROGRESS` e está em "A Fazer", e a primeira coluna em andamento vale 50
- **THEN** seu avanço é 50%

#### Scenario: Não iniciado em coluna do fluxo

- **WHEN** um card tem status `NOT_STARTED` e está em "Fazendo"
- **THEN** seu avanço é 0%

#### Scenario: Bloqueado

- **WHEN** um card `BLOCKED` está em "Testando", cujo peso é 77, e outro card `BLOCKED` está em "A Fazer"
- **THEN** o primeiro vale 77% e o segundo vale 0%

#### Scenario: Cancelado fora do denominador

- **WHEN** um agrupador tem uma folha concluída e uma cancelada
- **THEN** o agrupador apresenta 100%, e a folha cancelada não exibe percentual

### Requirement: Folhas de progresso e mesma regra em todas as telas

Folha de progresso SHALL ser todo item sem filhos dos tipos `TASK`, `BUG`, `STORY` ou `EPIC`. `EXTERNAL` SHALL ficar fora do progresso e ser contada à parte. A STORY fixa do modo `SIMPLE` SHALL ser sempre contêiner, mesmo vazia. Árvore, lanes, card, cabeçalho de sprint, dashboard e listagem de projetos SHALL calcular o avanço pela mesma função de domínio, de modo que o mesmo recorte apresente o mesmo percentual em todas as telas.

#### Scenario: Story sem tarefas conta pelo próprio status

- **WHEN** uma STORY concluída não tem filhos
- **THEN** ela conta como uma folha de 100% no épico, no módulo e no projeto

#### Scenario: Dependência externa fora do avanço

- **WHEN** um épico tem uma dependência `EXTERNAL` concluída e uma TASK não iniciada
- **THEN** o épico apresenta 0%, e a dependência não exibe percentual próprio na árvore

#### Scenario: Mesmo percentual em todas as telas

- **WHEN** o mesmo projeto é aberto na árvore, no dashboard e na listagem de projetos
- **THEN** o avanço do projeto é o mesmo nas três telas

#### Scenario: Board usa a mesma população sem mudar os cards exibidos

- **WHEN** um épico tem uma história concluída sem tarefas, que não aparece como card no modo padrão do board
- **THEN** a lane do épico, a do módulo e o cabeçalho de progresso do board contam essa história, e os cards exibidos continuam os mesmos

#### Scenario: Média ponderada pelo número de itens

- **WHEN** um épico tem uma história com 1 folha concluída e outra história com 3 folhas não iniciadas
- **THEN** o épico apresenta 25%, e não a média simples das histórias (50%)
