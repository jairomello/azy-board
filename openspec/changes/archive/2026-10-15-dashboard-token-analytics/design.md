# Design

## Context

Ver `proposal.md` (Why/What). Estado atual que condiciona a abordagem:

- O Dashboard é por projeto (`/projects/:projectId/dashboard`), com rotas `snapshot`,
  `burnup`, `aging`, `hours` e `sprints` em `apps/api/src/routes/dashboard.ts`, todas
  `requireRole('VIEWER')`.
- O histórico já tem o padrão **snapshot de item → evento → acervo diário → projeção por
  dimensão**: `SqliteItemSnapshot`/`DashboardDimensionSnapshot` (estado por item),
  `item_events` (deltas), `project_metrics_daily` (acervo diário) e
  `project_analytics_dimension_state`/`_snapshots` (projeção por módulo/versão/sprint/tipo
  com `projection_version`) — ver `apps/api/src/db/sqlite/itemAnalytics.ts`,
  `services/dashboardMetrics.ts` e `services/dashboardDimensionProjection.ts`.
- **Tokens não participam desse pipeline**: `readItemSnapshot` não lê
  `tokens_input`/`tokens_output`, `eventByField` não tem evento de tokens (só
  `STATUS/POINTS/TYPE/VERSION/MODULE` e `SPRINT_CHANGED`) e o acervo/projeção não têm
  colunas de tokens. Alterar tokens hoje só gera log de atividade (`card-activity-log`).
- O modelo do campo de tokens é `SET` (valores absolutos, total derivado da soma, nunca
  persistido) — ver `utils/tokens.ts` e a spec `card-token-tracking`.
- `item_events.event_type` é um enum no schema Drizzle e tem CHECK constraint no
  PostgreSQL; o acervo é reconstruído de forma idempotente por `recomputeProjectRollup`.
- A projeção por dimensão é liberada só com `projection_version === 1` e status `READY`.

## Goals / Non-Goals

**Goals:**

- Expor recortes de tokens (estado atual) e série diária no Dashboard do projeto,
  reutilizando o pipeline de analytics e o envelope de filtros/cobertura existente.
- Capturar histórico de tokens a partir da implantação sem inventar consumo anterior.
- Manter paridade de números entre tela, rollup e ferramenta do agente.

**Non-Goals:**

- Alterar o modelo do campo de tokens do card (segue `SET`, anulável, total derivado).
- Visões de tokens fora do projeto (cross-project/tenant).
- Tornar tokens um contador incremental de consumo; a série é de **estado registrado**.

## Decisions

### D1. Estender o pipeline de analytics existente (não criar métrica paralela)

Tokens passam a integrar `SqliteItemSnapshot`/`DashboardDimensionSnapshot`,
`item_events`, `project_metrics_daily` e a projeção por dimensão, com o mesmo mecanismo de
deltas, backfill idempotente e isolamento por tenant/projeto.

- **Por quê**: série no tempo com filtros exige deltas históricos; duplicar o maquinário
  em uma tabela só de tokens recriaria backfill, cobertura, cursor e isolamento.
- **Alternativas**: (a) calcular tokens só do estado atual dos itens — atende os recortes,
  mas não a série; (b) tabela `project_token_metrics_daily` dedicada — mais simples de
  migrar, porém cria um segundo caminho de cobertura/backfill e divergência de regra.

### D2. Tokens são estado, não acumulador

As colunas de tokens no acervo armazenam a **soma dos valores registrados** no escopo ao
fim do dia (e o recorte de itens `DONE`), análoga a `points`/`donePoints`. Reduzir ou
limpar tokens **diminui** a série na data da alteração.

- **Por quê**: os campos são gravados por `SET`; tratá-los como acumulador contrariaria a
  regra vigente de total derivado e produziria séries irreconciliáveis com o card.
- **Consequência de rótulo**: o quadro fala em "tokens registrados", não em "consumo
  acumulado".

### D3. Evento único `TOKENS_CHANGED` por mutação

Adicionar `TOKENS_CHANGED` ao enum de `item_events` e emitir **um** evento por edição que
altere tokens, carregando `before`/`after` completos (ambos os lados), no mesmo
encadeamento usado por `SPRINT_CHANGED`. A **criação** de um item com tokens é capturada
pelo próprio evento de criação (o snapshot do item já carrega os tokens); editar (individual
ou em lote) e limpar tokens emitem o evento de alteração. Entradas rejeitadas não geram evento.

- **Por quê**: um evento por lado (`POINTS_CHANGED`-like) duplicaria registros para uma
  única alteração e inflaria o acervo com deltas nulos.
- **Migração**: o CHECK constraint do PostgreSQL em `item_events.event_type` precisa ser
  recriado incluindo `TOKENS_CHANGED` (SQLite não tem CHECK; atualizar o enum do Drizzle).

### D4. Projeção por dimensão com bump de versão

Incrementar `projection_version` (1 → 2) e adicionar as colunas de tokens a
`project_analytics_dimension_state`/`_snapshots`. Os gates que hoje exigem
`projection_version === 1` passam a aceitar a versão corrente, e a reconstrução
idempotente popula tokens.

- **Por quê**: a série filtrada por módulo/sprint/versão/tipo é servida pela projeção;
  sem tokens nela, o recorte filtrado cairia em replay integral (proibido no hot path).
- **Custo**: o primeiro acesso após a migration dispara rebuild; mitigado pelo estado
  `BUILDING`/`READY` já existente e pela reconstrução idempotente.

### D5. Cobertura de tokens declarada, sem histórico retroativo

`tokensInput`/`tokensOutput` nunca foram capturados antes desta change. A série de tokens
começa em `tokensStartedAt` (a data de início da cobertura de tokens, igual ou posterior a
`coverageStartedAt`). O backfill **semeia** o acervo com os valores atuais dos itens na
data de início da cobertura e faz carry-forward, em vez de reconstruir dia a dia um
consumo que não existe.

- **Por quê**: fabricar série anterior violaria `project-dashboard` ("não fabrica o valor")
  e a spec da capability.
- **Consequência**: tokens registrados antes da implantação aparecem atribuídos à data de
  início da cobertura, e a resposta sempre traz `partial: true` enquanto essa data for
  posterior ao início do projeto.

### D6. Endpoint dedicado `GET /projects/:projectId/dashboard/tokens`

Nova rota no `dashboardRouter` que devolve, em uma resposta: recortes de estado atual
(total, por status, por tipo e agrupamentos por módulo/sprint/versão/squad/responsável),
série diária (tokens registrados e tokens de concluídos por dia), cobertura
(`coverageStartedAt`, `tokensStartedAt`, `partial`), `projection` (status/versão/origem) e
`filters: { applied, inapplicable }` — período inaplicável aos recortes, aplicável à série.
Detalhes usam o cursor e os limites já existentes (`dashboardCursor`, padrão 50, máximo
100), com totais sobre a população completa.

- **Por quê**: um endpoint próprio mantém `snapshot`/`burnup` estáveis (contratos
  preservados) e concentra a semântica de tokens.
- **Alternativas**: adicionar `tokens` ao `snapshot` (mistura estado atual com série e
  quebra o contrato de filtros do snapshot) ou reusar `burnup` (perde recortes por
  status/dimensão).

### D7. MCP `metric: tokens`

`get_dashboard_metrics` ganha `tokens` no enum, mapeado para a nova rota, com
`dashboardCriteria`/`dashboardPopulations` próprios e cobertura parcial preservada; segue
classificada como leitura, sem aprovação.

### D8. Web: quadro dedicado no padrão existente

Novo `DashboardCard` ("Tokens de IA") no `ProjectDashboardPage`, com adaptador em
`dashboardAdapters.ts`, tipos em `@azy-board/ui-contracts`, gráfico da série (reuso de
`TimeArea`) e recortes (reuso de `SimpleBars`/`Donut`/`MetricValue`), chaves de i18n em
PT-BR/EN/ES e estado vazio compacto quando não houver tokens. O sétimo/último card da
grade passa de 8 para 9 quadros, sem alterar os demais.

## Risks / Trade-offs

- **[Constraint de evento no PostgreSQL]** recriar o CHECK de `item_events.event_type`
  pode ser pesado em tabela grande → migration aditiva com drop/add do constraint em uma
  transação curta; validar em perfil ADVANCED.
- **[Rebuild da projeção]** o bump de versão força reconstrução → reconstrução idempotente
  já existente + estado `BUILDING`; medir o custo no orçamento de payload/benchmark.
- **[Série pode diminuir]** limpar/reduzir tokens reduz a série → rótulo "tokens
  registrados" e cenário explícito de remoção/redução na spec.
- **[Semântica ambígua de "consumo"]** usuário pode ler a série como gasto histórico → o
  quadro separa "registrados no escopo" de "em itens concluídos" e explica a cobertura.
- **[Payload do Dashboard]** novo quadro aumenta a resposta → recortes agregados, detalhe
  paginado e limite de 256 KiB; sem embutir a lista completa de itens no recorte.
- **[Paridade UI↔rollup↔MCP]** três superfícies para o mesmo número → testes de oráculo e
  de paridade rollup↔replay para tokens, no padrão de `dashboardMetrics.test.ts`.

## Migration Plan

1. Migrations aditivas (SQLite e PostgreSQL): colunas de tokens em `project_metrics_daily`
   e na projeção por dimensão; `TOKENS_CHANGED` no enum/CHECK de `item_events`.
2. Bump de `projection_version` para 2 e liberação do rebuild idempotente existente.
3. Backfill: recomputar o acervo e semear os contadores de tokens na data de início da
   cobertura (carry-forward), idempotente por projeto.
4. Deploy da API/Web; verificação por `bun run check` e `bun run test:smoke`, com paridade
   rollup↔replay, oráculo de recortes/série e orçamento de payload.

- **Rollback**: as colunas são aditivas e ignoradas pela versão anterior; reverter o deploy
  volta a não exibir o quadro, sem perda dos valores de tokens dos cards. O rebuild da
  projeção é reversível por recomputação.

## Open Questions

- Expor, no quadro, uma lista de detalhe dos itens com tokens (drill-down por item) ou
  manter apenas os agregados e o ranking — não muda specs nem o recorte de tarefas.
- Incluir o novo recorte no benchmark reproduzível (`dashboard-performance-budget`) nesta
  change ou em rodada dedicada posterior — o teste de orçamento de payload permanece nesta
  change de qualquer forma.
