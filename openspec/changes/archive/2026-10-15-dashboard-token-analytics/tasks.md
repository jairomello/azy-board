# Tasks

## 1. Fundação de dados de tokens no pipeline de analytics

- [x] 1.1 Incluir `tokensInput`/`tokensOutput` em `SqliteItemSnapshot` e `DashboardDimensionSnapshot` (leitura, leitura em lote e serialização), em SQLite e PostgreSQL; verificar com teste unitário de `readItemSnapshot`/`readItemSnapshots` que os dois valores aparecem no snapshot
- [x] 1.2 Adicionar `TOKENS_CHANGED` ao enum de `item_events` em `apps/api/src/db/schema.ts`, à migration SQLite e recriar o CHECK constraint no PostgreSQL; verificar com teste que o evento é aceito em ambos os perfis (ou migration aplicada sem erro)
- [x] 1.3 Emitir **um** evento `TOKENS_CHANGED` por mutação que altere tokens (criação, edição individual, `POST /items/update` em lote, `set_item_tokens` e limpeza), no encadeamento de `before`/`after`; verificar com teste que criar, alterar e limpar tokens geram exatamente um evento, e que entrada rejeitada não gera evento
- [x] 1.4 Migration aditiva com as colunas de tokens (`tokens_input`, `tokens_output`, `done_tokens_input`, `done_tokens_output`) em `project_metrics_daily`, nos dois perfis; verificar aplicando as migrations em banco limpo (SIMPLE e ADVANCED) sem erro
- [x] 1.5 Estender `applyEventToDailyRollup`, `applyDailyDelta` e `recomputeProjectRollup` para acumular tokens por delta (escopo e concluídos), na mesma transação do evento; verificar com teste de paridade acervo↔replay para tokens (incluindo reabertura, arquivamento, exclusão e limpeza)
- [x] 1.6 Estender a projeção por dimensão (`dashboardDimensionProjection`, `applyDimensionProjection*`, `state`/`snapshots`) com tokens, incrementar `projection_version` para 2 e ajustar os gates que exigem a versão 1; verificar com teste que a projeção pronta devolve tokens iguais ao replay por recorte, e que a reconstrução idempotente não duplica valores
- [x] 1.7 Implementar o backfill/semente de tokens a partir do estado atual na data de início da cobertura, com carry-forward e exposição de `tokensStartedAt`; verificar com teste idempotente (reaplicar não altera valores) e teste de cobertura parcial
- [x] 1.8 Documentar o pipeline de tokens (evento, acervo, projeção, cobertura) em `docs/ANALISE-SISTEMA.md`; verificar que o texto descreve o evento, as colunas e a regra de cobertura coerentes com o código

## 2. API de recortes e série de tokens

- [x] 2.1 Adicionar ao port de dashboard as leituras de tokens (acervo diário, projeção por dimensão, agregado de estado atual e agrupamentos por módulo/sprint/versão/squad/responsável), em SQLite e PostgreSQL; verificar com testes de persistência que respeitam `tenantId`/`projectId`
- [x] 2.2 Implementar `GET /projects/:projectId/dashboard/tokens` com recortes de estado atual, série diária, `coverageStartedAt`/`tokensStartedAt`/`partial`, `projection` e `filters { applied, inapplicable }`; verificar com teste de integração que o recorte por status/tipo e a série batem com o oráculo e que o período é declarado inaplicável aos recortes
- [x] 2.3 Aplicar RBAC (`VIEWER+`), revalidação de membership e isolamento por tenant/projeto na nova rota, com cursor opaco vinculado a escopo/filtros/período; verificar com testes de acesso negado, de cursor de outro escopo e de isolamento entre tenants
- [x] 2.4 Garantir totais sobre a população completa, detalhe paginado (padrão 50, máximo 100, ordenação determinística com desempate por ID) e limite de 256 KiB na resposta comum; verificar com teste de orçamento de payload que a resposta não excede o limite e que o truncamento de detalhe não altera os totais
- [x] 2.5 Escrever o teste de oráculo dos recortes e da série de tokens (incluindo item em múltiplas sprints, pai oculto por filtro, item sem tokens e projeto sem tokens); verificar que o teste cobre cada cenário das specs de `dashboard-token-analytics` e `dashboard-metric-rollups`

## 3. Contratos compartilhados e ferramenta do agente

- [x] 3.1 Adicionar os tipos do recorte/série de tokens em `packages/ui-contracts` (incluindo `tokensStartedAt`, recortes e série); verificar com typecheck do pacote
- [x] 3.2 Adicionar `tokens` ao enum de `metric` em `get_dashboard_metrics` (registry, fields, validation, `http-adapter` com `dashboardCriteria`/`dashboardPopulations` e envelope de cobertura); verificar com o teste do tool registry e do MCP que `metric: tokens` chama a nova rota com os filtros corretos e continua classificado como leitura
- [x] 3.3 Verificar a paridade UI↔rollup↔MCP do recorte e da série de tokens; verificar com teste que o valor da ferramenta é igual ao da rota do Dashboard para os mesmos filtros
- [x] 3.4 Atualizar `apps/mcp/README.md` com o novo `metric: tokens`; verificar que a tabela de ferramentas menciona tokens e a mesma descrição do catálogo

## 4. Quadro de tokens no Dashboard

- [x] 4.1 Adicionar o adaptador de dados de tokens em `apps/web/src/dashboardAdapters.ts` (recortes e série) ; verificar com teste unitário cobrindo dados presentes, vazios e cobertura parcial
- [x] 4.2 Implementar o quadro "Tokens de IA" em `ProjectDashboardPage.tsx`, com métrica principal, recortes e série no padrão dos demais quadros; verificar com teste de contrato do Dashboard que o quadro aparece, consome a nova rota e respeita os estados de erro/vazio
- [x] 4.3 Adicionar as chaves de i18n do quadro em PT-BR, EN e ES; verificar com o teste de paridade de i18n que não há chave faltante entre os idiomas
- [x] 4.4 Garantir acessibilidade e estado vazio do quadro (unidade/rótulo, legenda sem repetição, alternativa textual da série, vazio compacto sem área de gráfico); verificar com teste de contrato que os elementos de acessibilidade e o vazio compacto estão presentes

## 5. Verificação integrada

- [x] 5.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir toda falha introduzida pela change
- [x] 5.2 Rodar `bun run test:smoke` no fluxo web/API e confirmar o quadro de tokens carregando em um projeto com tokens registrados
- [x] 5.3 Confirmar no Dashboard real que, com um projeto sem tokens, o quadro orienta o registro e não exibe zeros como resultado

## Workflow follow-up

- Confirmar com o usuário o início do trabalho do card T80 (hoje em `Backlog`) e, com o aval, movê-lo para uma coluna `IN_PROGRESS` antes de codar.
- Ao concluir a implementação: executar `complete_task` no card `43c10fb2-d18d-4bec-999d-9bcd1f04c78d`, registrar o consumo de tokens da sessão e confirmar no board que o `status` do card é `DONE`.
- Arquivar a change após a revisão do projeto e verificar o resultado arquivado.
