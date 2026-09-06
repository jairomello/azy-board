## Why

O Board já persiste parte dos filtros e das lanes recolhidas, mas opções de visualização como modo Kanban/árvore, densidade e módulo ativo ainda não são restauradas de forma consistente por projeto. Isso faz o usuário perder o contexto de trabalho ao sair e retornar ao projeto, especialmente quando alterna entre projetos com preferências diferentes.

## What Changes

- Persistir filtros e opções de visualização do Board no `localStorage`, isolados por `projectId`.
- Incluir modo de visualização (`kanban`/`tree`), densidade (`comfortable`/`compact`), módulo ativo e demais opções visuais existentes.
- Preservar separadamente os conjuntos de lanes recolhidas por projeto.
- Restaurar o estado antes da primeira renderização útil, evitando flash do estado padrão.
- Limpar ou corrigir somente referências inválidas quando módulo, sprint, versão, centro de custo ou outra entidade deixar de existir.
- Manter compatibilidade com chaves antigas, incluindo `board-filters:<projectId>` e `board-density`.
- Tratar JSON corrompido, `localStorage` indisponível e troca rápida de projetos sem quebrar o Board.
- Não persistir dados de domínio, conteúdo de cards ou estado compartilhado entre usuários.

## Capabilities

### New Capabilities

- `board-view-state-per-project`: persistência e restauração de todas as preferências visuais do Board por projeto.

### Modified Capabilities

- `board-filters-persistence`: ampliar a persistência existente para incluir todas as opções de visualização por projeto, mantendo filtros e chaves legadas compatíveis.

## Impact

- `apps/web/src/pages/BoardPage.tsx` e componentes de controle de visualização.
- `apps/web/src/components/BoardFilters.tsx`, `BoardCommandBar.tsx` e Tree View, se necessário.
- Testes frontend de restauração, troca de projeto, migração de chaves e fallback.
- Nenhuma alteração de API, banco ou payload público.
