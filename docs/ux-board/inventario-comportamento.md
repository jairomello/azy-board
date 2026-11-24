# Inventário de comportamento atual (P0 — rede de segurança)

Levantado em 2026-11-24 sobre origin/main @ e0e5dba. Cada linha "SEM TESTE" que toca as áreas do redesenho ganhou teste de caracterização (arquivos `*-caracterizacao.test.ts(x)`) antes de qualquer mudança. Os testes de caracterização registram o comportamento atual; quando um passo muda um comportamento de propósito, o teste correspondente muda na mesma change do OpenSpec.

**Convenção de caminhos.** Para as tabelas caberem na tela, abreviei:
- `W/` = `apps/web/src/`
- `R/` = raiz do repositório
- Arquivos citados só pelo nome do componente ficam em `W/components/`.
- Testes sem diretório ficam em `W/` ou ao lado do código.
- O e2e `drag-animation.ts` não está em nenhum script do `package.json`. Só `test:e2e` (que roda `regression.ts`, que roda `journeys.ts`) e `test:visual` estão. Ele roda à mão.

---

### Área 1 — Arraste no board

| ID | Comportamento observável | arquivo:linha | Coberto por |
|---|---|---|---|
| A1-01 | Só a alça (~30 px) arrasta; é o único nó com `listeners` e `setActivatorNodeRef` | KanbanCard.tsx:206-218 | kanban-card-drag-handle.test.tsx; e2e journeys e drag-animation (usam a alça) |
| A1-02 | `canDrag = isLeaf && type!=='EPIC'`. Pai ou EPIC mostram alça estática (6 pontos, `cursor-not-allowed`, sem aria-label) | KanbanCard.tsx:163,212-231 | kanban-card-drag-handle.test.tsx |
| A1-03 | STORY folha vira card arrastável quando "histórias como cards" está ligado | KanbanCard.tsx:163; model/boardView.ts | boardView.test.ts testa só a população. O arraste de STORY: SEM TESTE |
| A1-04 | Seta da alça oculta em repouso, aparece no hover do card, fica forte no hover/foco da alça, sempre visível em toque | W/styles/globals.css:1092-1110 | kanban-card-drag-handle.test.tsx (lê o CSS) |
| A1-05 | Ativação pelo PointerSensor com distância de 5 px. Não há KeyboardSensor nem TouchSensor, então não existe arraste por teclado | features/board/BoardScreen.tsx:240 | SEM TESTE (o e2e drag-animation:135 só pressupõe os 5 px) |
| A1-06 | Colisão com `pointerWithin`: ignora o próprio card e prioriza card > `:drop:` > `:col:`. Ponteiro fora das colunas não tem destino | BoardScreen.tsx:249-259 | SEM TESTE unitário (e2e drag-animation §4 indireto) |
| A1-07 | Geometria medida só no início do arraste: `[data-drop-id]`, `.board-column-cards > .kanban-card`, gap | BoardScreen.tsx:264-290 | SEM TESTE unitário (e2e indireto) |
| A1-08 | Vaga (placeholder) com a altura do card, na coluna e no índice sob o ponteiro (critério do ponto médio) | model/dragPreview.ts:84-105; components/BoardColumns.tsx:109-147 | drag-preview.test.ts, board-column-drop-target.test.tsx, card-drop-placeholder.test.tsx, board-drag-animation.test.tsx, e2e §1 |
| A1-09 | Card arrastado sai do fluxo (`.kanban-card--dragging`, sem conteúdo) mas continua montado | KanbanCard.tsx:177,195-199; BoardColumns.tsx:104-105,150 | board-column-drop-target.test.tsx, e2e §1 |
| A1-10 | Só a coluna sob o ponteiro fica destacada, por lane (B14); vaga única por lane | BoardColumns.tsx:109,116,183-188 | board-column-drop-target.test.tsx (B14), e2e §1/§6 |
| A1-11 | A contagem da coluna não muda durante o arraste | BoardColumns.tsx:115 | board-column-drop-target.test.tsx |
| A1-12 | Vizinhos deslizam (FLIP, 190 ms); desligado em movimento reduzido | BoardColumns.tsx:89-93; hooks/useCardFlip.ts; model/dragAnimation.ts:46 | drag-animation.test.ts (constantes), e2e §2/§5; o useCardFlip em si: SEM TESTE |
| A1-13 | O DragOverlay mostra um KanbanCard sem ações, com avanço e subtasks; classe `--still` em movimento reduzido | BoardScreen.tsx:917-922 | SEM TESTE (e2e §3 só mede transform residual) |
| A1-14 | Assentamento: 180 ms até a vaga, 220 ms de volta à origem, 0 ms em movimento reduzido; classe `settling` + variável CSS | BoardScreen.tsx:303-326; dragAnimation.ts:39-68,89-93 | drag-animation.test.ts, e2e §3/§4/§5 |
| A1-15 | Soltar fora das colunas: nada muda, o card volta, aparece o toast `dragDropCanceled` | BoardScreen.tsx:815-819 | Estado: e2e §4. Toast: SEM TESTE |
| A1-16 | A âncora é o card depois da vaga; vaga na última posição usa o marcador `lane:drop:col` e insere no fim | BoardScreen.tsx:800-803; dragPreview.ts:114; model/interaction.ts:113-121 | board-interaction.test.ts, drag-preview.test.ts |
| A1-17 | Mesma coluna: reorder otimista `PATCH /items/reorder {columnId, order}` com rollback | hooks/useBoardInteraction.ts:52-68 | board-interaction.test.ts; e2e journeys "reordena" |
| A1-18 | Outra coluna: aplica otimista `columnId` + `status = baseStatus` da coluna + posições; depois `PATCH /items/:id/move` e `PATCH /items/reorder` | useBoardInteraction.ts:73-104 | board-interaction.test.ts; e2e journeys + drag-animation §3 |
| A1-19 | Recusa (409/403/erro): rollback cirúrgico que preserva atualizações de outros itens, mensagem `dragMoveRefused`, sem retry | useBoardInteraction.ts:24-26,77-103 | board-interaction.test.ts (409, 403, rollback); a chave i18n: SEM TESTE |
| A1-20 | Cancela leituras do board em voo antes de aplicar o otimista (B16) | useBoardInteraction.ts:61,83; BoardScreen.tsx:447 | e2e drag-animation §3b |
| A1-21 | O handler também rejeita item não-folha ou EPIC | useBoardInteraction.ts:49 | SEM TESTE |
| A1-22 | **Soltar na lane de outra história, épico ou na lane órfã só muda a coluna.** O `parentId` não muda e o card volta a aparecer na lane original. A ordem é calculada sobre todos os cards daquela coluna, de todas as lanes | useBoardInteraction.ts:75,100-101; interaction.ts:113-117 | SEM TESTE (o e2e §6 só arrasta dentro da mesma lane) |
| A1-23 | Arraste de coluna: o cabeçalho é a alça em qualquer lane (inclusive no Unificado). Reordena globalmente com `PATCH /columns/reorder` otimista e rollback ("Erro ao reordenar colunas"). O overlay mostra o nome; não passa pela prévia | BoardColumns.tsx:162-168; useBoardInteraction.ts:31-47; BoardScreen.tsx:923-929; hooks/useBoardDragAnimation.tsx:81-86 | board-drag-animation.test.tsx ("arrastar coluna não passa pela prévia"); o reorder: SEM TESTE |
| A1-24 | Destino do arraste de coluna vem de `e.over` ou de `lastOverRef` | BoardScreen.tsx:794,801-802 | SEM TESTE |
| A1-25 | Auto-scroll é o padrão do dnd-kit (não configurado); a geometria não é remedida se a tela rolar | BoardScreen.tsx:785 | Parcial: e2e §6 só verifica que a rolagem fica imóvel |
| A1-26 | Busca sem resultado desmonta o DndContext | BoardScreen.tsx:770-783 | SEM TESTE |
| A1-27 | Não há checagem de papel na UI: VIEWER arrasta e o servidor recusa, gerando rollback | KanbanCard.tsx:163 | SEM TESTE |
| A1-28 | Clique no corpo do card abre o detalhe na hora | KanbanCard.tsx:236-239 | SEM TESTE |
| A1-29 | **Clique no título:** o board sempre passa `onTitleSave`, e o `<p>` do InlineEdit para a propagação e entra em edição na hora. O atraso de 160 ms só roda clicando na área do título fora do texto, ou sem `onTitleSave`. Duplo clique cancela | KanbanCard.tsx:155-158,323-341; InlineEdit.tsx:58-59 | inline-edit.test.tsx (edição). Os 160 ms e a interação clique×edição: SEM TESTE |
| A1-30 | Ações no hover/foco, na ordem copiar → arquivar → excluir. Excluir pede `window.confirm`. Todas param a propagação | KanbanCard.tsx:249-291 | kanban-card-layout-contract (texto); comportamento no DOM: SEM TESTE |
| A1-31 | Copiar referência `[código - ]título [id=uuid]`: ícone de check por 1,5 s, toast em caso de erro | KanbanCard.tsx:123-133 | lib/cardReference.test.ts + card-copy-reference-contract (texto); o feedback: SEM TESTE |
| A1-32 | Breadcrumb truncado em 45 caracteres, tooltip em portal no hover | KanbanCard.tsx:179-181,296-320 | SEM TESTE |
| A1-33 | Destaque âmbar do caminho crítico; chip de status fora da coluna; barras de progresso, dependências e anexos | KanbanCard.tsx:197,370-491 | board-column-advance.test.tsx e kanban-card-* tests; o destaque crítico: SEM TESTE |
| A1-34 | Recolher/expandir lanes de módulo, épico e história (persistido) | BoardLanes.tsx:154,169; ModuleSwimlane.tsx:18 | board-lanes.test.tsx |
| A1-35 | Abas de módulo (tablist) quando `moduleViewMode=tabs`, na visão Board, em projeto hierárquico, sem busca | BoardScreen.tsx:830-846 | SEM TESTE |
| A1-36 | "+ Adicionar card" inline por coluna nas lanes; criação contextual no Unificado | BoardColumns.tsx:117-136 | add-card-form.test.tsx, unified-board.test.tsx |
| A1-37 | Lápis para editar épico ou história na lane | BoardLanes.tsx:159,169 | SEM TESTE |

### Área 2 — Detalhe do card

| ID | Comportamento | arquivo:linha | Coberto por |
|---|---|---|---|
| A2-01 | Abrir: TASK/BUG abre ItemModal; STORY e `story-virtual-*` abrem StoryModal | BoardScreen.tsx:531-544; interaction.ts:9-13 | board-interaction.test.ts |
| A2-02 | `?itemId=` abre o card se ele estiver em `allItems`. **O parâmetro não sai da URL ao fechar**, então o modal reabre sempre que `allItems` muda | BoardScreen.tsx:196-199 | dashboard-contract (só texto); comportamento: SEM TESTE |
| A2-03 | `GET /items/:id` descarta resposta antiga ao trocar de item ou projeto | hooks/useBoardItemModal.ts | useBoardItemModal.test.tsx |
| A2-04 | Esc (window, bolha) fecha o filho empilhado do topo, ou volta, ou fecha. Não pede confirmação de alteração não salva | ItemModal.tsx:358-372 | SEM TESTE |
| A2-05 | Esc no lightbox de anexo ou figura fecha só o lightbox (fase de captura + `stopPropagation`) | hooks/useLightboxEscapeGuard.ts:9-19; AttachmentsArea.tsx:78; RichTextEditorImpl.tsx:98,183 | rich-text-figure.test.tsx (figura); lightbox de anexos: SEM TESTE |
| A2-06 | Esc fecha EpicModal e StoryModal | EpicModal.tsx:76-81; StoryModal.tsx:86-91 | epic-story-forms-contract (texto) |
| A2-07 | Fecha por clique no fundo, X e Cancelar | ItemModal.tsx:465,493,531; ItemDetailModalShell.tsx:30,40-47 | SEM TESTE |
| A2-08 | **Não existe anterior/próximo.** Existe só a pilha de filhos: botão Voltar, profundidade máxima 5 (passa a substituir o topo), z-index +10 por nível | ItemModal.tsx:375-398,469,536-567 | SEM TESTE |
| A2-09 | Abrir um filho a partir de Épico/História troca para o modal certo | BoardScreen.tsx:548-552 | epic-story-forms-contract (texto) |
| A2-10 | Abas do ItemModal: details, subtasks(n), checklists(n), links e dependencies (ocultas em item novo), attachments (se o tenant habilita), activity (n + horas). Volta para details ao trocar de item | ItemModal.tsx:250,343,447-455 | accordion-item-detail-contract (texto); áreas: item-links-area/item-dependencies-area tests; troca de aba no DOM: SEM TESTE |
| A2-11 | Abas de Épico e História: details / children / activity | EpicModal.tsx:55,132; StoryModal.tsx:65,147 | epic-story-forms-contract (texto) |
| A2-12 | Rascunho da descrição em `localStorage` `item-draft:{pid}:{itemId}:description` = `{value, base, updatedAt}`. Debounce de 800 ms, aviso de recuperação com descartar, limpo ao salvar, item novo não grava, logout apaga todos | lib/itemDraft.ts; hooks/useItemDescriptionDraft.ts:6,41-79; contexts/AuthContext.tsx (logout) | itemDraft.test.ts, item-description-draft.test.tsx |
| A2-13 | Salvar: uma chamada com todos os campos + tags; mostra a mensagem de domínio da API; bloqueia item novo sem história pai em projeto hierárquico | ItemModal.tsx:400-441 | useBoardItemEditing.test.tsx, item-modal-spacing-contract (texto); bloqueio sem pai: SEM TESTE DOM |
| A2-14 | Título editável no cabeçalho (`autoEdit` em item novo); mudar sprint sugere datas | ItemModal.tsx:222-232,489; ItemDetailHeader.tsx:73-75 | inline-edit.test.tsx, itemSprintDates.test.ts |
| A2-15 | VIEWER: tokens, links, dependências e anexos só leitura | ItemModal.tsx (`currentUserRole`) | card-tokens-contract (texto), item-modal-figure.test.tsx |
| A2-16 | **ItemModal não usa ItemDetailModalShell** (repete a casca inline); Épico e História usam | ItemModal.tsx:463-533 | Os contratos exigem as duas formas (ver seção de contratos) |

### Área 3 — Filtros e busca

| ID | Comportamento | arquivo:linha | Coberto por |
|---|---|---|---|
| A3-01 | O botão "Filtros" abre um popover (e fecha Opções); o badge mostra `countActiveBoardFilters` | BoardCommandBar.tsx:156-169 | Badge: SEM TESTE |
| A3-02 | Clique fora fecha os popovers Filtros/Opções/Criar (mousedown no document) | BoardCommandBar.tsx:107-116 | SEM TESTE |
| A3-03 | Popover Filtros (`section="filters"`, sem os controles de exibição). "Limpar N" #1 no cabeçalho | BoardCommandBar.tsx:170-209,177-184 | SEM TESTE |
| A3-04 | Selects:<br>• squad (se houver squads)<br>• módulo (se houver e o nível não estiver oculto)<br>• sprint (+ "Sem sprint" sentinela, "noSprints" desabilitado)<br>• responsável (+ "Sem responsável")<br>• versão (+ "Sem versão")<br>• prioridade<br>• autor (+ "Sem autor")<br>• centro de custo (+ "Sem centro")<br>• última alteração (1d/2d/3d/5d/1w/current-sprint/1m) | BoardFilters.tsx:247-327 | board-filters.test.tsx cobre módulo, sprint vazia e janela; predicados em filter-predicates.test, visibility-parity.test e boardView.test. No DOM, responsável/versão/prioridade/autor/CC/squad: SEM TESTE |
| A3-05 | Status múltiplo por checkbox, OR, guardado como CSV | BoardFilters.tsx:158-164,333-355 | board-filters.test.tsx |
| A3-06 | Tipo múltiplo TASK/BUG | BoardFilters.tsx:358-377 | board-filters.test.tsx |
| A3-07 | Tags múltiplas (só se houver tags) | BoardFilters.tsx:380-399 | DOM: SEM TESTE |
| A3-08 | "Limpar (N)" #2 no rodapé do BoardFilters | BoardFilters.tsx:402-412 | board-filters.test.tsx |
| A3-09 | "Limpar filtros" #3 na barra, fora do popover, só com N>0 e mostrando N | BoardCommandBar.tsx:212-226 | board-command-bar.test.tsx |
| A3-10 | **Contagem:**<br>• Conta 1 cada: módulo, sprint, responsável, squad, tipos, tags, versão, prioridade, status (1 mesmo com vários marcados), autor, CC, `updatedWithin`, `hideEmptyEpics`<br>• `hideEmptyStories` conta só com `storyDisplay=lanes`<br>• Não contam `showSubtasks`, `storyDisplay`, `moduleViewMode` | BoardFilters.tsx:78-95 | Parcial (board-command-bar.test.tsx: 1 status); regra completa: SEM TESTE |
| A3-11 | Limpar zera a população + `hideEmpty*` e preserva as preferências de exibição | BoardFilters.tsx:98-116 | board-filters.test.tsx, board-command-bar.test.tsx |
| A3-12 | Select de squad na barra (`xl+`, "Todos os squads") duplica o do popover, no mesmo campo | BoardCommandBar.tsx:318-331 | SEM TESTE |
| A3-13 | Squad filtra por responsáveis membros do squad | BoardScreen.tsx:329-338 | SEM TESTE |
| A3-14 | **Persistência:** `localStorage["board-filters:{projectId}"]` = JSON do `BoardFilterState` inteiro (17 campos, inclusive preferências de exibição). Na leitura mescla com `DEFAULT_FILTERS`, normaliza listas, remove o legado `showStories`; JSON inválido volta aos defaults | hooks/useBoardPreferences.ts:9-29,51-57; model/types.ts:71-89 | useBoardPreferences.test.ts, useBoardPreferences.persistence.test.tsx |
| A3-15 | Com overlay de sessão do agente ativo, não grava no localStorage | useBoardPreferences.ts:55 | persistence.test.tsx |
| A3-16 | Trocar de projeto relê filtros e recolhidos sem contaminar o outro projeto | useBoardPreferences.ts:59-66 | SEM TESTE |
| A3-17 | Outras chaves: `board-collapsed-{epics,modules,stories}:{pid}` (array de ids); `board-density` (global) | useBoardPreferences.ts:31-47,68-83 | SEM TESTE |
| A3-18 | Validação: limpa versão/sprint/CC inexistentes (preserva o sentinela) e `moduleId` em board SIMPLE | hooks/useBoardFilterValidation.ts:30-52 | ui-mode-contract (texto); comportamento: SEM TESTE |
| A3-19 | Chips ativos (densidade confortável) com remoção individual. Incluem `showSubtasks`, `storyDisplay=cards`, `moduleViewMode=tabs`; `hideEmptyStories` só em lanes e fora da árvore | ActiveFilterChips.tsx:60-103; BoardScreen.tsx:728-736 | active-filter-chips.test.ts, components/active-filter-chips.test.tsx |
| A3-20 | **Divergência:** o número de chips ≠ o badge (chips contam preferências de exibição e cada valor separado) | ActiveFilterChips.tsx:78-88 vs BoardFilters.tsx:78 | SEM TESTE |
| A3-21 | Densidade compacta esconde os chips e mostra CompactFilterSummary (contador + popover dos chips, fecha com clique fora) | CompactFilterSummary.tsx; BoardScreen.tsx:702-710 | board-compact-density-contract (texto); DOM: SEM TESTE |
| A3-22 | Os filtros alimentam o progresso (`onlyModuleFilter`) | BoardScreen.tsx:364-367 | boardView.test.ts (B19) |
| A3-23 | Mesmo estado de filtros na Árvore; os filtros de cabeçalho da árvore editam esse estado | BoardScreen.tsx:749-750; pages/TreeViewPage.tsx:133-140 | tree-view-column-filters.test.tsx, treeFilterQuery.test.ts, e2e journeys "árvore" |
| A3-24 | Exportar recebe um subconjunto (sem `updatedWithin` nem `hideEmpty*`); o agente recebe outro subconjunto | BoardScreen.tsx:653,945-960 | SEM TESTE |
| A3-25 | Busca T92: input lazy no header; `searchQuery` fica fora do `BoardFilterState` e é limpo ao trocar de projeto | BoardScreen.tsx:86-89,171-174,202,639-649 | Troca de projeto: SEM TESTE |
| A3-26 | Busca é AND com os filtros. O dropdown usa os filtros + `showSubtasks:true` + lanes + todas as tasks | BoardScreen.tsx:358-376; model/boardView.ts:62-103 | boardView.test.ts (T92) |
| A3-27 | Busca ativa: expande todos os recolhidos sem gravar, ignora abas de módulo, esconde lanes vazias, não mostra cards virtuais de história, o cabeçalho usa `progressCards` | BoardScreen.tsx:567-572,604-609; boardView.ts:158 | boardView.test.ts (lanes vazias, progresso); expansão e abas: SEM TESTE |
| A3-28 | Busca sem resultado: estado vazio com "Limpar" no board e na árvore; a árvore expande tudo | BoardScreen.tsx:770-782; TreeViewPage.tsx:1453,1469,2206-2213 | treeSearch.test.ts; estados vazios: SEM TESTE |
| A3-29 | Dropdown: 8 resultados ranqueados; setas, Enter, Esc, Tab; clique abre; Ctrl/Cmd+K; overlay no mobile | CardSearch.tsx:64-151; CardSearchHeader.tsx:21 | card-search.test.tsx, cardSearch.test.ts |
| A3-30 | Comando `set_filters` do agente substitui o estado inteiro (as preferências de exibição voltam ao default) | lib/assistantViewStore.ts:113-121; hooks/useBoardAgentSession.ts:60 | assistantViewStore.test.ts (conversão); reset das preferências: SEM TESTE |

### Área 4 — Visões Board / Unificado / Árvore

| ID | Comportamento | arquivo:linha | Coberto por |
|---|---|---|---|
| A4-01 | Três botões `aria-pressed`; o padrão é Board | BoardCommandBar.tsx:126-154; BoardScreen.tsx:170 | board-command-bar.test.tsx |
| A4-02 | A visão **não é persistida**: recarregar volta para Board | BoardScreen.tsx:170 | SEM TESTE |
| A4-03 | Árvore: TreeViewPage no lugar do canvas, sem DndContext; some o menu Criar; caminho crítico oculto | BoardScreen.tsx:698-700,746-768; BoardCommandBar.tsx:369 | ui-mode-contract (texto); DOM: SEM TESTE |
| A4-04 | Unificado: uma faixa de colunas (`laneId 'unified'`), criação contextual por coluna, contador no cabeçalho | features/board/components/UnifiedBoard.tsx; BoardScreen.tsx:595-601,866-880 | unified-board.test.tsx, boardView.test.ts |
| A4-05 | Unificado aparece para o assistente como `kanban` (rótulos de screen e boardView) | BoardScreen.tsx:651-655 | SEM TESTE |
| A4-06 | **A sessão do agente força a visão:** toda notificação faz `setView(session.mode)` (só kanban ou tree). O baseline publica unified como kanban, então qualquer comando tira o usuário do Unificado | useBoardAgentSession.ts:55-77 | assistant-view-commands-contract (texto), assistantViewStore.test.ts; caso Unificado: SEM TESTE |
| A4-07 | O comando também aplica filtros, `activeModuleId`, `openItemId` e expande grupos (reveal) | useBoardAgentSession.ts:60-69; assistantViewStore.ts:123-162 | assistantViewStore.test.ts |
| A4-08 | Recorte fixado: faixa com "Ver na árvore" e "Restaurar" (`restore_previous_view`); escopa itens e árvore | BoardScreen.tsx:177,204-225,717-727,757 | Store: assistantViewStore.test.ts; UI: SEM TESTE |
| A4-09 | Overlay em `sessionStorage["azy-board:view-session:{pid}"]` com histórico limitado | assistantViewStore.ts:25-69 | assistantViewStore.test.ts |

### Área 5 — Menu Opções e barra

| ID | Comportamento | arquivo:linha | Conta como filtro? | Coberto por |
|---|---|---|---|---|
| A5-01 | "Opções" abre popover (fecha Filtros); existe nas 3 visões | BoardCommandBar.tsx:230-238 | — | board-command-bar.test.tsx (árvore) |
| A5-02 | Cronograma → "Recalcular datas": `POST /schedule/recalculate`, spinner, toast com a quantidade, `invalidateBoard`, toast de erro | BoardCommandBar.tsx:249-261; BoardScreen.tsx:409-418 | Não | SEM TESTE |
| A5-03 | "Caminho crítico" (switch): `GET /schedule/critical-path`; sem dependências mostra toast de erro; destaca em âmbar; desabilitado se nenhum card exibido tem dependência; ausente na árvore; não persiste nem reseta ao trocar de visão | BoardCommandBar.tsx:262-276; BoardScreen.tsx:184-186,385-407,698-700 | Não | SEM TESTE |
| A5-04 | Dados → "Exportar dados" fecha o popover e abre ExportDialog (lazy) com os filtros. Também existe como ícone na barra | BoardCommandBar.tsx:280-292,350-359; BoardScreen.tsx:943-963 | Não | export-dialog.test.tsx (só o diálogo); ação e repasse: SEM TESTE |
| A5-05 | Exibição → Hierarquia/Abas de módulo ("módulos como abas"), só em projeto HIERARCHICAL e na visão Board | BoardFilters.tsx:171-188; BoardScreen.tsx:830-846 | Não (mas gera chip) | board-filters.test.tsx (toggle); tablist: SEM TESTE |
| A5-06 | Mostrar/ocultar subtasks (Board e Unificado, não Árvore) | BoardFilters.tsx:189-193 | Não (mas gera chip) | board-filters.test.tsx, boardView.test.ts |
| A5-07 | Histórias como cards ↔ lanes (HIERARCHICAL, não Árvore) | BoardFilters.tsx:195-204 | Não (mas gera chip) | board-filters.test.tsx, boardView.test.ts |
| A5-08 | Expandir/Recolher tudo (Board + HIERARCHICAL). Recolher grava módulos, épicos + `'orphan'` e grupos de história; expandir esvazia tudo | BoardFilters.tsx:206-219; BoardScreen.tsx:681-692 | Não | Visibilidade: board-filters.test.tsx; ação: SEM TESTE |
| A5-09 | Épicos vazios (na árvore o rótulo é "ramos vazios"); não aparece no Unificado | BoardFilters.tsx:220-230 | **Sim** | board-filters.test.tsx, tree-view-empty-filters.test.tsx |
| A5-10 | Histórias vazias (Board com lanes, ou Árvore) | BoardFilters.tsx:231-243 | **Sim, só com lanes** | board-filters.test.tsx, tree-view-empty-filters.test.tsx |
| A5-11 | Opções não mostra filtros de dados | BoardFilters.tsx:126-127,247 | — | board-filters.test.tsx |
| A5-12 | Condição diferente entre os popovers: `showModuleViewMode` é `HIERARCHICAL` em Opções e `kanban && HIERARCHICAL` em Filtros | BoardCommandBar.tsx:203,308 | — | SEM TESTE |
| A5-13 | **Densidade não está em Opções**: botão Gauge na barra (`sm+`), chave global `board-density`. O compacto esconde chips e cabeçalho de contexto, mostra resumo e % na barra, aplica a classe `density-compact` | BoardCommandBar.tsx:334-349; BoardScreen.tsx:702-745 | Não | board-compact-density-contract (texto), e2e drag-animation §6 (altura); toggle: SEM TESTE |
| A5-14 | Arquivados (ícone) abre o modal de arquivados | BoardCommandBar.tsx:360-367 | — | board-modals.test.tsx (modal); botão: SEM TESTE |
| A5-15 | Menu Criar MODULE/EPIC/STORY/TASK/BUG/EXTERNAL, filtrado pelo modo do projeto e pelos níveis ocultos; ausente na árvore | BoardCommandBar.tsx:369-408 | — | board-command-bar-levels.test.ts (texto), board-interaction.test.ts |

### Área 6 — Teclado

Teclas usadas hoje: Escape, Enter, ArrowUp/Down/Left/Right, Tab, Ctrl/Cmd+K. Não existe atalho de navegação global (j/k, /, ?, n) nem arraste por teclado.

| ID | Comportamento | arquivo:linha | Coberto por |
|---|---|---|---|
| A6-01 | Ctrl/Cmd+K foca a busca (window); ignorado com modal aberto ou Alt | CardSearch.tsx:86-101 | card-search.test.tsx |
| A6-02 | Na busca: ↑/↓ circulares, Enter abre, Esc fecha mantendo o texto, Tab fecha | CardSearch.tsx:64-80,122-150 | card-search.test.tsx; Tab: SEM TESTE |
| A6-03 | Esc no ItemModal (window, bolha) | ItemModal.tsx:359-372 | SEM TESTE |
| A6-04 | Esc em Épico/História | EpicModal.tsx:78; StoryModal.tsx:88 | contrato (texto) |
| A6-05 | Esc em captura: lightbox, editor expandido, seletor de figura | useLightboxEscapeGuard.ts:17; RichTextEditorImpl.tsx:183; FigurePickerDialog.tsx:50 | rich-text-figure.test.tsx |
| A6-06 | Árvore: Esc fecha o menu de colunas e o menu de filtro de coluna | TreeViewPage.tsx:1368-1404 | SEM TESTE |
| A6-07 | Árvore: célula inline, Enter salva e Esc cancela | TreeViewPage.tsx:601-606,757,833 | tree-view-dependencies-column.test.tsx (edição); Esc: SEM TESTE |
| A6-08 | InlineEdit e AddCardForm: Enter/Esc | InlineEdit.tsx:45-48; AddCardForm.tsx:41 | inline-edit.test.tsx, add-card-form.test.tsx |
| A6-09 | Outros Esc globais: ExportDialog:228, ProjectPlanningModal:236, VersionDetailModal:73, AvatarCropDialog:43, `W/pages/AdminUsersPage.tsx:192`, `W/features/board/components/BoardModals.tsx:103` | — | project-planning-modal.test, board-modals.test, admin-users-avatar.test; Export e Version: SEM TESTE |
| A6-10 | AccountPage: setas no radiogroup de temas trocam e salvam | `W/pages/AccountPage.tsx:28-35,120` | SEM TESTE |

### Área 7 — Menu do avatar e Conta

| ID | Comportamento | arquivo:linha | Coberto por |
|---|---|---|---|
| A7-01 | O avatar (aria-label `accountSettings`) abre o dropdown; clique fora fecha | ProfileDropdown.tsx:16-32 | SEM TESTE |
| A7-02 | "Configurações da conta" leva a `/account` | ProfileDropdown.tsx:36-42 | SEM TESTE |
| A7-03 | Switch "Projetos ocultos": `sessionStorage["show-hidden-projects"]`, zerado no login e no logout; ProjectsPage passa a pedir `includeHidden` | ShowHiddenProjectsSwitch.tsx; contexts/AuthContext.tsx:52-62; lib/sessionPreferences.ts | project-visibility-contract (texto), sessionPreferences.test.ts; clique no DOM: SEM TESTE |
| A7-04 | Sair: `POST /auth/logout`, zera ocultos, apaga rascunhos, `queryClient.clear()` | ProfileDropdown.tsx:48-54; AuthContext.tsx (logout) | SEM TESTE |
| A7-05 | Idioma e ThemeToggle ficam no header, fora do dropdown | AppShell.tsx:450-452 | theme-toggle.test.tsx |
| A7-06 | AccountPage, nesta ordem:<br>• Perfil/foto: nome via `PATCH /users/me {name}`, avatar upload/delete<br>• Senha: `PATCH /me/password`, só login LOCAL<br>• Aparência: claro/escuro (desabilitado com o automático), switch automático por horário, preset de shell; tudo via `PATCH /users/me` + toast<br>• Visibilidade: só sessão, não vai ao servidor<br>• Chaves de API | AccountPage.tsx:46-187 | conta-leiaute-contract (ordem), account-page-appearance.test.tsx (preset), profile-name-field.test.tsx, password-section.test.tsx; claro/escuro e automático na página: SEM TESTE |
| A7-07 | `applyPreferences` grava `localStorage` theme / light-shell-theme / language, `data-light-shell-theme`, `i18n.changeLanguage` e aplica o tema efetivo. `updatePreferences` é otimista: aplica, envia o PATCH e reaplica a resposta | AuthContext.tsx:65-82,158-167 | SEM TESTE direto (theme.test.ts cobre o tema efetivo) |
| A7-08 | API `PATCH /users/me`: `ALLOWED_FIELDS` = name, theme, lightShellTheme, language, autoThemeByTime; valida cada um; nome tratado à parte | `R/apps/api/src/routes/users.ts:20,136-182` | `R/apps/api/src/shell-theme-preferences.test.ts`, `user-name.test.ts`, `change-password.test.ts`, `avatar.test.ts` |

### Área 8 — Configurações do projeto

As 13 seções:
- **General:** `board-format`, `appearance`, `visibility`, `checklists`, `planning`, `manager`
- **Organization:** `columns`, `members-squads`, `cost-centers`
- **Integration:** `integrations`
- **Delivery:** `modules` (só HIERARCHICAL), `sprints`, `versions`

| ID | Comportamento | arquivo:linha | Coberto por |
|---|---|---|---|
| A8-01 | Abrem por padrão: `board-format` e `visibility` (em memória, não persiste) | ProjectSettingsScreen.tsx:31 | SEM TESTE |
| A8-02 | A barra Expandir/Recolher usa `allSectionIds` (12 itens). **`integrations` fica de fora.** `modules` sai da barra com SIMPLE ou `hideModules`, mas com `hideModules` a seção continua renderizada | ProjectSettingsScreen.tsx:35; DeliverySettingsSections.tsx:26 | SEM TESTE |
| A8-03 | `globalGroup TEAM_MEMBER` vê tela de acesso negado. `isAdmin` = pode acessar settings E (papel ADMIN no projeto ou global MANAGER/ADMIN/ROOT) | ProjectSettingsScreen.tsx:90; hooks/useProjectSettingsData.ts:58 | settings-behavior.test.ts (modelo) |
| A8-04 | Só admin, com aviso `adminOnly`: formato do board (+ ocultar módulos/épicos), aparência, visibilidade, checklists, planejamento | GeneralSettingsSections.tsx:78-153 | general-settings-collapse.test.tsx (ocultar níveis); restante: SEM TESTE |
| A8-05 | Só admin: select do gestor (o `saveManager` não verifica `isAdmin`), criar coluna, peso e status base, adicionar membro, criar CC, integrações, criar versão | GeneralSettingsSections.tsx:164; OrganizationSettingsSections.tsx:63,101,107,112; IntegrationSettingsSections.tsx:96; DeliverySettingsSections.tsx:28 | column-progress-weight.test.tsx, member-dialog.test.tsx; restante: SEM TESTE |
| A8-06 | Confirmações: conversão para SIMPLE, ligar ocultar níveis, excluir coluna (com destino), squad, membro, módulo (409 → escolher destino ou cascata), sprint abrir/fechar (`confirm`), excluir versão (`confirm`) | GeneralSettingsSections.tsx:167-169; OrganizationSettingsSections.tsx:115-117; ProjectSettingsScreen.tsx:82-87 | general-settings-collapse.test.tsx, ui-mode-contract (texto), e2e journeys (coluna, módulo, squad) |
| A8-07 | Invalidação por seção:<br>• columns → `'columns'`<br>• squads → `'squads'`; excluir squad → `'squads','members'`<br>• membros → `'members','squads'`<br>• `'costCenters'`, `'modules'`, `'sprints'`, `'versions'` cada um na sua seção<br>• General faz `PATCH /projects/:id` + `applyProject`<br>• WebSocket invalida a seção correspondente; reconexão faz `invalidateAll` | ProjectSettingsScreen.tsx:38-88 | migrated-screens-cache-contract (texto), member-dialog.test.tsx, useMemberCandidates.test.tsx |

### Árvore (extra)

| ID | Comportamento | arquivo:linha | Coberto por |
|---|---|---|---|
| T-01 | "+" na faixa inferior da linha (hover) cria o próximo nível, com alvo extra para Bug | TreeViewPage.tsx:623-660 | tree-view-column-filters.test.tsx (5 testes) |
| T-02 | "+" no limite do cabeçalho insere coluna naquela posição (entre `name` e `actions`) | TreeViewPage.tsx:1651-1681,2036-2050 | tree-view-dependencies-column.test.tsx |
| T-03 | 17 colunas (`name` e `actions` travadas; 8 visíveis por padrão + `actions`), persistidas em `tree-grid-columns:{userId}:{pid}`; reordenar arrastando, redimensionar | TreeViewPage.tsx:105-123,212,1638-1644 | tree-view-dependencies-column.test.tsx (rehidrata, persiste, resize), tree-cache-contract; reordenar por arraste: SEM TESTE |
| T-04 | Mover itens entre pais (regras de hierarquia, recusa de ciclo); Expandir/Recolher próprios; arquivar em cascata com Desfazer | TreeViewPage.tsx:1940-1946 | tree-view-item-actions.test.tsx, tree-move-rules.test.ts, e2e journeys "árvore" |

---

### Testes de contrato sensíveis (leem código-fonte como texto)

- **`W/ui-mode-contract.test.ts`** lê BoardScreen, BoardLanes, BoardCommandBar, BoardFilters, ActiveFilterChips, useBoardPreferences, useBoardFilterValidation, boardView, treeFilterQuery, TreeViewPage, ItemModal, EpicModal, StoryModal, RichTextEditorImpl, GeneralSettingsSections, ProjectsPage. Exige literais como:
  - `showExpandCollapse={view === 'kanban' && boardMode === 'HIERARCHICAL'}` e o equivalente de `showModuleViewMode`
  - `t('filterSprint')` … `t('filterAuthor')`, `t('noSprint')` etc. e `<option value="">{t('filterSprint')}</option>`
  - ``localStorage.setItem(`board-filters:${projectId}` ``
  - `<DndContext`, `handleDragEnd(e, effectiveOver)`, `<TreeViewPage`, `simpleBoard={isSimpleBoard}`
  - `{simpleBoard && simpleStory && <Swimlane`, `onCreate={openCreation}`, `onEdit={handleOpenDetail}`, `newItem={newItemCreation}`
  - Na árvore: `z-10` (e ausência de `z-20`/`z-30`), `role="progressbar"`, `setExpanded(previous =>`
- **`W/board-compact-density-contract.test.ts`** lê globals.css, KanbanCard, BoardCommandBar, BoardScreen, CompactFilterSummary e os `board.json`. Exige:
  - CSS `.density-compact .kanban-card-content`, `.kanban-card-breadcrumb`, `.kanban-card-title p`, `gap: 0.25rem`
  - `density === 'compact' ? 'min-h-10 py-1'`, `{compactFilters}`, `progress.total > 0`
  - `compactFilters={density === `, `progress={{ completed: sprintCompleted`, `density !== 'compact' && (`, o regex da classe `gap-2/gap-3`
  - `normalizeActiveBoardFilters`, `t('filtersSummary'`
- **`W/kanban-card-layout-contract.test.ts`** lê KanbanCard. Exige:
  - **A ordem dos comentários JSX** "Topo / Breadcrumb / Título / Etiquetas / T75 / Rodapé" e "Ações: copiar, arquivar, excluir."
  - Classes `border-l-[3px]`, `line-clamp-2`, `w-[84px]`, `h-[26px] w-[26px]`, `group-hover:opacity-100`, `group-focus-within:*`, `max-w-[8.5rem]`
  - Ordem copiar → arquivar → excluir, `window.confirm(t('deleteItemConfirmation'))`, `e.stopPropagation()`
- **`W/card-copy-reference-contract.test.ts`** lê KanbanCard, lib/cardReference, lib/clipboard. Exige o botão e o feedback de cópia, o tooltip citando a área de transferência, `navigator.clipboard.writeText` + `execCommand('copy')` e o formato `[id=${card.id}]`.
- **`W/components/kanban-card-drag-handle.test.tsx`** lê globals.css (seletores `.kanban-card-grip*` e estados de hover/foco).
- **`W/components/board-command-bar-levels.test.ts`** lê BoardCommandBar. Exige `type !== 'MODULE' || !hideModules`, `type !== 'EPIC' || !hideEpics`, `modules={hideModules ? [] : modules}`.
- **`W/features/board/board-planning-entry.test.ts`** lê BoardScreen. Exige `onProjectNameActivate={() => setPlanningOpen(true)}`, `{planningOpen && projectId && (`.
- **`W/frontend-page-modularity-contract.test.ts`** lê pages/BoardPage, SettingsPage, BoardScreen, useBoardPreferences, useBoardData, ProjectSettingsScreen, useProjectSettingsData, model/types. Exige os re-exports das páginas, os imports `./hooks/useBoardPreferences` e `./hooks/useBoardData`, `board-filters:${projectId}`, `useWebSocket`, `isAdmin`, `ProjectSettingsData`.
- **`W/tree-cache-contract.test.ts`** lê TreeViewPage, BoardScreen, queryKeys. Exige a forma do `useQuery`, `tree-grid-columns:`, ``localStorage.setItem(treeGridStorageKey(...``, `style={{ width: totalColumnsWidth }}`, `<col />`, `invalidateTree(queryClient, user?.id, projectId)`, o PATCH da célula e a invalidação do board.
- **`W/assistant-view-commands-contract.test.ts`** lê useBoardAgentSession, AzyAgentDrawer, assistantViewStore. Exige `setFilters(session.filters)`, `setView(session.mode)`, `setItemModalId(session.openItemId)`, `subscribeViewSession`, `syncCurrentViewSession`, `sessionStorage`.
- **`W/assistant-screen-context.test.ts`** lê BoardScreen, useBoardAgentSession, TreeViewPage, ItemModal, assistantFocusStore e outros. Exige `assistantScreenSnapshot={assistantScreenSnapshot}`, `buildScreenSnapshot`, `focusState.activeItemId`, `publishFocusLevel`, `activeArea as AssistantItemArea`, `onSnapshotChange`, `screen: 'project-board-tree'`.
- **`W/assistant-ui-contract.test.ts`** lê BoardScreen e outros. Exige `storyModalData?.story?.id`, `epicModalData?.epic?.id`.
- **`W/dashboard-contract.test.ts`** lê BoardScreen. Exige `searchParams.get('itemId')`.
- **`W/app-shell-layout-contract.test.ts`** lê AppShell. Exige a ordem de z-index (header `z-30` > commandBar `z-20` > 0; `relative z-40` na sidebar), `backdrop-blur-xl`, os slots, `data-project-name-activate`, Conta antes de Admin.
- **`W/item-modal-layout-contract.test.ts`** lê globals.css, ItemModal, ItemDetailModalShell. Exige `.item-modal-frame` com 80vh/80dvh, sem `max-h-[95vh]`, e a ordem header → tabs → conteúdo → footer com classes exatas.
- **`W/item-modal-spacing-contract.test.ts`** lê ItemModal, ItemDetailHeader, InlineEdit, KanbanCard. Exige `max-w-[1120px]`, a ordem tablist → aside → details, `lg:grid-cols-[minmax(0,1fr)_320px]`, `min-w-0 flex-1"><h2 id="item-modal-title"`, `value={parentId}`, os campos do payload, InlineEdit sem `text-sm`.
- **`W/accordion-item-detail-contract.test.ts`** lê ItemModal, EpicModal, StoryModal, AccordionSection, AccordionToolbar, painéis e locales. Exige que Épico/História usem `<ItemDetailModalShell`/`<ItemDetailHeader`/`<ItemAreaTabs`/`<ItemPropertiesPanel`, e que o ItemModal tenha `useState<ItemArea>('details')`, `aria-selected={activeArea === area.id}`, `count: subtaskCount`, `count: activityCount`.
- **`W/epic-story-forms-contract.test.ts`** lê EpicModal, StoryModal, CardChildrenSection, BoardScreen, useBoardItemEditing. Exige `"event.key === 'Escape'"`, os ids de aba `'details'/'children'/'activity'`, `handleOpenChildFromHierarchy`, `type="EPIC"`/`type="STORY"`.
- **`W/card-tokens-contract.test.ts`** e **`W/history-worklog-panel-contract.test.ts`** leem ItemModal e os painéis. Exigem campos de tokens e `disabled={currentUserRole === 'VIEWER'}`, `xl:grid-cols-2`, `setWorkLogCount`.
- **`W/checklist-advanced-fields-contract.test.ts`** lê ItemModal, ChecklistSection, GeneralSettingsSections, ProjectSettingsScreen. Exige `'checklists'`, `advancedChecklists: value`, `aria-checked={advancedChecklists}`.
- **`W/migrated-screens-cache-contract.test.ts`** lê ProjectSettingsScreen, useProjectSettingsData e outros. Exige cada `data.invalidate('...')` literal, `data.applyProject(updated)`, `buildSettingsHandlers(`, `data.invalidateAll()`.
- **`W/project-visibility-contract.test.ts`** lê ProfileDropdown, ShowHiddenProjectsSwitch, AccountPage, AuthContext, sessionPreferences, GeneralSettingsSections, ProjectsPage. Exige `<ShowHiddenProjectsSwitch labelKey="hiddenProjects" />` no dropdown, `<ShowHiddenProjectsSwitch />` na conta, `role="switch"`, `onVisibilityChange('isRestricted', value)`.
- **`W/conta-leiaute-contract.test.ts`** lê AccountPage. Exige a ordem Perfil < Senha < `t('appearance')` < Visibilidade < Chaves, com `<PasswordSection />` uma única vez.
- **`W/optimistic-mutations-contract.test.ts`** (useBoardItemEditing, useBoardData) e **`W/shell-theme-parity.test.ts`** (globals.css + `settings.json` nos 3 idiomas) também quebram com renomes.

---

### Riscos

1. **Contratos textuais.** Cerca de 25 arquivos de teste quebram por renomear JSX, mover comentários ou trocar classes, sem nenhuma mudança de comportamento. Os mais frágeis: `kanban-card-layout` (ordem dos comentários), `ui-mode`, `board-compact-density`, `item-modal-*`, `accordion`/`epic-story` (exigem a casca nas modais de Épico/História).
2. **O arraste depende de seletores do DOM**: `[data-drop-id]`, ids `lane:col:`/`lane:drop:`, `.board-column-cards > .kanban-card`, `[data-card-id]`, `.kanban-card-placeholder`, `.kanban-card--dragging`. Mudar a marcação do card ou da coluna quebra a medição sem nenhum erro visível; não há teste unitário da medição e o `drag-animation.ts` não roda em nenhum script.
3. **Soltar em outra história ou épico só troca a coluna**, e a ordem é calculada sobre a coluna inteira, todas as lanes juntas (A1-22). Se o redesign passar a sugerir "mover de história", muda a semântica, e hoje não há teste.
4. **Clique no título entra em edição inline na hora**, e o atraso de 160 ms quase nunca é exercido (A1-29). O VIEWER também consegue arrastar. Qualquer mudança nesses gestos precisa de teste de caracterização antes.
5. **Contagem de filtros incoerente.** O badge, os chips (que incluem preferências de exibição e contam cada valor) e o resumo compacto mostram números diferentes. Os toggles de vazios ficam em Opções mas contam como filtro e são zerados pelo "Limpar". Há 3 botões "Limpar" e 2 selects de squad.
6. **Visão e sessão do agente.** A visão não persiste e o agente força kanban/tree, tirando o usuário do Unificado. `set_filters` zera as preferências de exibição, e o overlay em sessionStorage impede a gravação no localStorage. Persistir a visão muda essa interação.
7. **Detalhe do card.** O `?itemId=` não é limpo ao fechar, então o modal reabre quando os dados mudam. Esc fecha sem confirmar alterações. O ItemModal duplica a casca em vez de usar o shell. Não existe anterior/próximo, e criar essa navegação exige definir a ordem dos cards e o que acontece com o rascunho, cuja chave é por item.
8. **Configurações e avatar.** `integrations` fica de fora do Expandir tudo, e `modules` fica fora da barra mas continua renderizado com `hideModules`. As seções abertas não persistem. Sprints, versões, CC, planejamento, aparência, gestor e o dropdown do avatar não têm teste de DOM.