## 1. Migration — Campo `type` em tasks

- [x] 1.1 Adicionar coluna `type TEXT NOT NULL DEFAULT 'TASK'` no schema Drizzle (`apps/api/src/db/schema.ts`)
- [x] 1.2 Rodar `bun drizzle-kit push` para aplicar a migration no banco local
- [x] 1.3 Atualizar a rota `POST /projects/:id/tasks` para aceitar e persistir `type` no body
- [x] 1.4 Atualizar a rota `PATCH /projects/:id/tasks/:id` para aceitar e persistir `type` no body
- [x] 1.5 Adicionar `type` no tipo `TaskData` do frontend (`BoardPage.tsx`) e no tipo `CardData` (`KanbanCard.tsx`)

## 2. Badge de tipo nos cards

- [x] 2.1 Criar mapa de cores por tipo: `TASK` → azul, `BUG` → vermelho, `STORY` → roxo
- [x] 2.2 Adicionar badge de tipo no rodapé do `KanbanCard.tsx`, ao lado do badge de prioridade
- [x] 2.3 No formulário rápido `AddCardForm.tsx`, adicionar select de tipo (`Task` / `Bug`) com padrão `TASK`
- [x] 2.4 Na `CardModal.tsx`, adicionar campo select "Tipo" com opções `Task`, `Bug`, `Story`

## 3. Toggle "Stories como cards" no board

- [x] 3.1 Adicionar estado `showStories: boolean` (padrão `false`) no `BoardPage.tsx`
- [x] 3.2 Adicionar toggle "Mostrar histórias" no toolbar ao lado do toggle de subtasks
- [x] 3.3 Quando `showStories = true`, buscar `stories` do projeto e criar cards virtuais (`isVirtual: true`) para a primeira coluna
- [x] 3.4 Renderizar cards virtuais de história com badge `STORY` e `disabled: true` no `useSortable` (não arrastáveis)
- [x] 3.5 Ao clicar em card virtual de história, abrir `StoryModal` com os dados da história

## 4. Bug — Reordenação vertical de cards

- [x] 4.1 Criar rota `PATCH /projects/:id/tasks/reorder` com body `{ columnId: string, order: string[] }` — atualiza `position` de cada task em transaction
- [x] 4.2 No `handleDragEnd` do `BoardPage.tsx`, detectar drag dentro da mesma coluna (quando `activeColumnId === overColumnId`)
- [x] 4.3 Aplicar `arrayMove` no estado de tasks para update otimista da ordem
- [x] 4.4 Chamar `api.patch(.../tasks/reorder)` com `{ columnId, order }` após o drop
- [x] 4.5 Reverter o estado se a chamada de API falhar (rollback com toast de erro)
- [x] 4.6 Garantir que o `SortableContext` de cards usa a ordem correta (baseada em `position`)

## 5. Bug — Tags não salvas na CardModal

- [x] 5.1 Verificar e corrigir o fluxo de `handleSave` na `CardModal.tsx`: garantir que `api.post(.../tasks/:id/tags, { tagIds })` é chamado com o array correto de IDs das tags selecionadas
- [x] 5.2 Verificar que o estado `selectedTags` é inicializado corretamente com as tags já associadas à task ao abrir a modal
- [x] 5.3 Após salvar, atualizar o estado de `tasks` no `BoardPage.tsx` com as novas tags para refletir no card

## 6. Bug — Z-index do TagSelector

- [x] 6.1 Refatorar `TagSelector.tsx` para renderizar o dropdown via `createPortal(dropdown, document.body)`
- [x] 6.2 Calcular posição do dropdown com `getBoundingClientRect()` do input container ao abrir
- [x] 6.3 Aplicar `position: fixed`, `z-index: 9999` e as coordenadas calculadas no dropdown via `portal`
- [x] 6.4 Fechar o dropdown ao clicar fora (listener de `mousedown` no `document`)

## 7. Edição de tag existente na CardModal

- [x] 7.1 No `TagSelector.tsx`, ao clicar sobre um chip de tag já selecionada, exibir modo de edição inline (input de nome + paleta de cores)
- [x] 7.2 Ao confirmar a edição, chamar `api.patch(.../tags/:tagId, { name, color })` e atualizar o chip
- [x] 7.3 Atualizar a lista de `projectTags` no `BoardPage.tsx` via callback para refletir a edição em outros lugares

## 8. Filtros no board

- [x] 8.1 Criar componente `<BoardFilters>` com selects para: módulo, sprint, responsável, tipo de card (multi-select), tag (multi-select)
- [x] 8.2 Carregar opções dos filtros no `BoardPage.tsx`: módulos já carregados; sprints via `GET /projects/:id/sprints`; responsáveis via `GET /projects/:id/members`
- [x] 8.3 Integrar `<BoardFilters>` no toolbar do `BoardPage.tsx`, na mesma linha dos toggles
- [x] 8.4 Aplicar os filtros sobre `displayedTasks` com `useMemo`: AND entre todos os filtros ativos
- [x] 8.5 Exibir indicador visual quando há filtros ativos (ex: contagem de filtros aplicados)
- [x] 8.6 Botão "Limpar filtros" que zera todos os estados de filtro

## 9. Editor rich text para histórias (StoryModal)

- [x] 9.1 Instalar extensões Tiptap faltantes: `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header` (todas MIT)
- [x] 9.2 Criar componente `<RichTextEditor>` com `useEditor` (StarterKit + Table + Placeholder + Link) e toolbar com botões: B, I, riscado, H1, H2, H3, lista, lista-numerada, citação, tabela
- [x] 9.3 Criar componente `<StoryModal>` com campos: Título, Épico (select), "Como", "Eu quero", "Para que", Critérios de Aceitação (`<RichTextEditor>`), Notas (`<RichTextEditor>`)
- [x] 9.4 Ao salvar na `StoryModal`, chamar `POST /projects/:id/stories` (criação) ou `PATCH /projects/:id/stories/:id` (edição)
- [x] 9.5 Substituir botão "Histórias" (que abre painel lateral) por botão "+ Nova história" que abre `StoryModal` em modo de criação
- [x] 9.6 Atualizar `PATCH /projects/:id/stories/:id` no backend para aceitar campos `description`, `acceptanceCriteria`, `notes`, `persona`, `goal`, `benefit`
- [x] 9.7 Adicionar colunas faltantes na tabela `stories` no schema Drizzle (`persona`, `goal`, `benefit`, `acceptanceCriteria`, `notes`) e rodar migration

## 10. Gestão de Membros & Squads nas Settings

- [x] 10.1 Criar rota `GET /projects/:id/members` no backend retornando `[{ userId, name, email, role, squadId? }]`
- [x] 10.2 Criar rota `GET /projects/:id/squads` no backend retornando squads com membros aninhados
- [x] 10.3 Criar rota `DELETE /projects/:id/squads/:squadId/members/:userId` para remover membro de squad
- [x] 10.4 Criar seção "Membros & Squads" no `SettingsPage.tsx` com lista de membros e squads colapsáveis
- [x] 10.5 Implementar formulário de criação de squad (input de nome + botão criar)
- [x] 10.6 Implementar UI de associação de membro a squad (select de membro + select de squad + botão adicionar)
- [x] 10.7 Integrar `GET /projects/:id/members` na `CardModal.tsx`: campo "Responsável" passa a exibir membros reais do projeto em vez de campo estático
- [x] 10.8 Ao selecionar responsável na `CardModal`, incluir `assigneeId` no `PATCH /tasks/:id`

## 11. Testes e validação

- [x] 11.1 Testar badge de tipo: criar card como Task e Bug, verificar cores corretas
- [x] 11.2 Testar toggle de histórias: ativar e verificar cards de história no board
- [x] 11.3 Testar reordenação vertical: arrastar card dentro da coluna e verificar que permanece após recarregar
- [x] 11.4 Testar save de tags: selecionar tag, salvar, fechar e reabrir card — tag deve estar selecionada
- [x] 11.5 Testar dropdown de tags: verificar que abre acima de outros campos
- [x] 11.6 Testar edição de tag: clicar sobre chip de tag na modal e alterar nome/cor
- [x] 11.7 Testar filtros: aplicar filtro de módulo e de tipo simultaneamente
- [x] 11.8 Testar StoryModal: criar história com campos ágeis e editor rich text
- [x] 11.9 Testar gestão de squads: criar squad, adicionar membro, verificar disponibilidade como responsável
