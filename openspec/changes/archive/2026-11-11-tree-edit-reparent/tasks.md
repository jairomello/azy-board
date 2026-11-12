# Tasks

> Change retroativa: documenta comportamento já entregue no PR #4 (`24726a8`).

## 1. Reparentamento na árvore

- [x] 1.1 Resolver o patch de hierarquia no cliente para EPIC → módulo, STORY → EPIC e TASK/BUG/EXTERNAL → STORY/TASK/BUG (`treeMoveRules.ts`).
- [x] 1.2 Bloquear no cliente movimentos inválidos, no-op e ciclos, usando o mapa filho→pai da árvore exibida.
- [x] 1.3 Propagar o módulo do pai de destino para o item movido.
- [x] 1.4 Enviar `PATCH /projects/:id/items/:id` com `parentId`/`moduleId` e recarregar a árvore após sucesso.

## 2. Edição pelo ícone de tipo

- [x] 2.1 Tornar o ícone de tipo um atalho para a modal de edição, respeitando permissões e sem expandir o nó.
- [x] 2.2 Adicionar rótulos i18n do atalho em pt-BR, en e es.

## 3. Verificação

- [x] 3.1 Testar as regras de movimento (`tree-move-rules.test.ts`).
- [x] 3.2 Testar as ações da linha (`tree-view-item-actions.test.tsx`).
- [x] 3.3 Cobrir a revalidação de hierarquia na API (`integration.test.ts`).
