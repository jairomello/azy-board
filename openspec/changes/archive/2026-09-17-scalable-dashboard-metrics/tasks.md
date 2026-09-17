## 1. Rollup diário

- [x] 1.1 Criar migration 0024 append-only com `project_metrics_daily` (tenant, projeto, data, contagens por status e pontos por status), índices e guard `PRAGMA foreign_key_check`.
- [x] 1.2 Criar índices de suporte: `item_events(tenant_id, project_id, item_id, occurred_at)` e `item_logs(tenant_id, created_at)`.
- [x] 1.3 Implementar backfill idempotente (baseline + replay de eventos) para projetos com cobertura, executado pela migration.
- [x] 1.4 Plug-in do update incremental do rollup em `appendAnalyticsEvent`, na mesma transação do evento, cobrindo `ITEM_DELETED`, `ITEM_ARCHIVED`/`UNARCHIVED`, `STATUS_CHANGED` e ajuste de pontos.
- [x] 1.5 Adicionar comentários `[DB-SWAP]` (equivalente PostgreSQL: recompute por refresh/materialized view) e `[TENANT]` nos pontos de escopo.

## 2. Reescrita dos endpoints

- [x] 2.1 `/snapshot`: agregações por SQL (contagens/pontos por status) e transições `BLOCKED` por consulta dirigida aos itens bloqueados, preservando ordenação por idade e `minimumKnown`.
- [x] 2.2 `/aging`: início do ciclo ativo por consulta (último evento iniciador por item, único `JSON.parse` por linha consultada).
- [x] 2.3 `/burnup`: caminho sem filtros servido pelo rollup com `fillDailySeries`; caminho com filtros por replay com deltas incrementais por evento.
- [x] 2.4 `/hours`: totais por aggregates SQL, `limit` de linhas com padrão documentado e ordenação determinística.
- [x] 2.5 `/sprints/:cycleId`: replay do ciclo limitado por corte temporal, sem varredura completa além do necessário, mantendo campos de resposta.

## 3. Testes e contratos

- [x] 3.1 Testes de paridade: resposta dos 5 endpoints idêntica entre comportamento antigo e novo sobre seeds equivalentes (estados, pontos, sprints, eventos).
- [x] 3.2 Testes do rollup: múltiplos eventos no mesmo dia, exclusão/arquivamento, movimento entre statuses, reinício após falha e comparativo rollup vs replay (gate de drift).
- [x] 3.3 Teste do backfill: base vazia, base com eventos legados e reexecução da migration idempotente, com `PRAGMA foreign_key_check` limpo.
- [x] 3.4 Teste sintético de performance: gerar N itens e N eventos grandes e demonstrar melhoria de custo (timestamp de execução) das rotas críticas.

## 4. Verificação e deploy

- [x] 4.1 Rodar `bun run check` completo.
- [x] 4.2 Rodar `bun run test:smoke` (smoke de web/API) e suítes de migration/integridade.
- [x] 4.3 Backup prévio no LabApps, deploy (`deploy-all.sh azyboard`) e validação dos endpoints públicos do Dashboard sob `/azyboard/`.
- [x] 4.4 Atualizar a documentação de analytics/dashboard com o rollup e o gate de drift.
