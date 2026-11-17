# Tasks

## 1. Controles por visualização

- [x] 1.1 `BoardFilters` recebe a visualização atual e exibe somente os controles com efeito nela.
- [x] 1.2 `Opções` passa a aparecer também na árvore, com cronograma e exportação.
- [x] 1.3 No Unificado, expor subtasks e histórias como cards; manter ocultos os controles de lane.
- [x] 1.4 Na árvore, expor **Ocultar ramos vazios** (módulos/épicos) e **Ocultar histórias vazias**.
- [x] 1.5 Omitir o caminho crítico na árvore, onde não há destaque.

## 2. Árvore

- [x] 2.1 Aplicar `hideEmptyStories` na grade, removendo histórias sem filhos visíveis.
- [x] 2.2 Remover módulos sem descendentes e aplicar histórias antes dos ramos.

## 3. Testes

- [x] 3.1 Cobrir a matriz de controles no painel para Board, Unificado e Árvore.
- [x] 3.2 Cobrir ocultar histórias e ramos vazios na grade, incluindo módulos e a combinação dos dois.
- [x] 3.3 Cobrir `Opções` disponível na árvore.

## 4. Verificação e documentação

- [x] 4.1 Rodar `bun run typecheck`, `bun run lint`, testes web e build.
- [x] 4.2 Validar `bun run openspec:validate` e `bun run check:docs`.
- [x] 4.3 Atualizar CHANGELOG e wiki (controles de visualização e árvore).
