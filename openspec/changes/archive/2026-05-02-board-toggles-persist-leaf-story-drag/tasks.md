## 1. Persistência de toggles de visualização

- [x] 1.1 Adicionar `showSubtasks: boolean` e `showStories: boolean` ao `BoardFilterState` em `BoardFilters.tsx`
- [x] 1.2 Atualizar `DEFAULT_FILTERS` em `BoardPage.tsx` com `showSubtasks: false` e `showStories: true`
- [x] 1.3 Alterar carregamento dos filtros para usar merge `{ ...DEFAULT_FILTERS, ...JSON.parse(raw) }` (retrocompatibilidade)
- [x] 1.4 Remover estados standalone `showSubtasks` e `showStories` de `BoardPage.tsx` e substituir por `filters.showSubtasks` / `filters.showStories`
- [x] 1.5 Atualizar callbacks `onToggleSubtasks` e `onToggleStories` para operar via `setFilters`
- [x] 1.6 Atualizar `clear()` em `BoardFilters.tsx` para preservar `showSubtasks` e `showStories`

## 2. Persistência do estado de swimlanes recolhidas

- [x] 2.1 Inicializar `collapsedEpics` a partir de `board-collapsed-epics:<projectId>` no `localStorage`
- [x] 2.2 Adicionar `useEffect` para persistir `collapsedEpics` sempre que o estado mudar

## 3. Histórias folha como cards arrastáveis

- [x] 3.1 Atualizar `boardCards` em `BoardPage.tsx` para incluir histórias folha quando `showStories` está ativo, com fallback `columnId ?? columns[0].id`
- [x] 3.2 Atualizar `storyVirtualCards` para filtrar apenas histórias não-folha (`!s.isLeaf`)
- [x] 3.3 Alterar condição `disabled` em `KanbanCard.tsx` para permitir arraste de STORY folha (`disabled: !card.isLeaf || card.type === 'EPIC'`)
- [x] 3.4 Alterar `handleDragEnd` em `BoardPage.tsx`: remover `STORY` da lista de tipos bloqueados (`item.type === 'EPIC'` em vez de `['EPIC', 'STORY'].includes`)
- [x] 3.5 Atualizar `handleOpenDetail` para abrir `StoryModal` ao clicar em card de STORY folha com ID real (não prefixado)
- [x] 3.6 Atualizar endpoint `PATCH /projects/:projectId/items/:itemId/move` na API para aceitar `STORY` como tipo movível (mantendo `isLeaf` check)
