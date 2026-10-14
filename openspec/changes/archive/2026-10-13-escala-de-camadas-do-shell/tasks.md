# Tasks

## 1. Escala de camadas do shell

- [x] 1.1 Ajustar em `apps/web/src/components/AppShell.tsx` os valores de z-index para command bar `z-20`, header `z-30` e sidebar `z-40`, e reescrever o comentário que documenta a ordem (conteúdo → command bar → header → sidebar → overlays globais). Verificação: `bun run --cwd apps/web typecheck` sem erros e os três valores presentes no arquivo.
- [x] 1.2 Atualizar `apps/web/src/app-shell-layout-contract.test.ts` para os novos valores e acrescentar uma asserção de **ordem** (extrair o número de cada marcador e exigir `header > commandBar > 0` e ambos `< 50`), para o contrato não voltar a aceitar a inversão. Verificação: `bun test apps/web/src/app-shell-layout-contract.test.ts` passa.
- [x] 1.3 Conferir o comportamento observável no board, com a command bar visível: o menu do perfil, o seletor de idioma e o alternador de tema aparecem inteiros e clicáveis (inclusive o primeiro item); os popovers de filtros, opções e criação da command bar continuam acima das colunas; a emenda entre sidebar e header segue sem sombra ou borda indevida em `lg` e em `≥1280px`, e no mobile. Verificação: observação direta no navegador em cada um dos casos.

## 2. Verificação de integração

- [x] 2.1 Rodar `bun run check` e confirmar typecheck, lint, testes e build sem falhas.
- [x] 2.2 Rodar `bun run test:smoke` e confirmar que o fluxo web/API não regrediu.
