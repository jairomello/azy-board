## Why

Quando vários filtros estão ativos, o usuário precisa abrir os controles para entender por que o Board está mostrando aquele conjunto de cards. Uma linha compacta de filtros ativos torna o estado atual visível e permite remover um filtro específico sem apagar toda a configuração.

## What Changes

- Adicionar uma linha de filtros ativos entre a barra de botões/controles e o conteúdo do Board.
- Representar cada filtro aplicado como uma tag compacta com nome legível e botão `x` para remoção individual.
- Exibir a linha somente quando houver pelo menos um filtro de conteúdo ou visualização efetivamente aplicado.
- Remover o filtro correspondente sem alterar os demais filtros, toggles ou preferências persistidas.
- Usar os nomes atuais dos catálogos para módulo, sprint, versão, squad, responsável, autor, tag e centro de custo, com fallback seguro para IDs.
- Manter acessibilidade por teclado, foco visível, `aria-label` e idioma PT-BR/EN/ES.
- Preservar a persistência existente por projeto e não criar endpoint ou alteração de banco.

## Capabilities

### New Capabilities

- `active-board-filter-chips`: visualização e remoção individual dos filtros ativos no Board.

### Modified Capabilities

- `board-filters-persistence`: a persistência existente passa a refletir imediatamente a remoção individual feita pela linha de filtros ativos.

## Impact

- `apps/web/src/pages/BoardPage.tsx` e barra de controles do Board.
- `apps/web/src/components/BoardFilters.tsx` ou novo componente de chips ativos.
- Tipos e traduções frontend.
- Testes de renderização, remoção individual, estado vazio e acessibilidade.
