Board ref: 503e5a70-32a0-4de0-a78d-cb52f4b9c958

## Why

O rollup diário já atende burnup sem filtros, mas `apps/api/src/routes/dashboard.ts` ainda carrega populações e eventos para agregação/replay. A revisão de 2026-10-05 não mediu grandes volumes; é necessário estabelecer e demonstrar orçamentos sem alterar filtros, cobertura parcial ou populações sobrepostas.

## What Changes

- Definir benchmark determinístico por perfil, volumes, concorrência, p95, memória, consultas e tamanho de resposta; registrar resultados reais separadamente das metas propostas.
- Agregar folhas e transições nos adapters SQL e otimizar o burnup filtrado por projeções limitadas, preservando a semântica histórica.
- Paginar detalhes com cursor estável e manter totais sobre a população inteira; preservar amostras limitadas do agente e compatibilidade dos campos existentes.
- Acrescentar paridade semântica e gates contra N+1 e replay integral nos caminhos comuns.
- Depender de T36 para runtime ADVANCED e de T38 para alimentação transacional das projeções; não implementar boot nem outbox. Coordenar interfaces com T40.

## Capabilities

### New Capabilities
- `dashboard-performance-budget`: metas propostas, benchmark reproduzível e comprovação por perfil.

### Modified Capabilities
- `dashboard-metric-rollups`: substituir replay filtrado integral por leitura histórica limitada e exigir paginação determinística dos detalhes preservando totais.

## Impact

Afeta `apps/api/src/routes/dashboard.ts`, `apps/api/src/services/{dashboardMetrics,analytics}.ts`, `apps/api/src/persistence`, migrations dos dois perfis, `apps/web/src/pages/ProjectDashboardPage.tsx` e o adaptador de métricas em `packages/tool-execution/src/http-adapter.ts`. Scripts de benchmark e registros são paths futuros. Base: análise atualizada, spec `dashboard-metric-rollups` e change arquivada `2026-10-05-agent-dashboard-metrics`, que exige os mesmos números da tela e avisos de sobreposição. Sem migração entre perfis.
