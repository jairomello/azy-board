# Tasks

## 1. Layout do painel de filtros

- [x] 1.1 Isolar as opções de Status em um contêiner `flex-wrap` próprio, com o rótulo fixo fora dele.
- [x] 1.2 Aplicar o mesmo alinhamento aos grupos Tipo e Tags.

## 2. Testes

- [x] 2.1 Regressão estrutural: todas as opções de Status pertencem ao contêiner de quebra, distinto do grupo com o rótulo.

## 3. Verificação e documentação

- [ ] 3.1 Rodar `bun run check` (typecheck, lint e build verdes; testes de paridade PostgreSQL falham por falta de banco local).
- [x] 3.2 Validar `bun run openspec:validate` e `bun run check:docs`.
- [x] 3.3 Criar a change OpenSpec com proposal, tasks e delta de `board-filters`.
