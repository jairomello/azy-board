## Why

O board Kanban já exibe cards de tasks, mas ainda carece de recursos essenciais para uso real de equipes ágeis: não há distinção entre tipos de card (história, tarefa, bug), os filtros de visualização prometidos na especificação original estão ausentes, a edição de histórias não segue o padrão ágil com formatação rica, e há bugs críticos que impedem o uso correto das tags e da reordenação de cards dentro de uma coluna. Além disso, a gestão de squads e membros de projeto — necessária para atribuição de responsáveis — não foi exposta na UI.

## What Changes

- **Tipos de card (Story, Task, Bug)**: badge de tipo em cada card; campo `type` nas tasks; histórias da entidade `stories` podem ser exibidas como cards no board com seu próprio badge e modal
- **Toggle "Stories como cards"**: quando ativado, histórias da entidade `stories` são exibidas como cards nas colunas junto com as tasks; quando desativado (padrão), histórias permanecem apenas como agrupadores de swimlane dentro de épicos
- **Editor rich text para histórias**: modal de cadastro/edição de história com campos ágeis padrão (Como / Eu quero / Para que) e editor visual Markdown com toolbar (negrito, itálico, títulos, listas, tabelas) usando Tiptap + extensões
- **Botão "+ Nova história"**: substitui o painel lateral de histórias por um botão no toolbar que abre modal de cadastro, mantendo o painel lateral apenas para gerenciamento (listar/editar/excluir)
- **Filtros no board**: linha de filtros no toolbar com seletores de módulo, sprint, responsável, tipo de card e tag
- **Bug — reordenação de cards**: cards dentro de uma coluna devem persistir nova posição ao serem soltos (falta rota `PATCH /tasks/:id/position` e uso de `arrayMove` + API call no `onDragEnd`)
- **Bug — tags não salvas**: corrigir fluxo de save da `CardModal` para garantir que `POST /tasks/:id/tags` é chamado com os tagIds corretos antes de fechar
- **Bug — z-index do TagSelector**: dropdown de tags aparece atrás de campos seguintes; corrigir com `position: fixed` ou ajuste de z-index
- **Edição de tag existente**: na `CardModal`, clicar sobre um chip de tag seleciona-o para edição inline de nome e cor
- **Gestão de squads e membros**: na tela de settings do projeto, seção para criar squads, adicionar/remover membros e visualizar quem está em cada squad; membros listados ficam disponíveis como opções de responsável nos cards

## Capabilities

### New Capabilities

- `card-types`: Badge de tipo (Story/Task/Bug) nos cards; campo `type` na entidade task; comportamento diferenciado por tipo (modal de história vs modal de task)
- `board-filters`: Filtros no toolbar do board (módulo, sprint, responsável, tipo, tag) com estado local e aplicação sobre `displayedTasks`
- `story-rich-editor`: Modal de cadastro/edição de histórias com campos ágeis e editor Tiptap com toolbar de formatação (negrito, itálico, títulos h1-h3, lista, lista numerada, tabela, link)
- `project-members-ui`: Tela de settings com gestão de squads — criar squad, listar membros do projeto, adicionar/remover membros de squads; expõe membros como opções de responsável nos cards

### Modified Capabilities

- `board-management`: Adicionar toggle "Stories como cards" e corrigir bug de reordenação de cards dentro da coluna (posição não persiste)
- `tag-ui`: Corrigir z-index do dropdown; corrigir persistência das tags ao salvar card; adicionar edição inline de tag existente no modal
- `card-creation-ui`: Campo tipo (Task/Bug) no formulário rápido de criação de card
- `card-edit-ui`: Campo tipo (Task/Bug/Story) na modal de edição; integração com modal de história para cards do tipo Story

## Impact

- **Frontend**: `BoardPage.tsx`, `KanbanCard.tsx`, `CardModal.tsx`, `TagSelector.tsx`, `StoriesPanel.tsx` (substituído), novos componentes `StoryModal.tsx`, `RichTextEditor.tsx`, `BoardFilters.tsx`, `ProjectMembersSettings.tsx`
- **Backend**: Nova rota `PATCH /projects/:id/tasks/:taskId/position` para reordenação; `GET /projects/:id/members` para listar membros; nova coluna `type` na tabela `tasks` (migration); campo `type` na entidade `stories` já existe implicitamente
- **Dependências novas**: `@tiptap/extension-table`, `@tiptap/extension-typography`, `@tiptap/extension-text-align` (todas MIT) — para o editor de histórias
- **DB**: Migration para adicionar coluna `type TEXT DEFAULT 'TASK'` na tabela `tasks`
