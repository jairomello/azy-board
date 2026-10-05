## Context

O Dashboard já é a fonte oficial das métricas de execução: `apps/api/src/routes/dashboard.ts` expõe `/snapshot`, `/hours`, `/burnup`, `/aging` e `/sprints[/:cycleId]`, e encode regras de produto decisivas — Leaf Rule (só `TASK`/`BUG` folha não arquivada conta), WIP **inclui** bloqueados, `blockedSubset`/`blockedUnassignedSubset` são subconjuntos não aditivos do WIP, Atrasados sobrepõe WIP, horas somam só `manual` com `durationMin > 0` pelo autor do log, e cada resposta carrega avisos de cobertura parcial (`coverage.partial`, `partial`, `coverageStartedAt`). Hoje o Azy Agent não tem acesso a esses números: o catálogo compartilhado (`packages/tool-registry`) e o harness (`apps/api/src/services/assistantHarness.ts`) só oferecem descoberta/card (`get_board`, `get_tree`, `get_screen_overview`, `list_tasks`) e ferramentas de UI (T16–T18). Contar cards pelo board ignora histórico por evento, cobertura e as regras acima, e diverge do que a tela mostra.

A infraestrutura para fechar a lacuna já existe: tools compartilhadas são declaradas uma única vez em `toolFields`/`classifications` e executadas por `executeSharedTool`, tanto no MCP (`apps/mcp`) quanto no Azy Agent (`apps/api`), com autorização server-side e sem aprovação quando a operação é `read`. A fotografia da tela (`AssistantScreenSnapshot`, T16/T18) já transporta filtros do board fixados na execução; falta um bloco equivalente para o Dashboard, cuja população e período são próprios (`ProjectDashboardPage.tsx` persiste `dashboard-filters:<projectId>`).

## Goals / Non-Goals

**Goals:**

- O agente responder sobre WIP, bloqueios, atrasos, esforço, burnup, aging e sprint com o **mesmo número e a mesma regra** do Dashboard para o mesmo recorte.
- Filtros e período equivalentes ao Dashboard, com aplicabilidade explícita (um filtro inaplicável é declarado, nunca aplicado em silêncio).
- Cada indicador traz **critérios** e **itens de origem** (amostra limitada) para explicação e drill-down.
- Preservar avisos de cobertura parcial e rotular populações sobrepostas como **não aditivas**.
- Somente-leitura, autorizada server-side, isolada por tenant/membership, aditiva e sem migração de dados.

**Non-Goals:**

- Novos boxes/gráficos, WIP limit, previsão probabilística, throughput/lead time ou ranking de produtividade.
- Mutação de dados pelo agente via métricas.
- Paridade em tempo real pixel-a-pixel: a resposta é uma consulta no momento do pedido e declara `capturedAt`/cobertura.
- Substituir a página do Dashboard ou suas rotas.

## Decisions

### 1. Uma ferramenta de leitura de recurso `get_dashboard_metrics` com seletor de métrica

Expor no catálogo compartilhado `get_dashboard_metrics` com `metric` obrigatório (`snapshot | burnup | aging | hours | sprint`), mais filtros/período e `cycleId` opcionais.

- **Por quê:** o Dashboard é um recurso com sub-recursos já nomeados; um único tool com seletor mantém o prompt inicial pequeno (preocupação de payload do B7), compartilha o mesmo bloco de filtros e devolve, por chamada, um digest com `criteria`, `coverage`, `populations` e amostra de itens. O harness já suporta múltiplas leituras no mesmo passo, então o modelo pode pedir `snapshot` + `burnup` em uma etapa.
- **Alternativas:** (a) cinco tools nominais (`get_dashboard_snapshot`, …) — mais fiel a “tools nominais”, porém infla o catálogo e o prompt; a regra anti-tool-fachada de `adaptive-agent-tool-routing` trata da hierarquia de capability, não deste recurso. (b) Reimplementar as agregações no tool — rejeitada por risco de drift.

### 2. Paridade por reuso das rotas oficiais do Dashboard

O adaptador (`apps/mcp/src/tools.ts`) monta a query e chama as rotas `/projects/:projectId/dashboard/*` via `ApiCall`; não recalcula métricas.

- **Por quê:** garante o mesmo número e a mesma regra da tela sem duplicar Leaf Rule, rollup e cobertura. As rotas já são autorizadas (VIEWER+) e tenant-scoped.
- **Alternativa:** extrair um serviço puro compartilhado entre rota e tool — mais refatoração, sem ganho imediato de paridade.

### 3. Filtros explícitos com default determinístico vindo da fotografia

O tool aceita `from`, `to`, `moduleId`, `sprintId`, `versionId`, `squadId`, `assigneeId`, `type` (e `cycleId` para `sprint`). Quando um filtro/período não é informado e o run está na tela `project-dashboard`, o adaptador usa o bloco de Dashboard da fotografia (`execution.context.screenSnapshot`, padrão de `toolGetScreenOverview`); argumento explícito sempre prevalece.

- **Por quê:** “os mesmos filtros do dashboard” por padrão, sem o usuário repetir; determinístico e server-side, evitando depender da obediência do modelo ao prompt.
- **Alternativa:** só confiar no prompt — rejeitada por fragilidade.

### 4. Bloco `dashboard` dedicado na fotografia (additive)

Adicionar `dashboard?: { filters: Record<string, AssistantScreenFilterValue>; period: { from: string | null; to: string | null } }` a `AssistantScreenSnapshot`, capturado apenas quando `screen === 'project-dashboard'`.

- **Por quê:** `scope.mode`/`results`/`view.mode` são conceitos do board; reutilizá-los no Dashboard confundiria o escopo de mutação em lote (T16) e o `hasPopulationFilter`. Um bloco opcional mantém `schemaVersion = 1` e degradação sem erro.
- **Alternativa:** reusar `filters` do snapshot — rejeitada pelo motivo acima.

### 5. Semântica de resposta com critérios e populações sobrepostas

A resposta normaliza: `metric`, `capturedAt`/`coverage` (parcial quando houver), `filters` aplicados/inaplicáveis, `criteria` (ex.: “folhas TASK/BUG não arquivadas; pontos só quando conhecidos; horas = log manual com duração > 0 pelo autor”) e `populations` (`wipIncludesBlocked: true`, `blockedSubsetOfWip`, `overdueOverlapsWip`, `teamLoad.blockedSubset <= wipTotal`). Itens de origem vêm em amostra limitada com `truncated` explícito.

- **Por quê:** cumpre “critérios e itens de origem” e evita que o modelo some WIP + Bloqueados como populações distintas.
- **Alternativa:** devolver apenas o JSON cru da rota — insuficiente para explicar sobreposição e cobertura.

### 6. Somente-leitura, fora de qualquer fluxo de aprovação

Classificação `{ domain: 'board', scope: 'project', operation: 'read' }` → risco `READ`, sem aprovação, deduplicado por assinatura no harness, com `authorize` revalidando leitura do projeto; o namespace `discovery` o inclui no conjunto inicial de intenções `read`.

## Risks / Trade-offs

- **[Drift entre Dashboard e agente]** → o tool chama as mesmas rotas; teste de paridade com o mesmo recorte para `snapshot`/`hours`/`burnup`/`aging`.
- **[Payload de prompt]** → tool único e amostras limitadas com truncamento declarado; monitorar `bun run check:bundle`/limites do harness.
- **[Fotografia defasada em relação à tela viva]** → declarar `capturedAt` e cobertura; filtros explícitos prevalecem; a paridade é no momento da consulta.
- **[Confusão de populações]** → rótulos explícitos de sobreposição; instrução no prompt do harness.
- **[Consultas caras em projetos grandes]** → limites de amostra/linhas e paginação já existentes nas rotas; sem varredura nova.
- **[Paridade SIMPLE vs ADVANCED]** → rotas abstraem a persistência; validar com os testes existentes e, havendo Postgres, no job `advanced`.

## Migration Plan

- Aditivo e sem migração de dados. `SCREEN_SNAPSHOT_SCHEMA_VERSION` permanece `1` (campo `dashboard` opcional).
- Deploy único; clientes sem o bloco `dashboard` degradam para filtros explícitos do pedido.
- Rollback: reverter o commit; nenhum estado persistido novo a limpar.

## Open Questions

- Expor a lista de ciclos no mesmo tool (`metric: 'sprint'` sem `cycleId` devolve ciclos) ou exigir `cycleId` e manter `list_sprints` como descoberta?
- `includeItems` deve ser padrão ligado (amostra limitada) ou só sob pedido explícito?
- Nome final do valor de `metric` para sprint (`sprint` vs `sprint_cycle`) e formato do rótulo de cobertura parcial.
