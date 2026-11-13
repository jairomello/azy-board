# Tasks — indicadores de prazo e fidelidade do Dashboard

## 1. API

- [x] 1.1 Criar `GET /projects/:projectId/dashboard/indicators` com SPI, dias para o término, conclusão, avanço, WIP, bloqueados, atrasados, higiene e externos.
- [x] 1.2 Separar a população de progresso: `TASK`/`BUG` sem `CANCELLED`.
- [x] 1.3 Contar `EXTERNAL` à parte, fora do progresso.
- [x] 1.4 Reconhecer `assigneeLabel` como responsável e separar “sem responsável” de “responsável externo”.
- [x] 1.5 Corrigir o box WIP para exibir apenas os status ativos (incluindo homologação).
- [x] 1.6 Manter a regra de atraso vigente e dar ao donut de atrasados um universo próprio (`scopeTotal`/`scopePoints`).
- [x] 1.7 Calcular o SPI por conclusão ÷ esperado, mantendo o avanço no fluxo como indicador separado.
- [x] 1.8 Fazer os tokens contarem em qualquer status, alinhados à série do rollup.

## 2. UI

- [x] 2.1 Adicionar o box **Prazo** com os quatro KPIs e a higiene da base.
- [x] 2.2 Exibir nota de escopo no progresso, no WIP e na carga da equipe.
- [x] 2.3 Destravar o seletor Itens/Pontos da carga da equipe quando não há estimativa.
- [x] 2.4 Adicionar botão de informação por quadro e por KPI do box Prazo, acessível por teclado.
- [x] 2.5 Atualizar a legenda do WIP para as três fatias (em andamento, em homologação, bloqueado).
- [x] 2.6 Atualizar i18n em pt-BR, en e es.

## 3. Verificação

- [x] 3.1 Testes de API para população, externos, N/A, responsável por rótulo e SPI (`dashboardMetrics`, `dashboardTokens`).
- [x] 3.2 Testes de comportamento dos adapters do dashboard (`dashboardVisuals`).
- [x] 3.3 Contratos estruturais do dashboard atualizados (dez boxes e legenda do WIP).
- [x] 3.4 `typecheck`, `lint`, `check:i18n`, `check:frontend-tests`, `check:bundle` e `build` verdes.
- [x] 3.5 Suíte de API sem falha nova em relação ao `main`.
- [x] 3.6 Validado no dashboard local e depois em produção (versão `2026.11.10.33`).

## 4. Documentação

- [x] 4.1 Registrar a auditoria e as decisões em `docs/azyboard/evidencias/E8-auditoria-dashboard.md`.
- [x] 4.2 Alinhar o spec `project-dashboard` ao runtime (este change).
- [x] 4.3 `bun run openspec:validate` e `check:docs` verdes.

## Pendências conhecidas

- Burnup: o rollup diário foi semeado contando `EXTERNAL` e N/A e o PostgreSQL não tem recomputo (`backfillRollups` é stub). Fica fora deste change.
