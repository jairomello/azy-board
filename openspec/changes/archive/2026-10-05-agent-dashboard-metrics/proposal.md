## Why

Perguntas cotidianas — “por que meu WIP está em 18?”, “quais cards estão bloqueados há mais tempo?”, “quantas horas registrei nesta sprint?” — já têm resposta oficial no Dashboard, mas o Azy Agent não acessa as métricas oficiais (snapshot, horas, burnup, aging e sprint). Ele só consegue contar cards via `list_tasks`/`get_board`, ignorando regras do Dashboard (Leaf Rule, histórico por evento, cobertura parcial) e podendo divergir dos números exibidos na tela. Fechar essa lacuna é a oportunidade #4 (P1, integração) da evolução do agente e o escopo do card **T20**.

**Board ref:** `d153710f-0a71-45cc-a274-de8741335e9f` (T20 — Consultar métricas oficiais do dashboard pelo agente).

## What Changes

- **Nova ferramenta de leitura `get_dashboard_metrics`** no catálogo compartilhado (MCP + Azy Agent): expõe snapshot (Progresso/Escopo, WIP, Bloqueados, Atrasados, Carga da Equipe), burnup, aging, horas registradas e métricas de sprint, **reaproveitando as rotas oficiais do Dashboard** para garantir a mesma regra e o mesmo número.
- **Filtros equivalentes ao Dashboard**: período (`from`/`to`), módulo, sprint, versão, squad, responsável e tipo. Filtros inaplicáveis ao recorte são **declarados e não aplicados em silêncio**; filtros de estado atual vs. período seguem a mesma aplicabilidade da tela.
- **Critérios e itens de origem**: cada indicador vem com a regra aplicada (Leaf Rule, cobertura de pontos, autor do log) e uma amostra limitada dos itens que o compõem, permitindo drill-down no board.
- **Cobertura parcial preservada e populações sobrepostas explícitas**: `partial`/`coverageStartedAt` viajam com a resposta; WIP ⊇ Bloqueados, `blockedSubset ≤ wipTotal` e Atrasados sobrepondo WIP são rotulados como **não aditivos** (nunca somados como populações distintas).
- **Fotografia da tela no Dashboard**: quando a tela ativa é `project-dashboard`, a fotografia passa a carregar os filtros de população e o período vigentes, para que “os mesmos filtros do dashboard” sejam o padrão sem o usuário repeti-los.
- **Somente-leitura e autorizada**: a ferramenta não muta dados, não exige aprovação e revalida a leitura do projeto server-side (VIEWER+), respeitando tenant e membership. Sem BREAKING: campo/ferramenta aditivos; telas sem a fotografia do Dashboard degradam para filtros explícitos do pedido.

## Capabilities

### New Capabilities

- `agent-dashboard-metrics`: leitura das métricas oficiais do Dashboard pelo agente, com paridade de regras e filtros, critérios e itens de origem, avisos de cobertura parcial e semântica explícita de populações sobrepostas.

### Modified Capabilities

- `adaptive-agent-tool-routing`: o conjunto inicial de intenções `read` e o catálogo compartilhado passam a incluir `get_dashboard_metrics` (classificação `{ domain: 'board', scope: 'project', operation: 'read' }`) para perguntas sobre WIP, bloqueios, atrasos, esforço, burnup, aging e sprint.
- `agent-screen-context`: a fotografia passa a incluir, quando a tela ativa é `project-dashboard`, os filtros de população e o período vigentes; o transporte permanece opcional e o escopo de mutação do board não muda.

## Impact

- **Contratos compartilhados**: `packages/tool-registry/src/{fields,policies,registry}.ts` (novo tool, classificação e descrição) e `packages/assistant-contracts/src/index.ts` (filtros/período do Dashboard na fotografia).
- **API/MCP**: `apps/mcp/src/tools.ts` e `apps/mcp/src/registry.ts` (adaptador HTTP para `/projects/:id/dashboard/*`); `apps/api/src/services/assistantHarness.ts` (instrução/roteamento) e, se necessário, `apps/api/src/routes/assistant.ts` (injeção do contexto de filtros).
- **Web**: `apps/web/src/pages/ProjectDashboardPage.tsx` (publicar filtros no contexto), `apps/web/src/lib/assistantSnapshot.ts` (capturar) e `apps/web/src/contexts/AssistantContext.tsx`/`AzyAgentDrawer.tsx` conforme o padrão T16.
- **Docs e i18n**: catálogo gerado (`bun run generate:docs` → README/OpenAPI/`docs/generated/assistant-limits.md`) e textos do harness no idioma do usuário.
- **Testes**: contrato do catálogo (`registry-contract`), adaptador do tool, captura de filtros do Dashboard e teste de paridade “agente = Dashboard” para um mesmo recorte; `bun run check` e `bun run test:smoke`.
- **Fora de escopo**: novos boxes/gráficos, WIP limit, previsão probabilística, ranking de produtividade, mutação de dados e automação de navegação.
