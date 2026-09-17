## Context

O Dashboard monotipicamente faz agregação em memória: `/snapshot` carrega itens + todos os eventos e, para cada item bloqueado, filtra o array completo de eventos; `/burnup` recria `[...state.values()]` para cada evento; `/aging` faz `JSON.parse` das snapshots por item×evento; `/hours` filtra linhas em memória. `population()` carrega todos os itens e descarrega o conceito de folha em memória.

Constraints: manter respostas públicas idênticas; SQLite atual (WAL, single-instance) com `[DB-SWAP]` anotado; tabela `item_events` append-only com baseline de cobertura por projeto (`project_analytics_coverage`); o mesmo serviço `appendAnalyticsEvent` é o único ponto de escrita de eventos; o fluxo do Azy Agent também usa analytics; migrations são append-only com guard de `pragma_foreign_key_check`.

## Goals / Non-Goals

**Goals:**

- Complexidade O(eventos) uma única vez (no backfill/rollup) e leituras O(dias×dimensão) nas consultas.
- Rollup diário incrementando na mesma transação do evento (sem worker, sem drift).
- `/snapshot` e `/aging` sem varredura completa de eventos por item via SQL dirigida.
- `/burnup` sem filtros servido por rollups; com filtros, replay otimizado por deltas.
- `/hours` com agregação SQL e limite de linhas.
- Limites de resposta documentados (top blocked 10; demais limites para listas grandes).

**Non-Goals:**

- Não alterar formato/contrato das respostas HTTP existentes.
- Não introduzir materialized views do PostgreSQL nem migrar banco agora.
- Não implementar compactação/poda de eventos antigos (item de backlog separado, indicado na análise).
- Não alterar o mecanismo de cobertura (`ANALYTICS_BASELINE` + `project_analytics_coverage`).

## Decisions

### Rollup diário transacional (`project_metrics_daily`)

Tabela com (tenant, projeto, data) e contagens por status + pontos por status, restritos a itens folha elegíveis. `appendAnalyticsEvent` atualiza a linha do dia na MESMA transação do evento (deltas de entrada/saída de status, ajuste de pontos, exclusão e arquivamento decrementam). O backfill da migration 0024 recalcula a partir da baseline e dos eventos existentes (idempotente, limitado pelo `coverageStartedAt`).

Alternativa considerada: worker reproduzindo eventos fora da transação — rejeita por risco de drift com SQLite; a escrita transacional elimina reconciliação.

### Baseline tratada como evento

O `ANALYTICS_BASELINE` repovoia o rollup com o estado inicial (subtrai nada, define por dia da cobertura). O backfill replaya baseline + eventos uma única vez.

### Consulta SQL para transições

`BLOCKED` do snapshot: SELECT por eventos com tipo STATUS_CHANGED filtrado por JSON contendo `'"BLOCKED"'` (constraint pragmática do SQLite sem índice por expressão; no PostgreSQL, usar `jsonb`). Filtre `item_id IN (bloqueados atuais)` — conjunto pequeno. `AGE`: para cada WIP item, assinatura equivalente via SELECT correlacionado ao limite 1 por itemId (jointura por índice novo `item_events(tenant, project, item, occurred)`), evitando `JSON.parse` repetido (single parse por linha buscada).

Alternativa considerada: manter replay em memória com mapa de parsed snapshots uma vez — caminho de contingência caso a consulta SQL com filtro sobre `after_snapshot` degrade; medir antes de trocar.

### Burnup incremental

Sem filtros (caminho padrão do gráfico): buscar rollups e `fillDailySeries`. Com filtros: replay de eventos entre `from`/`to` mantendo Map de estado e atualizando contadores do dia com deltas de quem entrou/saiu, O(1) por evento, sem recriar arrays por evento. Baseline do período aplicada uma vez.

### Rates de horas por SQL

`/hours`: GROUP BY por (authorId) e soma durationMin na agregação SQL ao nível de autors; detalhamento das linhas limitado (`limit` query, padrão 500) com total permanecendo SQL.

## Risks / Trade-offs

- [Drift de rollup] Erro de código pode deixar rollup divergente → função de recompute idempotente por projeto + teste comparativo rollup vs replay (gate de teste).
- [LIKE sobre JSON] Fragilidade de busca de status — mitigado por payload controlado pela própria API (`STATUS_CHANGED` grava status em `after_snapshot`); coberto por teste.
- [Migração em base grande] Backfill replaya histórico — operação one-shot com guard de foreign_key_check e limite de tempo testado em base sintética.
- [Contrato preservado mas sutilmente diferente] Ordenação de linhas deve ser determinística (ORDER BY explícito em lugar de ordem de filtragem em memória).
- [Rollup no caminho quente de TODAS as mutações] +1 upsert por evento: custo pequeno, mas monitorar; o upsert usa `ON CONFLICT DO UPDATE` idempotente.

## Migration Plan

1. Migration 0024: criar `project_metrics_daily` + índices (`item_events` otimizador, `item_logs` por created_at/tenant) + backfill idempotente para projetos com cobertura.
2. Serviço de rollup transacional plugado ao `appendAnalyticsEvent` com gate de prefixo de evento.
3. Reescrever endpoints por partes (snapshot → aging → burnup sem filtro → burnup com filtro → hours), com testes de contrato comparativos (testes de igualdade de saída entre composições antigas e novas sobre as mesmas seeds).
4. Deploy: backup, migration automática no startup, verificação de métricas contra banco em produção via `PRAGMA foreign_key_check` e contagens.
5. Rollback: reverter app (migrations anteriores permanecem); tabela rollup pode ficar órfã sem dano (leitura é opt-in pelo código novo).

## Open Questions

- Retenção/compactação de `item_events` (quando podar eventos > N dias) — fora desta change, mas o design de rollup já suporta.
- Tamanho de limite padrão para `/hours` (proposta inicial: 500 linhas) a confirmar com uso real.
