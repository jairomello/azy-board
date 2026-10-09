# Tasks

## 1. Reordenar o controle de criação

- [x] 1.1 Em `apps/web/src/features/board/components/BoardColumns.tsx`, mover o bloco `<div className="board-column-add">` (botão `+ Adicionar card` e `AddCardForm`) para o topo do `DroppableColumn`, imediatamente antes de `<div className="board-column-cards">`, preservando `allowAdd`, `columnAddForms` e os handlers `onShowAddForm`/`onHideAddForm`/`onCardCreate`. Verificar abrindo o formulário no topo e criando um card (card aparece em tempo real).

## 2. Espaçamento e densidade

- [x] 2.1 Ajustar `apps/web/src/styles/globals.css` para o controle no topo (`board-column-add` com recuo horizontal igual ao da lista e sem `mt-1` de rodapé; `board-column-cards` com separação superior adequada) e adicionar a redução correspondente em `.density-compact`. Verificar visualmente coluna com muitos cards, coluna vazia e formulário aberto nas densidades confortável e compacta, nos temas claro e escuro.

## 3. Verificação

- [x] 3.1 Regenerar a baseline visual do board (`E2E_UPDATE_SNAPSHOTS=1 bun run test:visual`) e depois rodar `bun run test:visual` para confirmar; rodar `bun run test:web` e `bun run check:frontend-tests`.
- [x] 3.2 Rodar `bun run typecheck` e conferir manualmente que, em uma coluna longa, o controle permanece no topo sem exigir rolagem e que o arraste/drop continua funcionando no topo e entre cards.

## Workflow follow-up

- Executar `bun run check` e `bun run test:smoke` ao concluir, conforme o repositório.
- Se o trabalho for vinculado a um card do Azy Board, registrar `Board ref: <itemId>` e fechar o card com `complete_task`.
