## Why

Os toggles de visualização do board (`showSubtasks`, `showStories`) e o estado de expansão das swimlanes (`collapsedEpics`) não eram persistidos no `localStorage`, obrigando o usuário a reconfigurar a visão a cada acesso. Além disso, histórias sem tarefas filhas ficavam presas na primeira coluna sem permitir progressão no board, impedindo seu uso como itens de trabalho independentes.

## What Changes

- `showSubtasks` e `showStories` passam a fazer parte de `BoardFilterState` e são persistidos junto com os filtros em `board-filters:<projectId>`
- `collapsedEpics` (swimlanes recolhidas) é persistido em `board-collapsed-epics:<projectId>`
- O carregamento dos filtros usa merge com `DEFAULT_FILTERS` para retrocompatibilidade com estados salvos antes desta mudança
- `clear()` dos filtros preserva `showSubtasks` e `showStories` (são opções de visualização, não filtros de dados)
- `DEFAULT_FILTERS` agora define `showStories: true`, tornando a exibição de histórias padrão em boards novos
- Histórias com `isLeaf = true` (sem tarefas filhas) aparecem como cards reais no board, são arrastáveis entre colunas e têm `status` atualizado pelo movimento
- Cards virtuais (`story-virtual-*`) continuam sendo usados apenas para histórias não-folha
- API `PATCH /items/:id/move` agora aceita `type = STORY` desde que o item seja folha

## Capabilities

### New Capabilities
- `leaf-story-kanban`: STORY sem tarefas filhas é tratada como card arrastável no Kanban — possui `columnId`, `status` e pode ser movida entre colunas exatamente como TASK/BUG

### Modified Capabilities
- `board-filters-persistence`: toggles de visualização (`showSubtasks`, `showStories`) agora fazem parte do estado persistido; adiciona persistência de `collapsedEpics`
- `toolbar-icon-buttons`: toggles de visualização persistem entre sessões (estado restaurado do `localStorage`)

## Impact

- **Frontend**: `BoardFilters.tsx` — `BoardFilterState` ampliado; `BoardPage.tsx` — remoção dos estados standalone `showSubtasks`/`showStories`, nova lógica de `boardCards` para histórias folha, `storyVirtualCards` filtrado para não-folha, `handleDragEnd` permite STORY; `KanbanCard.tsx` — condição `disabled` relaxada para STORY folha
- **API**: `PATCH /projects/:projectId/items/:itemId/move` — aceita `STORY` como tipo movível (mantém `isLeaf` check)
- **localStorage**: nova chave `board-collapsed-epics:<projectId>`; estrutura de `board-filters:<projectId>` ampliada com `showSubtasks` e `showStories`
