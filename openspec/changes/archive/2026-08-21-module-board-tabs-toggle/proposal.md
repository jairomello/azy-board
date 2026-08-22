## Why

A hierarquia Módulo → Épico → História → Cards organiza bem o board, mas pode concentrar informação demais em uma única tela. Usuários precisam escolher entre manter a hierarquia completa ou trabalhar com um módulo por vez em abas, reduzindo a densidade visual sem perder o acesso aos mesmos cards.

## What Changes

- Adicionar ao painel de filtros/visualização um seletor com dois modos válidos para a visualização Board: **Hierarquia** e **Abas por módulo**.
- Manter o modo Hierarquia como padrão e preservar a renderização atual de módulos agrupando swimlanes de épicos.
- Criar um modo Abas por módulo, exibindo uma guia para cada módulo e renderizando o board do módulo selecionado dentro da guia ativa.
- Incluir uma guia para itens sem módulo quando existirem épicos ou cards sem módulo.
- Persistir a preferência do modo de visualização por projeto, seguindo o padrão existente de filtros do board.
- Manter filtros de módulo, sprint, responsável, squad, tags e opções de cards funcionando nos dois modos.

## Capabilities

### New Capabilities

- `module-board-view-modes`: Modos alternativos de apresentação dos módulos no Board, com hierarquia completa ou abas por módulo.

### Modified Capabilities

- `board-filters`: O painel de filtros passa a controlar também o modo de apresentação dos módulos e persiste essa preferência.
- `epic-story-ui`: A renderização do board passa a oferecer abas de módulo como alternativa à hierarquia visual.

## Impact

- `apps/web/src/pages/BoardPage.tsx`: seleção do modo, módulo ativo e renderização condicional.
- `apps/web/src/components/BoardFilters.tsx` ou componente de visualização equivalente: novo controle de modo.
- `apps/web/src/components/BoardCommandBar.tsx`: integração do controle no painel de filtros, se necessário.
- `apps/web/src/i18n/locales/{pt-BR,en,es}/board.json`: labels dos modos e estados sem módulo.
- Persistência local dos filtros do board; nenhuma alteração na API ou no modelo de dados.
