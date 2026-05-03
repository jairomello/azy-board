## 1. Persistência do estado de filtros

- [x] 1.1 Extrair a constante `DEFAULT_FILTERS` para fora do componente em `BoardPage.tsx`, com o estado padrão de `BoardFilterState` (todos os campos em branco/desativado)
- [x] 1.2 Substituir a inicialização do `useState<BoardFilterState>` por um lazy initializer que lê `localStorage.getItem('board-filters:<projectId>')`, faz parse JSON e retorna `DEFAULT_FILTERS` em caso de ausência ou erro de parse (try/catch)
- [x] 1.3 Adicionar `useEffect` que observa `[filters, projectId]` e chama `localStorage.setItem('board-filters:<projectId>', JSON.stringify(filters))` em try/catch silencioso para tolerar `SecurityError`

## 2. Limpeza de filtros

- [x] 2.1 Verificar que a ação "Limpar filtros" chama `setFilters(DEFAULT_FILTERS)` — isso é suficiente para acionar o efeito do item 1.3 e persistir o estado limpo no `localStorage`
