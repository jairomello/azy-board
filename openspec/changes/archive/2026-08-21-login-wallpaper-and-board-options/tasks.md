## 1. Tratamento Do Login

- [x] 1.1 Adicionar camada separada para aplicar desfoque gaussiano forte sobre o wallpaper da LoginPage.
- [x] 1.2 Adicionar overlay escuro sem afetar o card e os painéis internos.
- [x] 1.3 Reforçar a sombra do card externo e manter o conteúdo em camada nítida acima do fundo.
- [x] 1.4 Verificar responsividade e ausência de overflow do wallpaper em desktop, tablet e mobile.

## 2. Separação De Filtros E Opções

- [x] 2.1 Refatorar `BoardFilters` para separar filtros de dados das opções de visualização.
- [x] 2.2 Adicionar botão/menu `Opções` independente do botão `Filtros` na `BoardCommandBar`.
- [x] 2.3 Mover Hierarquia/Abas, subtasks, histórias, ocultação de lanes e expansão/colapso para `Opções`.
- [x] 2.4 Manter em `Filtros` apenas módulo, sprint, responsável, squad, tipos e tags.
- [x] 2.5 Garantir que abrir um menu feche o outro e que limpar filtros não altere opções de visualização.

## 3. Textos E Traduções

- [x] 3.1 Renomear o fallback `Fluxo contínuo` para `Progresso Geral` no `BoardContext`.
- [x] 3.2 Adicionar traduções dos botões, menus e rótulos em PT-BR, EN e ES.

## 4. Validação

- [x] 4.1 Executar `bun run typecheck`, `bun run build:web`, `bun test` e `git diff --check`.
- [x] 4.2 Validar visualmente o login com blur, overlay e sombra em desktop, tablet e mobile.
- [ ] 4.3 Validar menus Filtros/Opções, persistência das opções e renomeação do progresso no Board.
