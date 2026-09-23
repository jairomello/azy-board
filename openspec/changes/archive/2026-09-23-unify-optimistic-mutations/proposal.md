## Why

As mutações do board tratam falha de formas diferentes: o drag faz rollback, o salvamento de título mantém o valor otimista mesmo quando a API falha (`BoardScreen.handleTitleSave`), e a edição de item faz **duas** requisições independentes (item e tags) sem transação — se a segunda falhar, os campos já foram salvos mas as tags não, e a UI mostra um erro genérico. Isso viola o requisito de mutações otimistas com rollback já existente na capability `client-cache` e deixa o cache divergente do servidor.

## What Changes

- **Política única de mutação otimista**: toda mutação do board segue um de dois padrões explícitos — otimista com snapshot e rollback, ou não otimista com reconciliação a partir da resposta. `handleTitleSave` passa a restaurar o título anterior em falha.
- **Salvamento coordenado de item + relações**: `POST`/`PATCH /projects/:projectId/items` passam a aceitar `tagIds` opcional e persistem item + tags **na mesma transação**, com um único broadcast. O web deixa de fazer duas chamadas e reconcilia o cache a partir da resposta.
- **Detecção de conflito de edição**: os itens passam a expor `updatedAt` no payload e o `PATCH /items/:itemId` aceita `expectedUpdatedAt`; se o registro tiver mudado desde a leitura, a API responde **409 `CONFLICT`** com o estado atual, e o cliente reconcilia o cache em vez de sobrescrever.
- **Erros padronizados**: mutações deixam de ter `catch` silencioso (`StoriesPanel.handleDelete`) e rejeições não tratadas (`ChecklistSection` CRUD); falhas geram rollback/reconciliação e um aviso ao usuário.
- **BREAKING** (interno): `handleModalSave`/`handleModalCreate` mudam de duas chamadas para uma; o schema `updateItemSchema`/`createItemSchema` ganha `tagIds` e `expectedUpdatedAt` (schemas são `.strict()`, então consumidores antigos continuam válidos).

## Capabilities

### New Capabilities
- `optimistic-mutations`: política uniforme de mutação no web (otimista com rollback vs. reconciliação), salvamento coordenado de item e relações, e tratamento de conflito 409 sem deixar o cache divergente.

### Modified Capabilities
- `unified-item-model`: `POST`/`PATCH /projects/:projectId/items` aceitam `tagIds` e persistem item + tags atomicamente; itens expõem `updatedAt`; update condicional com `expectedUpdatedAt` retorna 409 em conflito.
- `client-cache`: o requisito de mutações otimistas com rollback passa a valer para todas as mutações, com cenários de rollback de título, salvamento atômico de item+tags e reconciliação em conflito.

## Impact

- Web: `features/board/hooks/useBoardInteraction.ts`, `features/board/BoardScreen.tsx` (`handleTitleSave`, `handleModalSave`, `handleModalCreate`), `components/ItemModal.tsx`, `components/ChecklistSection.tsx`, `components/StoriesPanel.tsx`, `features/board/model/types.ts` (`updatedAt`).
- API: `routes/items.ts` (create/update atômicos com tags, update condicional), `validation.ts` (`tagIds`, `expectedUpdatedAt`), `middleware/errorResponse.ts` (código `CONFLICT`).
- Contratos: `packages/types` (payload de item com `updatedAt`).
- Testes: `features/board/board-interaction.test.ts`, novos testes de rollback de título e de item+tags, integração da API para atomicidade e conflito.
- Fora de escopo: migrar as telas restantes para a camada de cache (card T6), concorrência otimista para todas as entidades, UI dedicada de resolução de conflito (apenas reconciliação + aviso).

Board ref: ecd5f774-a0e6-4122-91b7-006d355efa9c
