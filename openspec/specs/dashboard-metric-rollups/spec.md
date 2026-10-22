# dashboard-metric-rollups Specification

## Purpose
Sustentar as métricas e os tokens do Dashboard por rollup diário transacional e consultas agregadas com limite de resposta, preservando os contratos de resposta e o código sequencial no detalhe de itens.

## Requirements

### Requirement: Rollup diário transacional

O sistema SHALL manter, por tenant e projeto, um acervo agregado por dia (contagem e pontos por status de itens folha elegíveis) atualizado na MESMA transação em que cada evento de analytics é gravado. O acervo SHALL ser reconstruído por backfill idempotente para o histórico anterior à migration, limitado ao período coberto por `project_analytics_coverage`.

#### Scenario: Evento movimenta o rollup do dia
- **WHEN** uma mutação grava um evento de analytics (ex.: `STATUS_CHANGED` que conclui um item folha com pontos)
- **THEN** a contagem e os pontos do dia correspondente no acervo refletem o novo estado sem worker, consulta adicional ou leitura da fila

#### Scenario: Backfill do histórico
- **WHEN** a migration é aplicada em um projeto com cobertura anterior
- **THEN** o rollup reproduz as quatro métricas diárias (total/done/points/donePoints) a partir da baseline e dos eventos existentes; reaplicar a migration não duplica nem corrompe os valores

#### Scenario: Sem cobertura não há rollup
- **WHEN** um projeto ainda não iniciou cobertura de analytics
- **THEN** nenhuma linha de rollup é criada para ele

### Requirement: Consultas agregadas com limite de resposta

Os endpoints do Dashboard SHALL resolver contagens, agrupamentos e transições por consultas SQL dirigidas ao acervo/tabelas base, eliminando varreduras completas de eventos por item e hidratação integral de folhas no processo HTTP nos caminhos comuns. As listas de detalhe SHALL ter paginação por cursor opaco vinculado ao escopo/filtros, padrão de 50 e máximo de 100 registros, ordenação determinística com desempate por ID e metadados aditivos de continuidade/truncamento. Os totais SHALL permanecer calculados sobre a população completa. Respostas comuns SHALL limitar JSON a 256 KiB sem truncar silenciosamente séries temporais ou totais.

#### Scenario: Snapshot sem varredura completa de eventos
- **WHEN** `/snapshot` calcula detalhes de itens bloqueados
- **THEN** os eventos consultados são apenas os dos itens bloqueados atuais necessários à página, por consulta SQL, e os totais das boxes são calculados por agregação SQL do estado atual

#### Scenario: Burnup sem filtros via rollup
- **WHEN** `/burnup` é consultado sem filtros
- **THEN** a série diária é servida a partir do acervo diário com preenchimento contínuo de dias e retorna os mesmos valores do replay anterior durante o período de cobertura

#### Scenario: Burnup com filtros por replay incremental
- **WHEN** `/burnup` é consultado com filtros de módulo, sprint, versão ou tipo
- **THEN** utiliza projeções históricas agregadas ou checkpoint e deltas limitados ao período sem replay integral desde a baseline no processo HTTP, conserva atributos históricos e devolve os mesmos valores atuais e avisos de cobertura

#### Scenario: Aging sem parse repetido
- **WHEN** `/aging` calcula o início do ciclo ativo de itens em WIP
- **THEN** apenas um evento por item da página (o último iniciado) é determinado por consulta, e a resposta mantém os campos `startedAt`/`ageHours`/`minimumKnown`, totais completos e continuidade da lista

#### Scenario: Hours agregado em SQL
- **WHEN** `/hours` entrega totais e linhas de trabalho manual
- **THEN** os totais são calculados por agregação SQL da população inteira e as linhas respeitam paginação e ordenação determinística

#### Scenario: Cursor de outro recorte
- **WHEN** uma página é solicitada com cursor de outro tenant/projeto/filtro ou cursor inválido
- **THEN** a requisição é rejeitada por validação sem retornar dados de outro escopo

#### Scenario: Detalhes truncados não alteram totais
- **WHEN** snapshot ou sprint possui mais detalhes que o limite da página
- **THEN** os campos de totais mantêm a população completa e a resposta indica truncamento e acesso à continuação sem simular completude

### Requirement: Contratos de resposta preservados

Os endpoints `/snapshot`, `/hours`, `/burnup`, `/aging` e `/sprints/:cycleId` SHALL continuar respondendo os mesmos campos e estruturas públicas atuais, com filtragem por tenant obrigatória, e SHALL respeitar os filtros existentes (módulo, versão, responsável, tipo, sprint, squad) e a validação de período (máximo 366 dias).

#### Scenario: Resposta idêntica sob carga trivial
- **WHEN** o dashboard é consultado em um projeto pequeno antes e depois da refatoração
- **THEN** a estrutura de resposta permanece compatível (mesmos campos, mesmos `filters.applied`/`inapplicable`), com valores iguais

#### Scenario: Isolamento por tenant mantido
- **WHEN** consultas agregadas (SQL ou acervo) são executadas
- **THEN** toda leitura é limitada por `tenantId` e `projectId`, inclusive o acervo diário e o backfill

### Requirement: Código sequencial no detalhe de itens do dashboard

As listas de detalhe dos quadros do dashboard SHALL expor o código sequencial do item (`sequenceCode`) quando existir, de forma aditiva, mantendo os campos atuais. O código SHALL ser usado para rotular itens nos rankings e no detalhe, e SHALL NOT substituir o identificador técnico onde ele é necessário.

#### Scenario: Detalhe do aging traz o código

- **WHEN** o endpoint de aging devolve itens em WIP
- **THEN** cada item inclui `sequenceCode` além dos campos já existentes

#### Scenario: Detalhe de bloqueados traz o código

- **WHEN** o endpoint de snapshot devolve os itens bloqueados
- **THEN** cada item inclui `sequenceCode` quando o card tem código

#### Scenario: Item sem código não quebra a resposta

- **WHEN** um item não possui código sequencial
- **THEN** o campo vem nulo e o rótulo usa o título, sem erro

#### Scenario: Compatibilidade preservada

- **WHEN** um cliente antigo consome a resposta
- **THEN** os campos e estruturas anteriores continuam presentes com o mesmo significado

### Requirement: Rollup diário de tokens

O acervo agregado por dia SHALL acumular os tokens de entrada e de saída das folhas
elegíveis (total do escopo e recorte de itens concluídos), atualizado na MESMA transação
em que o evento de alteração de tokens é gravado. O acervo SHALL ser reconstruído por
backfill idempotente para o histórico anterior à migration, limitado ao período coberto, e
a projeção por dimensão SHALL passar a carregar os mesmos contadores, com reconstrução
idempotente no bump de versão.

#### Scenario: Evento de tokens atualiza o dia

- **WHEN** uma mutação altera tokens de uma folha elegível e grava o evento correspondente
- **THEN** os contadores de tokens do dia refletem o novo estado sem worker, consulta adicional ou leitura da fila

#### Scenario: Backfill idempotente

- **WHEN** a migration é aplicada em projeto com cobertura anterior
- **THEN** o acervo de tokens é reproduzido a partir da baseline e dos eventos existentes, e reaplicar a migration não duplica nem corrompe os valores

#### Scenario: Projeção de tokens reconstruída

- **WHEN** a projeção por dimensão é reconstruída no bump de versão
- **THEN** as dimensões passam a carregar tokens com os mesmos valores do replay para cada recorte histórico

#### Scenario: Isolamento do acervo de tokens

- **WHEN** o acervo e o backfill de tokens são lidos ou gravados
- **THEN** toda operação é limitada por `tenantId` e `projectId`

### Requirement: Série de tokens sem replay integral no hot path

A série de tokens sem filtros SHALL ser servida a partir do acervo diário e, com filtros
de módulo, sprint, versão ou tipo, a partir da projeção por dimensão pronta. Quando a
projeção não estiver pronta, a resposta SHALL declarar o replay de origem como fallback
com aviso, sem replay integral silencioso no processo HTTP.

#### Scenario: Série sem filtros

- **WHEN** a série de tokens é consultada sem filtros de dimensão
- **THEN** a resposta é montada a partir do acervo diário, com preenchimento contínuo de dias

#### Scenario: Série filtrada com projeção pronta

- **WHEN** a série é consultada com filtro de dimensão e a projeção está pronta
- **THEN** a resposta é montada a partir da projeção e declara a projeção utilizada

#### Scenario: Projeção indisponível

- **WHEN** a projeção não está pronta e a série filtrada é solicitada
- **THEN** a resposta declara o fallback e o aviso correspondente, sem ocultar a origem dos dados
