## Context

O Dashboard funcional já possui dez boxes, filtros, endpoints agregados, cobertura histórica e abertura de itens no Board. A apresentação atual é predominantemente textual: somente o Burnup possui uma visualização gráfica mínima e muitos estados parecem vazios mesmo quando há dados suficientes para uma leitura visual. A mudança é frontend-first e deve preservar a semântica e os limites definidos pela change `add-project-management-dashboard`.

## Goals / Non-Goals

**Goals:**

- Tornar a leitura do Dashboard rápida, visual e profissional em desktop, tablet e mobile.
- Usar os mesmos dez boxes com gráficos adequados a cada tipo de dado.
- Centralizar tokens de cor, estados, tooltips, legendas, skeletons e adaptadores de dados.
- Manter tabelas/descrições equivalentes, navegação por teclado, contraste e informação independente de cor.
- Permitir drill-down objetivo para o Board sem criar novas métricas de produtividade.

**Non-Goals:**

- Alterar as definições de negócio, Leaf Rule, cobertura, filtros ou permissões da change anterior.
- Criar finanças, IA, capacidade, WIP limit, P85, CFD, throughput, lead/cycle time, ranking ou comparação de produtividade.
- Criar novo formulário obrigatório ou persistir preferências complexas de visualização nesta etapa.

## Decisions

### Biblioteca de gráficos

Usar `recharts`, versão compatível com React 18, por ser MIT, SVG-native, responsiva, tipada e declarativa. Ela atende linhas/áreas, barras, donuts, tooltips e referências sem introduzir runtime de canvas ou outra camada de visualização. Apache ECharts foi considerado, mas é mais pesado para estes gráficos e exige mais configuração imperativa; Nivo foi considerado, mas adiciona maior superfície de dependências e wrappers para uma necessidade menor.

### Arquitetura de apresentação

Manter a página como orquestradora de carregamento e criar componentes pequenos: `DashboardCard`, `MetricValue`, `ChartLegend`, `ChartTooltip`, `ChartSkeleton`, `ChartEmptyState`, `ProgressChart`, `WipChart`, `BurnupChart`, `AgingChart`, `SprintChart`, `VersionChart`, `TeamLoadChart` e `HoursChart`. Adaptadores transformam contratos da API em séries prontas para o gráfico, sem mover cálculos de negócio para o browser.

### Visualização por box

- Progresso: donut de concluídos/restantes e barras de quantidade/pontos.
- WIP: barras por status e lista compacta.
- Bloqueados: indicador de total, distribuição por squad/responsável e motivos na lista.
- Atrasados: barras por faixa de dias e itens mais antigos.
- Burnup: área diária de escopo/concluídos, seleção quantidade/pontos e linha de cobertura.
- Aging WIP: histograma por faixas, mediana e itens mais antigos.
- Sprint: barras de compromisso, concluído, escopo atual e não concluído.
- Versões: barras de progresso por versão e pontos.
- Carga da equipe: barras empilhadas de WIP e bloqueados, sem ranking.
- Horas: barras por dia com alternância por autor/squad quando o contrato permitir.

### Dados, estados e interação

Gráficos recebem apenas dados já filtrados e respeitam estados `loading`, `empty`, `error`, `partial` e `inapplicable`. Cada gráfico terá tooltip textual, legenda, unidade, tabela ou lista equivalente e links de drill-down. Um clique em uma série pode limitar o detalhe do próprio card ou abrir o Board com filtros objetivos; não altera filtros globais de modo surpreendente.

### Performance e responsividade

Usar `ResponsiveContainer`, limitar pontos de séries ao período suportado pela API, evitar animações em listas grandes e desativar animações com `prefers-reduced-motion`. A página não deve buscar endpoints extras por card quando o snapshot já contém os dados necessários.

## Risks / Trade-offs

- **Recharts aumenta o bundle** → importar somente componentes usados e conferir o bundle no build.
- **Gráficos podem sugerir precisão inexistente** → exibir cobertura, unidades, datas e estados parciais junto da visualização.
- **Cores podem falhar em temas ou daltonismo** → usar contraste, padrões/textos e tabelas, não cor isolada.
- **Cards com muitos detalhes podem ficar densos no mobile** → usar prioridade visual, colapso de detalhes e grid de uma coluna.
- **API atual tem séries históricas curtas** → renderizar empty/partial de forma intencional, nunca inventar pontos.

## Migration Plan

1. Adicionar `recharts` e componentes/adapters sem remover o Dashboard atual.
2. Implementar visualizações atrás dos contratos existentes e validar com fixtures de dados reais, vazios e parciais.
3. Substituir progressivamente o conteúdo visual dos cards mantendo os mesmos títulos, filtros e links.
4. Executar typecheck, testes, build e auditoria de licença.
5. Rollback: remover os componentes gráficos e dependência; contratos da API e dados analíticos permanecem intactos.

## Open Questions

Nenhuma questão bloqueante. A alternância quantidade/pontos pode ser exibida somente nos boxes em que ambas as séries já existem; não será criado backfill para habilitá-la.
