## Context

O board web já usa TanStack Query (`useBoardData`) com escrita em cache via `setQueryData` e reconciliação por WebSocket. As mutações do board têm políticas divergentes: o drag (`useBoardInteraction`) faz snapshot + rollback + toast; `handleTitleSave` (`BoardScreen.tsx:515`) aplica o título otimista e **não** reverte em falha; `handleModalSave` (`BoardScreen.tsx:525`) faz duas requisições independentes (PATCH do item e POST de tags) e só invalida o cache se ambas passarem. `ChecklistSection` tem mutações otimistas com rollback e outras sem `try/catch`; `StoriesPanel.handleDelete` engole o erro.

No backend, `PATCH /projects/:projectId/items/:itemId` atualiza o item e o sprint na mesma transação (`items.ts:949`), mas **não** aceita `tagIds`; a rota separada `POST /:itemId/tags` grava tags em outra transação, sem broadcast e sem atualizar `updatedAt`. Não há coluna `version`; `updatedAt` existe mas nunca é comparado (update incondicional).

O requisito 4 da spec `client-cache` já exige rollback de mutações otimistas, hoje violado.

## Goals / Non-Goals

**Goals:**
- Toda mutação do board seguir um padrão explícito: otimista com snapshot e rollback, ou reconciliada.
- Corrigir `handleTitleSave` para reverter o título em falha.
- Salvar item + tags em uma única requisição transacional, com um broadcast, e reconciliar o cache pela resposta.
- Detectar conflito de edição por `updatedAt` e reconciliar em vez de sobrescrever.
- Eliminar `catch` silencioso e rejeições não tratadas nas mutações tocadas.

**Non-Goals:**
- Migrar as telas restantes (Projects, TreeView, AdminUsers, ApiKeys, Settings) para a camada de cache — isso é o card T6.
- Concorrência otimista para todas as entidades (apenas item).
- UI dedicada de resolução de conflito (apenas reconciliação + aviso).
- Renomear/redesenhar a API além do necessário (`tagIds` e `expectedUpdatedAt`).

## Decisions

### D1. Dois padrões explícitos, com helper puro testável
Centralizamos a política em um helper puro `runOptimisticMutation({ snapshot, apply, rollback, request, onError })` (em `features/board/model/`), mantendo o estilo testável de `createBoardInteractionHandler` (factory com `patch` injetável). Mutação otimista passa pelo helper; mutação reconciliada apenas aguarda a resposta e aplica/invalida. Alternativa: `useMutation` do TanStack Query — rejeitada por acoplar a lógica a React e dificultar o teste puro que já existe; o helper pode, no futuro, virar `onMutate`/`onError` de `useMutation` sem reescrever os handlers.

### D2. Salvamento atômico estendendo o PATCH/POST existente
Adicionamos `tagIds` opcional a `createItemSchema`/`updateItemSchema` e persistimos item + tags na transação já existente de `items.ts`, emitindo um único `ITEM_UPDATED` com as tags. Alternativa: novo endpoint `/items/:id/save` — rejeitado por duplicar a lógica de hierarquia/analytics/logs; alternativa: transação no cliente — impossível entre duas requisições HTTP.

### D3. Conflito por `expectedUpdatedAt` no corpo, resposta 409
O `PATCH` aceita `expectedUpdatedAt` (string ISO). O update vira condicional (`WHERE ... AND updated_at = expected`); se `rowsAffected === 0` e o item existe, respondemos **409 `CONFLICT`** com o item atual. Alternativa: `If-Match`/ETag — mais padrão, porém exige expor ETag e tratar header em todas as camadas; alternativa: coluna `version` inteira — mudança de schema/migration maior. `updatedAt` já existe e é suficiente para edição de item.

### D4. Reconciliar a partir da resposta e do 409
Em sucesso, o handler aplica o item retornado (com tags) via `setQueryData`. Em 409, aplica o item atual retornado pelo servidor e avisa o usuário. Assim o cache converge sem depender de refetch, e o WebSocket cobre outros clientes.

### D5. Rollback direcionado, não da lista inteira
O rollback restaura apenas o item/coluna afetado (por id) a partir do snapshot, evitando sobrescrever atualizações incrementais que chegaram por WebSocket durante a requisição. Para reordenação, restaura a ordem capturada.

### D6. Erros sempre visíveis
`StoriesPanel.handleDelete` e os CRUD de `ChecklistSection` passam a capturar e sinalizar erro (toast/`mutationError`); nenhuma mutação fica sem tratamento. Mensagens traduzidas nos 3 idiomas quando exibidas na UI.

### D7. Expor `updatedAt` no contrato do item
`ItemData` (`features/board/model/types.ts`) passa a incluir `updatedAt`, e a API já o devolve nas leituras de item. `Card` (contrato de renderização) não muda.

### D8. Fronteira com o card T6
Não migramos telas para o cache; apenas unificamos a política das mutações já existentes no board e nos componentes de item.

## Risks / Trade-offs

- **Falso conflito por `updatedAt` alterado por outra operação** (ex.: outro campo salvo por outro cliente) → comportamento desejado: 409 e reconciliação; o usuário reaplica se necessário.
- **Precisão de `updatedAt`** (string ISO em ms) → comparação exata; o servidor gera o valor, evitando clock do cliente.
- **Broadcast de tags antes inexistente** → passa a existir no `ITEM_UPDATED`; outros clientes precisam mesclar `tags` no `applyBoardEvent`, coberto por teste.
- **Rollback direcionado vs. snapshot completo** → reduz risco de sobrescrever WS, mas exige rollback por id; coberto por testes de interação.
- **`tagIds` em schemas `.strict()`** → campo novo opcional; clientes que não o enviam não quebram; MCP/batch não enviam `tagIds` no update.
- **Duplicação com T6** → escopo explicitamente limitado ao board/componentes de item.

## Migration Plan

- PR único; **sem migration de banco** (`updatedAt` já existe).
- Ordem: (1) API (`validation.ts`, `routes/items.ts`, código `CONFLICT`); (2) contrato `ItemData.updatedAt`; (3) helper de mutação + `useBoardInteraction` + `BoardScreen`; (4) `ItemModal`/`ChecklistSection`/`StoriesPanel`; (5) testes (unidade, contrato, integração).
- Verificação: `bun run check` e `bun run test:smoke`; `bun run test:regression` para a bateria completa.
- Rollback: reverter o PR; nenhum dado/schema é afetado.

## Open Questions

- Adotar uma coluna `version` inteira em uma iteração futura para conflito mais explícito?
- O `expectedUpdatedAt` deve ser obrigatório em alguma rota (ex.: update em lote) ou sempre opcional?
