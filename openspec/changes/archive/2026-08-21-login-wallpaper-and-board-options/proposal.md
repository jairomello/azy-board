## Why

A imagem de fundo da tela de login já foi incorporada, mas ainda compete visualmente com o card. Um desfoque forte, escurecimento e sombra no card devem criar separação e foco no formulário. No board, os toggles de exibição estão escondidos dentro de “Filtros”, dificultando encontrá-los como opções de visualização, e o rótulo “Fluxo contínuo” não comunica que o indicador representa o progresso geral do projeto.

## What Changes

- Aplicar desfoque gaussiano forte e uma camada escura sobre o wallpaper da LoginPage.
- Adicionar sombra mais evidente ao card de login para destacá-lo do fundo.
- Manter o wallpaper responsivo sem afetar a legibilidade dos painéis do card.
- Remover os toggles de exibição do conteúdo interno do botão “Filtros”.
- Criar um botão separado “Opções” na toolbar para abrir as opções de exibição do board, incluindo Hierarquia/Abas, subtasks, histórias e expansão/colapso.
- Renomear “Fluxo contínuo” para “Progresso Geral” no cabeçalho de contexto do board.

## Capabilities

### New Capabilities

- `login-wallpaper-treatment`: Tratamento visual do wallpaper com desfoque, escurecimento e destaque do card.
- `board-options-menu`: Acesso separado às opções de visualização do board, fora do menu de filtros de dados.
- `board-context-label`: Rótulo padrão “Progresso Geral” para o contexto do board quando não há sprint ativa.

### Modified Capabilities

- `board-filters`: O botão Filtros passa a conter somente filtros de dados, enquanto as opções de apresentação ficam no botão Opções.

## Impact

- `apps/web/src/pages/LoginPage.tsx`: camadas visuais, blur, overlay e sombra.
- `apps/web/src/components/BoardCommandBar.tsx` e `BoardFilters.tsx`: separação dos menus.
- `apps/web/src/components/BoardContext.tsx`: novo rótulo padrão.
- Traduções PT-BR, EN e ES relacionadas à LoginPage e ao board.
- Nenhuma alteração em API, banco, autenticação ou dependências.
