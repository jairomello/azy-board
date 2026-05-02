## 1. BoardPage — Carregar squads e membros

- [x] 1.1 No `useEffect` de carregamento inicial do `BoardPage`, adicionar `GET /projects/:id/squads` e `GET /projects/:id/members` para popular estado `projectSquads` e `projectMembers`
- [x] 1.2 Derivar `squadMembersMap: Map<squadId, Set<userId>>` via `useMemo` a partir de `projectMembers`, para lookup O(1) no filtro

## 2. BoardFilterState — Adicionar campo squadId

- [x] 2.1 Adicionar campo `squadId: string` (vazio = sem filtro) ao tipo `BoardFilterState` em `BoardFilters.tsx`
- [x] 2.2 Atualizar o valor inicial do estado de filtros em `BoardPage` para incluir `squadId: ''`
- [x] 2.3 Atualizar a função `clear()` / reset de filtros para resetar `squadId: ''`
- [x] 2.4 Incluir `squadId` no contador de filtros ativos (`activeCount`)

## 3. BoardFilters — Select de squad

- [x] 3.1 Adicionar prop `squads: { id: string; name: string }[]` ao componente `BoardFilters`
- [x] 3.2 Renderizar select de squad (após select de responsável) somente quando `squads.length > 0`
- [x] 3.3 Opção padrão "Todas as squads" com value `''`
- [x] 3.4 Passar `projectSquads` como prop `squads` na instância de `BoardFilters` em `BoardPage`

## 4. BoardPage — Aplicar filtro no epicGroups

- [x] 4.1 No `useMemo` de `boardCards`, aplicar filtro de squad: quando `filters.squadId` está preenchido, manter apenas cards onde `squadMembersMap.get(filters.squadId)?.has(assigneeId)` é verdadeiro
- [x] 4.2 Quando `filters.squadId` está preenchido, ocultar automaticamente épicos sem cards visíveis (equivalente a `hideEmptyEpics: true`), independentemente do toggle manual
