## Context

O board já possui uma barra de filtros (`BoardFilters.tsx`) com filtros client-side por módulo, sprint, responsável, tipo e tag. Os dados de squads e membros já são carregados na `SettingsPage`, e os endpoints `GET /projects/:id/squads` e `GET /projects/:id/members` (com `squadId` por membro) já existem no backend. O filtro de squad é puramente client-side: o board já tem todos os cards em memória, basta cruzar `assignedTo` do card com a lista de `userId` dos membros da squad selecionada.

## Goals / Non-Goals

**Goals:**
- Exibir um select de squad na barra de filtros do board
- Filtrar cards cujo `assignedTo` pertence à squad selecionada
- Ocultar épicos que ficam sem cards após o filtro (reusa `hideEmptyEpics` já existente)
- Carregar squads e membros junto com os demais dados iniciais do board (sem nova rota de API)

**Non-Goals:**
- Filtro de squad na TreeView (escopo separado)
- Filtro por múltiplas squads simultaneamente
- Persistência do filtro de squad em URL ou localStorage
- Mostrar cards sem responsável quando filtro de squad está ativo

## Decisions

**Client-side filtering (sem nova rota de API)**
O board já carrega todos os cards em memória. Cruzar `assignedTo` com o conjunto de `userId` dos membros da squad é O(n) e sem custo de rede. Alternativa (server-side) seria mais complexa e quebraria a premissa de filtros reativos sem re-fetch.

**Conjunto de userIds por squad em memória**
No `BoardPage`, ao carregar membros (`GET /projects/:id/members`), derivar um `Map<squadId, Set<userId>>`. Ao filtrar, basta checar `squadMembersMap.get(selectedSquadId)?.has(card.assignedTo)`. Simples e O(1) por card.

**`hideEmptyEpics` implícito quando squad está ativo**
Quando `squadId` está selecionado, épicos sem cards visíveis devem sumir. Isso já é o comportamento existente de `hideEmptyEpics`. A opção mais limpa é ativar automaticamente `hideEmptyEpics` no `useMemo` de `epicGroups` quando `squadId` está preenchido, sem exigir que o usuário ligue o toggle manualmente.

**Posicionamento no `BoardFilters`**
O select de squad fica após o select de responsável (fluxo natural: primeiro filtra por equipe, depois por pessoa específica).

## Risks / Trade-offs

- [Risco] Membro removido da squad sem o board recarregar → o `Map` fica desatualizado.  
  **Mitigação**: o board já recarrega membros via WebSocket em eventos `MEMBER_UPDATED`; se não, o reload manual resolve.

- [Trade-off] Ocultar épicos implicitamente pode surpreender o usuário que espera ver épicos vazios.  
  **Decisão aceita**: a proposta já especifica esse comportamento, e é o esperado para foco de squad.
