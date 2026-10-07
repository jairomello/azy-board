# dashboard-performance-budget Specification

## Purpose
TBD - created by archiving change escalar-metricas-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Benchmark reproduzível com metas por perfil
O projeto SHALL manter benchmark autenticado determinístico dos endpoints snapshot, aging, hours, sprint e burnup, sem usar banco de desenvolvimento. A referência versionada v2 é Linux no host local Intel i5-13420H, 12 vCPU, ~16 GiB de RAM reportada, SSD NVMe, PostgreSQL/Valkey co-localizados; comparação só vale quando o runner confirmar estes recursos e `DASHBOARD_BENCHMARK_REFERENCE_HARDWARE=1` estiver declarado. Para a versão atual, as metas aceitas SHALL ser por recorte: SIMPLE com 10 mil folhas, 2 mil agregadores, 100 mil eventos e concorrência 5 — p95 de até 1.000 ms snapshot, 600 ms aging, 500 ms hours/sprint e 1.000 ms burnup; ADVANCED com 100 mil folhas, 20 mil agregadores, 1 milhão de eventos e concorrência 20 — snapshot/all 2.000 ms, snapshot/filtered 900 ms, aging/all 1.300 ms, aging/filtered 350 ms, hours/all 700 ms, hours/filtered 850 ms, sprints/cycles 25 ms, sprint/cycle 500 ms e burnup 1.500 ms. Os limites ADVANCED v3 foram aceitos pelo usuário com base nas três rodadas integrais medidas nesta versão, arredondados com margem sobre os p95 observados; otimizações adicionais ficam no backlog de versões futuras. O incremento de RSS do processo medido SHALL permanecer até 256 MiB SIMPLE e 512 MiB ADVANCED. Comparação de aceite exige todas as rodadas completas da versão e nenhum erro.

#### Scenario: Execução reproduzível
- **WHEN** o benchmark é iniciado com perfil, seed e versões fixados
- **THEN** cria dados descartáveis isolados por tenant/projeto, aquece 30 segundos, executa três rodadas de 120 segundos por endpoint/recorte e registra hardware, SHA, seed, p50/p95/p99, erros, RSS, bytes e consultas

#### Scenario: Orçamento excedido
- **WHEN** qualquer rodada na referência excede meta de p95/memória ou contém erros inesperados
- **THEN** a comprovação do perfil falha com relatório da rodada, sem ocultar a falha por média entre execuções

#### Scenario: Ambiente diferente da referência
- **WHEN** o benchmark é executado em hardware distinto
- **THEN** o relatório declara a diferença e seus resultados não substituem a comprovação exigida na referência

### Requirement: Custo limitado e equivalência verificável
Os caminhos comuns SHALL usar consultas agregadas e projeções históricas limitadas por período/checkpoint sem carregar todas as folhas ou todo o histórico no processo HTTP. A suíte SHALL verificar crescimento não N+1, ausência de replay integral no hot path, isolamento e equivalência com oráculo de referência para todos os filtros suportados, vazio, mudanças de dimensão, reabertura, exclusão, arquivamento e cobertura parcial. O total SHALL considerar a população inteira; respostas comuns SHALL respeitar 256 KiB e detalhes de 50 itens padrão, no máximo 100 por página.

#### Scenario: Aumento de população
- **WHEN** fixtures aumentam dez vezes a população mantendo recorte e página
- **THEN** a quantidade de consultas do endpoint não cresce por item e as linhas hidratadas para detalhe continuam limitadas à página

#### Scenario: Histórico filtrado
- **WHEN** burnup usa período limitado após longa cobertura e dimensões alteradas no histórico
- **THEN** a leitura usa checkpoint/deltas ou projeção agregada limitada e reproduz a série do oráculo sem replay desde a baseline no processo HTTP

#### Scenario: Populações e cobertura
- **WHEN** dados contêm bloqueados, WIP, atrasados, pontos desconhecidos e cobertura iniciada após o início solicitado
- **THEN** resultados preservam sobreposição WIP/bloqueados, avisos de parcialidade e os mesmos números no Dashboard e ferramenta do agente

#### Scenario: Item em múltiplas sprints selecionadas
- **WHEN** um item pertence historicamente a duas sprints e o filtro seleciona ambas
- **THEN** a projeção conta o item uma vez por dia, preservando união dentro da dimensão e interseção entre dimensões sem somar duplicatas

