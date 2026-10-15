# Spec Delta

## ADDED Requirements

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
