# Proposal

## Why

O card T77 (Campo novo: Tokens) entregou `tokensInput`/`tokensOutput` por card, mas
deixou **fora do escopo** as visões de consumo de IA no Dashboard. Hoje o campo só é
visível card a card: não há como responder "quanto de IA esta sprint/módulo consumiu?",
"qual o consumo por status/tipo?" nem "como o consumo evoluiu no tempo?". Sem esses
recortes, a base histórica de tokens não vira informação de planejamento.

Board ref: 43c10fb2-d18d-4bec-999d-9bcd1f04c78d

## What Changes

- Novo quadro **Tokens de IA** no Dashboard do projeto, ao lado dos oito quadros atuais:
  - Recortes de **estado atual** sobre folhas `TASK`/`BUG` não arquivadas: total de
    tokens (entrada + saída derivada), por status, por tipo e ranking por módulo,
    sprint, versão, squad e responsável, respeitando os filtros já existentes.
  - **Série diária** de tokens no tempo (tokens registrados no escopo e tokens em itens
    concluídos por dia), com cobertura parcial explícita.
- Captura de histórico: os tokens passam a integrar o **snapshot de analytics** dos
  itens, a mudança de tokens passa a emitir evento `TOKENS_CHANGED`, e o **rollup diário**
  (`project_metrics_daily`) e a **projeção por dimensão** passam a acumular tokens na
  mesma transação dos eventos, no padrão de deltas já usado por itens/pontos.
- Baseline/backfill de tokens para projetos com cobertura existente, com idempotência e
  data de início de cobertura de tokens declarada (não inventa consumo anterior).
- MCP: `get_dashboard_metrics` ganha `metric: tokens`, com os mesmos números e regras da
  tela (Leaf Rule, filtros e aplicabilidade equivalentes).
- Orçamento: os recortes de tokens respeitam o limite de payload do Dashboard com
  totais sobre a população inteira e detalhes paginados (padrão 50, máximo 100).
- i18n (PT-BR, EN, ES) e acessibilidade (legenda, unidade e alternativa tabular) no novo
  quadro.

**Fora de escopo**: voltar a alterar o modelo do campo de tokens (`tokensInput`/
`tokensOutput` continuam anuláveis, não-negativos, com total derivado) e criar visões de
tokens fora do escopo do projeto (cross-project/tenant).

## Capabilities

### New Capabilities

- `dashboard-token-analytics`: recortes e série temporal de consumo de tokens de IA no
  Dashboard do projeto — dimensões, cobertura parcial, aplicabilidade de filtros,
  orçamento de payload e exposição ao agente.

### Modified Capabilities

- `card-token-tracking`: a alteração de tokens passa a alimentar o histórico de
  analytics (evento + snapshot), preservando as regras de validação e de isolamento já
  existentes.
- `dashboard-metric-rollups`: o acervo diário e a projeção por dimensão passam a
  acumular tokens na mesma transação dos eventos, mantendo idempotência, backfill e
  isolamento por tenant/projeto.
- `project-dashboard`: a página passa a incluir o quadro de tokens entre os quadros
  exibidos, com estados, filtros e acessibilidade equivalentes aos demais.
- `agent-dashboard-metrics`: `get_dashboard_metrics` passa a aceitar `metric: tokens` com
  paridade de números e regras com a tela.

## Impact

- **Dados**: colunas de tokens no rollup diário (`project_metrics_daily`) e na projeção
  por dimensão (`project_analytics_dimension_state`/`_snapshots`), com migration aditiva
  em SQLite e PostgreSQL; snapshot de analytics dos itens passa a incluir tokens;
  novo tipo de evento `TOKENS_CHANGED`; bump de versão da projeção por dimensão com
  reconstrução idempotente.
- **API REST**: novo endpoint `GET /projects/:projectId/dashboard/tokens` (recortes +
  série), sob as mesmas garantias de RBAC (VIEWER+), anti-IDOR e isolamento por tenant.
- **Tool registry / MCP**: enum de `metric` e envelope de `get_dashboard_metrics`,
  operação de leitura sem aprovação.
- **Web**: novo quadro no `ProjectDashboardPage`, adaptadores de gráfico, contratos em
  `@azy-board/ui-contracts` e chaves de tradução.
- **Testes**: paridade rollup↔replay para tokens, oráculo de recortes e série, orçamento
  de payload, isolamento por tenant, cobertura parcial e equivalência UI↔MCP.
- **Sem** dependências novas, **sem** alteração de permissões e **sem** mudança no modelo
  do campo de tokens do card.
