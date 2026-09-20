## Why

O bundle do web ainda é pesado: `ProjectDashboardPage` 448,77 KB, chunk principal 366,46 KB, editor/accordion 339,53 KB e `BoardPage` 192,75 KB. Bibliotecas grandes (Recharts e Tiptap) entram no caminho crítico mesmo quando a tela não as exibe, e não há medição contínua nem limite que impeça regressões. Sem um orçamento verificado no CI, o problema volta a crescer a cada entrega.

## What Changes

- Isolar o carregamento de Recharts: os componentes de gráficos passam a ser carregados sob demanda dentro da página de Dashboard, fora do bundle inicial.
- Isolar o carregamento de Tiptap: o editor de texto rico passa a ser carregado somente quando um modal/accordion o utiliza, e apenas as extensões efetivamente usadas ficam no bundle.
- Revisar o split de chunks do Vite para separar vendors pesados (gráficos, editor) e evitar que caiam no chunk da rota que não os usa.
- Adicionar medição de bundle com visualizer, gerando relatório local (`build:analyze`) sem penalizar o build normal.
- Definir orçamento de bundle e adicionar verificação automatizada (`check:bundle`) que falha quando um chunk ultrapassa o limite.
- Incluir a verificação de orçamento no CI, junto dos demais gates.
- **Não muda**: comportamento visível das telas, dados, APIs, RBAC, i18n ou persistência.

## Capabilities

### New Capabilities
- `web-bundle-budget`: carregamento sob demanda de dependências pesadas no web, medição do bundle e orçamento de tamanho verificável (local e no CI).

### Modified Capabilities
- `continuous-integration`: o pipeline passa a executar o gate de orçamento de bundle, reprovando pull requests que estourem o limite.

## Impact

- **Web (build):** `apps/web/vite.config.ts` (manualChunks/visualizer), `apps/web/package.json` (scripts `build:analyze`, devDependency do visualizer).
- **Web (código):** `apps/web/src/pages/ProjectDashboardPage.tsx`, `apps/web/src/components/dashboard/DashboardVisuals.tsx` (Recharts sob demanda), `apps/web/src/components/RichTextEditor.tsx` e consumidores (`ItemModal`, `StoryModal`, `EpicModal`, `ChecklistSection`, `GeneralSettingsSections`) (Tiptap sob demanda).
- **Ferramentas:** novo `scripts/check-bundle.ts` + orçamento versionado (ex.: `apps/web/bundle-budget.json`), script `check:bundle` no `package.json` raiz.
- **CI:** `.github/workflows/ci.yml` (novo passo de orçamento).
- **Dependências:** adicionar `rollup-plugin-visualizer` (MIT) apenas em devDependencies.
- **Documentação:** atualizar `docs/ANALISE-SISTEMA.md` (item 23) ao concluir.
- **Rastreabilidade:** Board ref: 1db05d5e-0333-4b38-8e43-de17e64715ec (Item 23: Bundle ainda é pesado).
- **Fora de escopo:** reescrita de telas, troca de bibliotecas de gráficos/editor, SSR, code splitting por sub-rotas além do necessário ao orçamento.
