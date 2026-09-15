## Why

Os endpoints de Dashboard (`/snapshot`, `/hours`, `/burnup`, `/aging`, `/sprints/:cycleId`) carregam todos os itens e todos os eventos do projeto e agregam em memória, com padrões O(itens×eventos) e múltiplos `JSON.parse` repetidos (`apps/api/src/routes/dashboard.ts`). Com histórico grande o projeto degrada rapidamente: o Item 13 da análise do sistema (`docs/ANALISE-SISTEMA.md`, seção 13) recomenda projeções, agregação SQL e limites antes que o volume de eventos torne a tela inutilizável.

## What Changes

- Substituir agregações em memória por consultas SQL agregadas (`GROUP BY`) para contagens, pontos e horas, mantendo o contrato de resposta.
- Adicionar tabela de rollup diário por projeto (`project_metrics_daily`), maintida na mesma transação de cada evento de analytics (atualização incremental, sem worker).
- Servir `/burnup` sem filtros a partir dos rollups com backfill inicial; caminho com filtros continua por replay, mas com o estado incremental (delta por evento em vez de array completo por evento).
- Resolver transições `BLOCKED` do `/snapshot` e o início do ciclo ativo do `/aging` por consulta SQL dirigida, nunca varrendo todos os eventos por item.
- Limitar tamanhos de resposta (top blocked, linhas de hours) sem quebrar contratos; adicionar índices de suporte (`item_events` por itemId, `item_logs` por período).
- Backfill determinístico de rollups a partir do histórico já coberto (`project_analytics_coverage`) na migration, idempotente.

## Capabilities

### New Capabilities

- `dashboard-metric-rollups`: rollups diários incrementais e consultas agregadas do Dashboard com limites de resposta.

### Modified Capabilities

- Nenhuma. Os contratos públicos dos endpoints de Dashboard não mudam (mesma resposta, mesma filtragem); o comportamento de serviço é interno.

## Impact

- `apps/api/src/routes/dashboard.ts` (todos os 5 endpoints), `apps/api/src/services/analytics.ts` (ponto de escrita de eventos, para o rollup transacional).
- Migration append-only `0024` no SQLite (tabela de rollup + índices), compatível com `[DB-SWAP]` para PostgreSQL.
- Testes de contratos (respostas idênticas ao comportamento atual), testes de backfill e benchmark sintético de eventos grandes.
- Deploy no LabApps com backup prévio; nenhum endpoint novo e nenhum degradation de permissão.
- Frontend não muda (respostas mantêm o formato).

Board ref: 49e58bde-a5e6-41a9-a21f-85f500ab8042
