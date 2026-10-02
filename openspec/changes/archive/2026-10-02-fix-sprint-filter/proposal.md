## Why

O filtro por sprint no Board (kanban) não funciona: ao selecionar uma sprint, nenhum card é exibido. A causa raiz é uma inconsistência entre a API e o frontend — o endpoint `GET /projects/:projectId/items` remove o campo `itemSprints` da resposta na projeção (linha 367 de `items.ts`), mas o `BoardScreen` tenta filtrar usando exatamente esse campo (`i.itemSprints?.some(...)` na linha 251). O resultado é que `undefined?.some(...)` sempre retorna `undefined`, e o board fica vazio.

## What Changes

- Corrigir a projeção de resposta do `GET /projects/:projectId/items` para **preservar** o array `itemSprints` em vez de deletá-lo, mantendo também o campo achatado `sprintId` para compatibilidade.
- Garantir que o filtro client-side no `BoardScreen` use o campo correto (e que funcione para itens com múltiplas sprints).
- Adicionar testes de regressão que validem a presença de `itemSprints` na resposta da API e o comportamento do filtro por sprint.

## Capabilities

### New Capabilities

- `sprint-filter-fix`: Correção do filtro por sprint no Board, garantindo que `itemSprints` esteja presente na resposta da API e que o filtro client-side funcione corretamente.

### Modified Capabilities

_(nenhuma capability existente tem mudança de requisitos — é apenas correção de bug)_

## Impact

- **Backend**: `apps/api/src/routes/items.ts` — projeção de resposta (linhas 359-368)
- **Frontend**: `apps/web/src/features/board/BoardScreen.tsx` — filtro client-side (linhas 250-252, 287-288, 874)
- **Tipos**: `apps/web/src/features/board/model/types.ts` — tipo `ItemData` (já declara `itemSprints`, sem mudança necessária)
- **Testes**: testes de API para validar resposta e testes de filtro no frontend
- **Board ref**: B2 — Filtro por Sprint não está funcionando (`06ac8ce7-1e3e-4aaf-be18-46b2189cad3a`)