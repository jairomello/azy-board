## Why

Equipes que usam squads precisam focar no trabalho do seu grupo sem ver cards de outras equipes. Hoje o board não oferece essa visão por squad, forçando o usuário a usar filtro de responsável membro a membro — o que é inviável em times maiores.

## What Changes

- Adicionar um novo filtro "Squad" na barra de filtros do board
- Quando um squad está selecionado, apenas cards atribuídos a membros daquele squad são exibidos
- Épicos que ficarem vazios após o filtro são ocultados automaticamente (comportamento já existente com `hideEmptyEpics`)
- Cards sem responsável são ocultados quando um squad está selecionado (não pertencem a nenhuma squad)

## Capabilities

### New Capabilities
- `board-squad-filter`: Filtro por squad na barra do board, exibindo apenas cards cujo responsável (`assignedTo`) é membro da squad selecionada

### Modified Capabilities
- `board-filters`: Adição do campo `squadId` ao estado `BoardFilterState` e ao componente `BoardFilters`

## Impact

- `apps/web/src/components/BoardFilters.tsx` — novo select de squad
- `apps/web/src/pages/BoardPage.tsx` — carregar lista de squads + membros por squad; aplicar filtro no `epicGroups` useMemo
- `apps/api/src/routes/projects.ts` — endpoint existente `GET /projects/:id/squads` já retorna squads; `GET /projects/:id/members` já retorna `squadId` por membro
- Sem novas rotas de API necessárias
