# dashboard-metric-rollups Specification

## Purpose
TBD - created by archiving change scalable-dashboard-metrics. Update Purpose after archive.
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

Os endpoints do Dashboard SHALL resolver contagens, agrupamentos e transições por consultas SQL dirigidas ao acervo/tabelas base, eliminando varreduras completas de eventos por item. As listas de detalhe SHALL ter limite determinístico documentado, e os totais SHALL permanecer calculados sobre a população completa.

#### Scenario: Snapshot sem varredura completa de eventos
- **WHEN** `/snapshot` calcula detalhes de itens bloqueados
- **THEN** os eventos consultados são apenas os dos itens bloqueados atuais, por consulta SQL, e os totais das boxes são calculados por agregação SQL do estado atual

#### Scenario: Burnup sem filtros via rollup
- **WHEN** `/burnup` é consultado sem filtros
- **THEN** a série diária é servida a partir do acervo diário com preenchimento contínuo de dias e retorna os mesmos valores do replay anterior durante o período de cobertura

#### Scenario: Burnup com filtros por replay incremental
- **WHEN** `/burnup` é consultado com filtros (módulo, sprint, versão ou tipo)
- **THEN** o replay do estado do período avança por deltas por evento, sem recriar a população completa por evento, e devolve os mesmos valores atuais

#### Scenario: Aging sem parse repetido
- **WHEN** `/aging` calcula o início do ciclo ativo de itens em WIP
- **THEN** apenas um evento por item (o último iniciado) é determinado por consulta, e a resposta mantém o formato e os campos `startedAt`/`ageHours`/`minimumKnown`

#### Scenario: Hours agregado em SQL
- **WHEN** `/hours` entrega totais e linhas de trabalho manual
- **THEN** os totais são calculados por agregação SQL e as linhas respeitam um limite configurável com ordenação determinística

### Requirement: Contratos de resposta preservados

Os endpoints `/snapshot`, `/hours`, `/burnup`, `/aging` e `/sprints/:cycleId` SHALL continuar respondendo os mesmos campos e estruturas públicas atuais, com filtragem por tenant obrigatória, e SHALL respeitar os filtros existentes (módulo, versão, responsável, tipo, sprint, squad) e a validação de período (máximo 366 dias).

#### Scenario: Resposta idêntica sob carga trivial
- **WHEN** o dashboard é consultado em um projeto pequeno antes e depois da refatoração
- **THEN** a estrutura de resposta permanece compatível (mesmos campos, mesmos `filters.applied`/`inapplicable`), com valores iguais

#### Scenario: Isolamento por tenant mantido
- **WHEN** consultas agregadas (SQL ou acervo) são executadas
- **THEN** toda leitura é limitada por `tenantId` e `projectId`, inclusive o acervo diário e o backfill

