## Context

O web é React 18 + Vite 5 + TypeScript, com roteamento já em `lazy()` (`apps/web/src/App.tsx`) e build em `apps/web/dist` (~4,4 MB no total). Bibliotecas pesadas entram no bundle inicial e no de rotas que não as usam:

- **Recharts** (`recharts@^3.10.1`) importado estaticamente em `apps/web/src/components/dashboard/DashboardVisuals.tsx`, que é importado estaticamente por `ProjectDashboardPage`.
- **Tiptap** (`@tiptap/react`, `starter-kit`, `extension-placeholder`, `extension-link`) importado estaticamente em `apps/web/src/components/RichTextEditor.tsx`, consumido por `ItemModal` → `ChecklistSection`, `StoryModal`, `EpicModal` (cadeia estática do `BoardScreen`/`BoardPage`) e `GeneralSettingsSections` (SettingsPage).

Não existe medição de bundle nem orçamento verificado no CI. Existem convenções de script no repositório (`scripts/check-i18n.ts`, `scripts/check-mcp-catalog.ts`, `scripts/lint.ts`) e o CI tem um job `contracts` com gates leves que rodam `bun run <script>`.

## Goals / Non-Goals

**Goals:**
- Tirar Recharts e Tiptap do caminho crítico, carregando-os sob demanda na tela que os usa.
- Reduzir os chunks citados no item 23 sem mudar comportamento visível.
- Ter medição reproduzível (`build:analyze`) e um orçamento versionado que falha localmente e no CI.
- Manter o build padrão (`bun run build`) inalterado em conteúdo.

**Non-Goals:**
- Trocar Recharts/Tiptap por outras bibliotecas.
- Reestruturar `ProjectDashboardPage` ou `BoardPage` além do necessário para o split.
- SSR, prerender ou migração para outro bundler.
- Orçamento por rota individual ou por usuário; o orçamento é por chunk/asset do build.

## Decisions

### 1. Lazy dos gráficos via `React.lazy` em um wrapper, mantendo a API dos componentes

`DashboardVisuals.tsx` passa a ser um **barrel fino** que expõe os mesmos nomes (`Gauge`, `Donut`, `TimeArea`, `SimpleBars`, `HorizontalRankingBar`, `DonutComparison`, `ChartLegend`, `ChartEmptyState`, `MetricValue`, `DashboardCard`) e faz `lazy(() => import('./DashboardCharts'))`, onde `DashboardCharts.tsx` concentra os imports do Recharts. Cada componente suspende com `Suspense` e um placeholder de mesmo tamanho para evitar layout shift.

- **Por que:** preserva as ~30 chamadas em `ProjectDashboardPage` sem reescrever a página; o import dinâmico garante que o Recharts só baixe quando o Dashboard renderiza gráficos.
- **Alternativa descartada:** mover os gráficos para um único componente `DashboardCharts` e renderizar tudo junto — exigiria reescrever a página e reduziria a granularidade do estado por quadro.

### 2. Lazy do editor no ponto de uso, com fallback de carregamento

`RichTextEditor.tsx` mantém a assinatura pública e faz `lazy(() => import('./RichTextEditorImpl'))` internamente (ou `lazy` no import dos consumidores). O consumidor mais sensível é `ItemModal`, que faz parte da cadeia estática do board; por isso o split precisa ser **dentro do componente** para não arrastar Tiptap na cadeia de tipos (`import type` não gera runtime). Estados: enquanto carrega, exibe área equivalente com `aria-busy`; erro de chunk exibe mensagem traduzida e permite tentar de novo.

- **Por que:** evita que Tiptap entre no bundle do board apenas por causa de modais que nem sempre abrem.
- **Alternativa descartada:** lazy no route-level apenas — insuficiente, pois `ItemsModal`/`ChecklistSection` estão no chunk do board.

### 3. `manualChunks` no Vite para vendors pesados

Adicionar `build.rollupOptions.output.manualChunks` em `apps/web/vite.config.ts` agrupando `recharts`/`d3-*` em `vendor-charts` e `@tiptap/*`/`prosemirror-*` em `vendor-editor`, além de separar `react`/`react-dom`/`react-router-dom` em `vendor-react`.

- **Por que:** chunks nomeados e estáveis tornam o orçamento verificável por nome e evitam que um vendor migre de chunk a cada mudança.
- **Alternativa descartada:** depender só do split automático do Rollup — nomes instáveis, orçamento frágil.

### 4. Medição com `rollup-plugin-visualizer` (MIT), fora do build padrão

`build:analyze` = build do web com variável de ambiente que ativa o visualizer, gerando `apps/web/dist/stats.html`. O build normal não ativa o plugin. `rollup-plugin-visualizer` é MIT, compatível com a política de licenças, e entra em `devDependencies`.

- **Por que:** relatório visual para investigar regressões sem inflar o build publicado.
- **Alternativa descartada:** `source-map-explorer` — depende de sourcemaps e é menos direto no Vite.

### 5. Orçamento em JSON versionado + `scripts/check-bundle.ts`

Formato proposto (`apps/web/bundle-budget.json`), com limites **gzip** por chunk (gzip é o que o usuário baixa; bruto varia com minificação):

```json
{
  "chunks": [
    { "name": "index", "maxGzipBytes": 120000 },
    { "name": "vendor-react", "maxGzipBytes": 80000 },
    { "name": "vendor-charts", "maxGzipBytes": 120000 },
    { "name": "vendor-editor", "maxGzipBytes": 120000 },
    { "name": "BoardPage", "maxGzipBytes": 90000 },
    { "name": "ProjectDashboardPage", "maxGzipBytes": 60000 },
    { "name": "SettingsPage", "maxGzipBytes": 60000 }
  ]
}
```

`scripts/check-bundle.ts` lê `apps/web/dist/assets/*.js`, calcula gzip, casa por prefixo de nome, reporta tabela e falha se algum chunk com regra ultrapassar o limite ou se o orçamento estiver ausente/malformado. Comando raiz: `check:bundle`, encadeado à verificação local (documentado em `docs/ci.md`) e executado no job `contracts` do CI, depois do build. Os limites iniciais são calibrados com a medição real e ajustados uma única vez; a partir daí só reduzem, salvo justificativa explícita no PR.

- **Por que:** simples, sem dependência nova de runtime e alinhado aos gates existentes.
- **Alternativa descartada:** `size-limit` — dependência extra e configuração menos transparente para múltiplos chunks nomeados.

### 6. Ordem de execução

1. Medir baseline (`build:analyze`).
2. Adicionar visualizer + script + orçamento calibrado **após** os splits (evita calibrar duas vezes).
3. Aplicar splits de Recharts e Tiptap.
4. Calibrar orçamento com o build final, com folga pequena.
5. Ligar `check:bundle` no CI.

## Risks / Trade-offs

- **Layout shift/CLS nos gráficos** → placeholders com altura fixa e `Suspense` no mesmo contêiner; validar visualmente no Dashboard.
- **Erro de chunk em deploy com cache antigo** → fallback de erro com botão de recarregar; o `AppErrorBoundary` já trata falhas de render.
- **Orçamento desatualizado após upgrade de dependência** → a mensagem de falha indica chunk, limite e medido; ajuste exige alteração explícita no JSON no PR.
- **Duplicação de vendor em chunks** se o `manualChunks` agrupar demais → validar com o visualizer que não há cópias e ajustar os grupos.
- **Testes de contrato de UI que leem o fonte** (`apps/web/src/ui-mode-contract.test.ts`) podem depender da estrutura de imports → manter nomes/arquivos públicos e atualizar o teste só se a estrutura o exigir (documentar no PR).
- **Ganho depende de a rota inicial nunca importar os vendors** → verificar no relatório que `index`/`BoardPage` não referenciam Recharts/Tiptap.
