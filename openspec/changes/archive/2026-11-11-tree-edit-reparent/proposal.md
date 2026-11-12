# Proposal

## Why

O PR #4 entregou edição pelo ícone de tipo e movimentação de itens entre pais na Tree View, mas não registrou artefatos OpenSpec. A spec `tree-view` ficou sem descrever o reparentamento e o novo ponto de entrada de edição, deixando o comportamento publicado sem contrato verificável.

## What Changes

- Documentar a edição de item pelo ícone de tipo na linha da Tree View.
- Documentar o arraste de itens entre pais, com as regras de hierarquia aceitas (EPIC → módulo, STORY → EPIC, TASK/BUG/EXTERNAL → STORY/TASK/BUG), detecção de ciclo e preservação do módulo.
- Registrar a revalidação de hierarquia no servidor e a atualização da árvore após o movimento.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `tree-view`: acrescenta o reparentamento por arraste e o atalho de edição pelo ícone de tipo.

## Impact

- Frontend: `apps/web/src/pages/TreeViewPage.tsx`, `apps/web/src/pages/treeMoveRules.ts`.
- API: `PATCH /projects/:id/items/:id` com `parentId`/`moduleId` e validação de hierarquia.
- Testes: regras de movimento, ações da linha e integração de hierarquia.
