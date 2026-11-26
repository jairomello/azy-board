# Tasks

## 1. Catálogo único

- [x] 1.1 Criar `lib/taskStatus.ts` com os sete status editáveis na ordem do fluxo, sem `ARCHIVED`, e o rótulo via `common:status.*`.
- [x] 1.2 Usar o catálogo no `<select>` da modal e no chip do cabeçalho, eliminando o ternário de cinco status.
- [x] 1.3 Usar o mesmo rótulo no painel de subtasks e remover o mapa parcial morto de `features/board/model/types.ts`.

## 2. Testes

- [x] 2.1 Catálogo: sete valores, sem `ARCHIVED`, com rótulo próprio em pt-BR, en e es.
- [x] 2.2 Modal: sete opções, status atual selecionado, chip correto para Planejada e Em homologação e salvamento do novo valor.
- [x] 2.3 Subtasks: filho em homologação exibe o rótulo traduzido, não o código.
- [x] 2.4 Paridade de i18n inclui `IN_HOMOLOGATION` entre filtro e grade.

## 3. Documentação e verificação

- [x] 3.1 Atualizar o guia de edição de tasks e bugs com os sete estados disponíveis.
- [x] 3.2 Rodar `bun run check` e `bun run test:smoke`.
- [x] 3.3 Validar `bun run openspec:validate` e `bun run check:docs`.
