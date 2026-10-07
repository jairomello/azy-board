# Dashboard — benchmark e operação das projeções

## Metas de aceite da versão atual

Referência v2 aprovada em 2026-10-07: Linux no host local Intel i5-13420H, 12 vCPU, ~16 GiB RAM reportada e SSD NVMe Samsung; PostgreSQL e Valkey/Redis co-localizados. Em 2026-10-07, o usuário aceitou os resultados ADVANCED medidos para a versão atual e aprovou budgets v3 por recorte. O runner só considera o host de referência se `DASHBOARD_BENCHMARK_REFERENCE_HARDWARE=1` for informado após confirmar hardware/serviços.

| Perfil | Acervo do projeto | Concorrência | p95 por recorte | Incremento máximo de RSS |
|---|---:|---:|---|---:|
| SIMPLE | 10.000 folhas, 2.000 agregadores, 100.000 eventos | 5 | snapshot 1.000 ms; aging 600 ms; hours/sprint 500 ms; burnup 1.000 ms | 256 MiB |
| ADVANCED (v3, versão atual) | 100.000 folhas, 20.000 agregadores, 1.000.000 eventos | 20 | snapshot/all 2.000 ms, filtered 900 ms; aging/all 1.300 ms, filtered 350 ms; hours/all 700 ms, filtered 850 ms; sprints/cycles 25 ms, sprint/cycle 500 ms; burnup 1.500 ms | 512 MiB |

Os limites SIMPLE de snapshot/aging foram revisados com margem após o baseline integral. Os budgets ADVANCED v3 refletem os p95 integrais aceitos pelo usuário para esta versão, com arredondamento de margem; a melhoria futura será acompanhada separadamente no Backlog. Resultados de hardware fora da referência são diagnósticos locais; não substituem a rodada de aceite. Não comparar médias entre rodadas: cada p95/limite de memória/erro é avaliado separadamente.

## Preparar um volume descartável

Use um banco SQLite ou PostgreSQL **exclusivo para benchmark**, com migrations aplicadas. Não aponte para o volume de desenvolvimento/produção. ADVANCED também exige um Redis/Valkey dedicado.

Exemplo SIMPLE:

```sh
export DASHBOARD_BENCHMARK_PROFILE=SIMPLE
export DASHBOARD_BENCHMARK_DATABASE_URL=/tmp/dashboard-benchmark.sqlite
export DASHBOARD_BENCHMARK_INSTANCE_DIR=/tmp/dashboard-benchmark-instance
export DASHBOARD_BENCHMARK_SEED=referencia-01

AZYBOARD_INSTALL_PROFILE=SIMPLE \
DATABASE_URL="$DASHBOARD_BENCHMARK_DATABASE_URL" \
AZYBOARD_INSTANCE_DIR="$DASHBOARD_BENCHMARK_INSTANCE_DIR" \
bun run db:migrate

bun run --cwd apps/api src/scripts/dashboard-benchmark.ts seed
bun run --cwd apps/api src/scripts/dashboard-benchmark.ts run
```

ADVANCED usa `DASHBOARD_BENCHMARK_DATABASE_URL=postgresql://...` e `DASHBOARD_BENCHMARK_REDIS_URL=redis://...`; aplique migrations com `AZYBOARD_INSTALL_PROFILE=ADVANCED`, `DATABASE_URL`, `REDIS_URL` e `bun run db:migrate:pg` antes de `seed`/`run`.

Para ADVANCED com concorrência 20, assegure pelo menos 1 GiB em `/dev/shm` no container PostgreSQL. O padrão Docker de 64 MiB foi reproduzido causando falhas de alocação POSIX de memória compartilhada em consultas paralelas e respostas HTTP 500. `docker-compose.advanced.yml` configura `shm_size: 1gb`; após atualizar uma instalação existente, recrie o serviço PostgreSQL pelo procedimento de rollout documentado, preservando o volume de dados. Não reduza workers paralelos como workaround silencioso do benchmark.

Somente declare `DASHBOARD_BENCHMARK_REFERENCE_HARDWARE=1` quando Linux/12 vCPU/~16 GiB/NVMe e serviços co-localizados tiverem sido confirmados. Nessa declaração, cada rodada reprova individualmente se p95/RSS exceder o orçamento ou houver erro; fora dela, as rodadas ficam `INFORMATIVE` mesmo quando não há erros.

Cada execução de seed cria tenants/projeto isolados e grava o manifesto em `artifacts/dashboard-benchmark/manifest.json` (permissão `0600`). O runner consulta uma janela de até 366 dias com baseline, filtros de módulo/versão/sprint/tipo, conjunto de sprint IDs, logs manuais, itens atrasados e cobertura deliberadamente parcial. Volumes padrão seguem a tabela. `DASHBOARD_BENCHMARK_LEAVES`, `DASHBOARD_BENCHMARK_AGGREGATORS` e `DASHBOARD_BENCHMARK_EVENTS` permitem fixtures menores para smoke; elas não servem para aprovação.

O runner autentica chamadas Hono por cookie de sessão e, por padrão, aquece 30 s e executa três rodadas de 120 s por cada um dos dez recortes (`snapshot`, `aging`, `hours`, ciclos/sprint e burnup sem/com filtro), na concorrência do perfil. O relatório registra hardware, versões, SHA, seed, p50/p95/p99/máximo, erros, bytes, RSS e planos `EXPLAIN`. `DASHBOARD_BENCHMARK_WARMUP_SECONDS`, `DASHBOARD_BENCHMARK_ROUNDS`, `DASHBOARD_BENCHMARK_ROUND_SECONDS` e `DASHBOARD_BENCHMARK_CONCURRENCY` existem para smoke local. O modo `app.fetch` mede handlers autenticados no processo API; o RSS reportado inclui o driver local do benchmark e deve ser interpretado como smoke, não como medição isolada de serviço em produção.

## Backfill e canary das projeções filtradas

1. Aplique a migration correspondente ao perfil. As tabelas novas são aditivas; o `project_metrics_daily` continua como fonte do burnup sem filtros.
2. Execute primeiro em um único projeto descartável/canary:

   ```sh
   bun run --cwd apps/api src/scripts/backfill-dashboard-dimensions.ts <projectId>
   ```

3. Confirme `project_analytics_dimension_meta.status = 'READY'`, `projection_version = 1` e compare os recortes filtrados à suíte-oráculo antes de ampliar o lote. Sem estado `READY`, o endpoint mantém o replay histórico e sinaliza `projection.status = 'FALLBACK'` com `DASHBOARD_DIMENSION_PROJECTION_FALLBACK`; não responde com zero como se fosse completo.
4. O backfill é retomável por `last_sequence`, atualiza baseline e eventos em batches, e mantém estado/snapshots na mesma transação de projeção. Reexecutar em projeto `READY` é idempotente.

Para reverter a leitura otimizada de um único projeto, marque somente sua projeção como não pronta; não remova `item_events`, `project_metrics_daily` nem snapshots:

```sql
UPDATE project_analytics_dimension_meta
SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP
WHERE tenant_id = :tenant_id AND project_id = :project_id;
```

O Dashboard volta ao caminho de replay com aviso. Após a correção, rode novamente o backfill para esse `projectId`; não faça rollback removendo tabelas ou dados históricos.

## Evidência disponível nesta change

- SIMPLE: seed/runner autenticados em 20 folhas, 4 agregadores e 100 eventos, 10 recortes, zero respostas não-2xx; host local reportou Intel i5-13420H, 12 vCPU e ~15,3 GiB RAM, portanto **não é a referência**.
- ADVANCED: PostgreSQL/Valkey descartáveis, mesmas dimensões de smoke, migration completa, backfill até `READY` e runner autenticado antes/depois do backfill; zero erros HTTP. A fixture pequena também validou a rota PostgreSQL com a projeção ativa.
- ADVANCED integral na referência v2, em PostgreSQL descartável com `/dev/shm` de 1 GiB e projeção READY: 20 requisições simultâneas de probe retornaram 20× HTTP 200. As rodadas tiveram zero erros, RSS máximo incremental de 94 MiB e p95 por recorte: snapshot/all 1.826–1.917 ms; snapshot/filtered 717–835 ms; aging/all 1.204–1.263 ms; aging/filtered 265–289 ms; hours/all 577–624 ms; hours/filtered 786–791 ms; sprints/cycles 13.6–17.6 ms; sprint/cycle 414–447 ms; burnup 36–43 ms. O usuário aceitou estes resultados para esta versão; o runner aplica agora budgets v3 acima. Relatório original, com budgets anteriores: `/tmp/opencode/azyboard-t41-adv-report.json`; reavaliação transparente dos mesmos 30 p95 sob v3: `/tmp/opencode/azyboard-t41-adv-v3-accepted.json` (não é uma nova execução).
- SIMPLE otimizado integral na referência v2, projeção READY: zero erros, RSS máximo incremental de 40,4 MiB e gate **PASS** em todos os recortes. p95 por rodada: snapshot/all 799–836 ms; snapshot/filtered 242–262; aging/all 482–545; aging/filtered 110–115; hours/all 87–104; hours/filtered 112–118; sprints/cycles 7–8; sprint/cycle 196–211; burnup/rollup 12–14; burnup/filtered 26–27 ms. Relatório completo: `/tmp/opencode/azyboard-t41-simple-report.json`.
- Backfill integral inicial (custo único por projeto): SIMPLE 58.586 ms para 12.000 snapshots/item (24 estados, 8.731 snapshots); ADVANCED 1.769.417 ms para 120.000 snapshots/item (48 estados, 17.520 snapshots). Reexecutar em `READY` é idempotente; o smoke SIMPLE repetido levou 3 ms. Esses tempos não medem a latência incremental de escrita online após a projeção estar pronta.
- O container PostgreSQL compartilhado de 64 MiB permaneceu intacto; `docker-compose.advanced.yml` agora declara 1 GiB para instalações ADVANCED. O SIMPLE otimizado completo passou. A melhoria para reduzir latência além do orçamento aceito nesta versão está no card T44 (`85443f8f-994b-4925-9be4-973e60a68fed`) em Backlog; os budgets atuais não se confundem com essa meta futura.
