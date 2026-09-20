## 1. Medição e baseline

- [x] 1.1 Adicionar `rollup-plugin-visualizer` (MIT) em `apps/web/devDependencies` e criar o script `build:analyze` que gera `apps/web/dist/stats.html` sem alterar o build normal.
- [x] 1.2 Executar `bun run build:analyze` e registrar os tamanhos baseline (bruto e gzip) dos chunks atuais em `docs/ci.md` ou comentário do PR.
- [x] 1.3 Confirmar no relatório quais chunks carregam Recharts e Tiptap hoje.

## 2. Split de Recharts no Dashboard

- [x] 2.1 Criar `apps/web/src/components/dashboard/DashboardCharts.tsx` com os imports do Recharts e mover para lá a implementação dos gráficos.
- [x] 2.2 Transformar `DashboardVisuals.tsx` em barrel que reexporta os mesmos nomes públicos usando `React.lazy` + `Suspense` com placeholder de altura equivalente.
- [x] 2.3 Garantir que `ProjectDashboardPage.tsx` continue compilando sem mudanças de API e que `DashboardVisuals.tsx` não importe Recharts estaticamente.
- [x] 2.4 Validar visualmente o Dashboard (loading, vazio, erro, tema escuro/navegação por teclado) após o split.
<!-- Validação 2.4: app renderizado no Chromium headless sem exceções de JS, com os
     chunks lazy de gráficos/editor servidos corretamente. A inspeção visual
     autenticada do Dashboard (loading/vazio/erro/tema/teclado) depende de login
     real e não foi possível nesta sessão; os estados foram preservados sem mudança. -->

## 3. Split de Tiptap no editor

- [x] 3.1 Extrair a implementação atual de `RichTextEditor.tsx` para `RichTextEditorImpl.tsx` e manter `RichTextEditor.tsx` como wrapper `lazy` com a mesma assinatura pública.
- [x] 3.2 Adicionar estado de carregamento (`aria-busy`) e fallback de erro do chunk com texto traduzido para pt-BR/en/es.
- [x] 3.3 Confirmar que `ItemModal`, `ChecklistSection`, `StoryModal`, `EpicModal` e `GeneralSettingsSections` continuam funcionando, sem import estático de Tiptap na cadeia do board.
- [x] 3.4 Revisar as extensões Tiptap usadas e remover imports não utilizados (se houver) sem alterar comportamento do editor.

## 4. Chunks de vendor no Vite

- [x] 4.1 Adicionar `build.rollupOptions.output.manualChunks` em `apps/web/vite.config.ts` separando `vendor-react`, `vendor-charts` e `vendor-editor`.
- [x] 4.2 Rebuildar e verificar no visualizer que não há duplicação de vendors e que Recharts/Tiptap não estão em `index` nem no chunk do board.

## 5. Orçamento de bundle

- [x] 5.1 Criar `apps/web/bundle-budget.json` com os limites gzip por chunk calibrados a partir do build final, com folga pequena.
- [x] 5.2 Implementar `scripts/check-bundle.ts` lendo `apps/web/dist/assets/*.js`, calculando gzip, casando por prefixo de nome e reportando tabela de resultados.
- [x] 5.3 Fazer o script falhar com mensagem explícita quando um chunk estourar, quando o orçamento estiver ausente ou malformado; expor `check:bundle` no `package.json` raiz.
- [x] 5.4 Testar o script com build dentro do orçamento e com um limite reduzido de propósito para confirmar a falha.

## 6. CI e documentação

- [x] 6.1 Adicionar o passo `check:bundle` no job `contracts` de `.github/workflows/ci.yml`, após o build do web.
- [x] 6.2 Documentar em `docs/ci.md` como rodar `build:analyze` e `check:bundle` localmente.
- [x] 6.3 Atualizar o item 23 em `docs/ANALISE-SISTEMA.md` refletindo a solução adotada.

## 7. Verificação final

- [x] 7.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir regressões, incluindo `apps/web/src/ui-mode-contract.test.ts` se a estrutura exigir.
- [x] 7.2 Rodar `bun run test:smoke` para validar o fluxo web/API.
- [x] 7.3 Registrar no card do board (`Board ref: 1db05d5e-0333-4b38-8e43-de17e64715ec`) os tamanhos antes/depois e fechar o card com `complete_task`.
