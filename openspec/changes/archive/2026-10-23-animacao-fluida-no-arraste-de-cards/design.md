# Design

## Context

Ver `proposal.md` — Why. Estado verificado no código e no board em execução em 23/10/2026:

- `apps/web/src/features/board/BoardScreen.tsx`: sensor `PointerSensor` com `activationConstraint` de 5 px; `collisionDetection` própria (cards > `:drop:` > `:col:` sobre `pointerWithin`); `onDragOver` guarda `lastOverRef`; `onDragEnd` chama `handleDragEnd(e, effectiveOver)`; `DragOverlay` com o wrapper do card.
- `apps/web/src/components/KanbanCard.tsx`: a raiz recebe `setNodeRef`; a alça é o único elemento com `attributes`, `listeners` e `setActivatorNodeRef`; `canDrag = card.isLeaf && card.type !== 'EPIC'`.
- `apps/web/src/features/board/components/BoardColumns.tsx`: uma coluna por `SortableColumn` (`${laneId}:col:${column.id}`) com um `DroppableColumn` (`${laneId}:drop:${column.id}`) e um `SortableContext` por coluna. `BoardLanes` renderiza um `BoardColumns` por agrupamento (lanes), prefixando tudo por `laneId`.
- dnd-kit instalado (`@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 8.0.0). Dois fatos do código instalado que mudaram o desenho:
  - `verticalListSortingStrategy` translada o item ativo **só quando o destino é um item da mesma lista**. Ao pairar sobre outra coluna, `over` não pertence ao `SortableContext` de origem, `overIndex` fica inválido e **nenhum** deslocamento acontece — medido no board em execução.
  - `DragOverlay` envolve os filhos em `NullifiedContextProvider`: o card desenhado dentro do overlay nunca se comporta como o card da lista.
- `useSortable` aplica `transition` só em `transform` e devolve `disabledTransition` (`0ms linear`) quando há transform derivada ou o `newIndex` anterior coincide com o índice — o que, medido no board, deixou a reordenação **sem animação** mesmo com a opção `transition` configurada.
- `apps/web/src/features/board/hooks/useBoardInteraction.ts`: `PATCH /items/reorder` na mesma coluna e `PATCH /items/:id/move` entre colunas. Medido no board: o move sozinho deixa o card na **primeira** posição da coluna de destino, independentemente de onde o ponteiro soltou.
- `apps/web/src/styles/globals.css`: tokens `--board-*`/`--board-glow-*` (redefinidos em `.dark`), `.kanban-card` com `min-height: 140px` e raio 13 px, `.density-compact .kanban-card { min-height: 0 }` e `.board-column-dropzone--over`.
- Testes e e2e: `e2e/journeys.ts` localiza a alça por `[title="Arrastar card"] svg`; `e2e/visual.ts` captura `board-simple` com o quadro vazio; orçamento em `apps/web/bundle-budget.json`.

## Goals / Non-Goals

**Goals:**

- Entregar, no board real, a vaga de destino, o deslizamento com curva e duração únicas, o assentamento preciso e a reversão animada, nos moldes do protótipo, **em qualquer destino** (mesma coluna, outra coluna, dentro de uma lane).
- Manter o dnd-kit como dono do ciclo do arraste (captura do ponteiro, ativação, overlay) e dos endpoints de persistência.
- Concentrar as decisões em funções puras testáveis (destino, prévia, ordem do destino, durações) e em um único ponto de leitura de movimento reduzido.
- Honrar a posição escolhida pelo usuário também no movimento entre colunas.

**Non-Goals:**

- Substituir o dnd-kit por pointer events próprios: a captura do ponteiro, a ativação por limiar e o overlay continuam sendo dele.
- Arraste por teclado e anúncios de leitor de tela traduzidos: o `DndContext` não registra `KeyboardSensor` e usa os anúncios padrão em inglês; é trabalho separado.
- Arrastar colunas: o `SortableColumn` mantém o comportamento atual.
- Criar uma coluna proibida: o board não tem destino impedido para card folha (ver Decisão 4).
- Alterar o sensor, o `activationConstraint` ou o esquema dos endpoints.

## Decisions

**1. Prévia própria, com o card ativo fora do fluxo.** `resolveDragPreview` resolve coluna, índice e âncora a partir do ponteiro e da geometria medida no início do arraste; `BoardColumns` renderiza o card ativo como nó sem espaço e a vaga (`CardDropPlaceholder`) na coluna e no índice resolvidos. Alternativas: (a) deixar a prévia com o `verticalListSortingStrategy` — impossível entre colunas, como o board em execução confirmou; (b) reordenar o DOM pelo `over` do dnd-kit (`MeasuringStrategy.Always`) — reintroduziria a mesma limitação por lista e oscilaria com a medição; (c) mover o item no estado durante o arraste (padrão multi-container) — mexeria no estado do board durante o arraste e confundiria `move` com `reorder` na soltura.

**2. Deslizamento com FLIP próprio (`useCardFlip`).** A cada commit o hook mede os cards e anima os que mudaram de posição, cancelando a animação anterior do mesmo card. Alternativa: `transition` do `useSortable` — medido no board, o dnd-kit devolve `disabledTransition` (`0ms linear`) em boa parte dos quadros, e a reordenação saía instantânea. A Web Animations API dá o cancelamento explícito do protótipo e não disputa a propriedade com o sortable (as transforms do sortable deixaram de ser aplicadas nos cards).

**3. Assentamento por `dropAnimation` próprio.** Função própria que anima o overlay do ponteiro até o retângulo da vaga (aceite) ou até a origem (reversão), sem depender do retângulo do nó ativo — que está fora do fluxo. O wrapper do card zera rotação e escala no mesmo intervalo via `--board-drop-duration`, publicado pela própria animação. Alternativa: a configuração declarativa do `DragOverlay` — continua medindo o nó ativo e não permite variar a duração entre aceite e reversão.

**4. "Destino inválido" = nenhum destino sob o ponteiro, mais a recusa do servidor.** Decisão do usuário: o "Bloquear Revisão" do protótipo é simulação e o board não proíbe coluna para card folha. A validade sai do ponteiro (`resolveDragTarget`), não do `over` — e a mutação é bloqueada por essa validade, para que a prévia e a soltura concordem. A recusa do servidor segue coberta pelo rollback otimista, agora cirúrgico.

**5. Âncora sempre à frente da vaga.** A ordem nova é montada inserindo o card imediatamente antes do card que fica depois da vaga (`destinationOrderWithInserted`), a mesma regra na mesma coluna e entre colunas. Quando a vaga é a última, a âncora é vazia e o marcador da coluna insere no fim. Ancorar no último card com `arrayMove` colocava o card um slot abaixo da vaga em arraste para baixo (defeito B14, corrigido). A vaga também é da **instância** da coluna na lane (alvo prefixado por `laneId`), não da coluna lógica, que se repete em todas as lanes.

**6. Posição persistida no movimento entre colunas.** Decisão do usuário depois de medir que o `PATCH /items/:id/move` sozinho deixa o card no topo da coluna de destino, longe da vaga. O drop entre colunas passa a enviar `move` + `reorder`, com `destinationOrderWithInserted` inserindo o card na âncora. Alternativas: manter o card no topo e ajustar a spec (a vaga prometeria uma posição que não se cumpre) ou fixar a vaga na primeira posição (o ponteiro deixaria de escolher).

**7. Movimento reduzido decidido em um ponto.** `prefersReducedMotion()` alimenta o FLIP (duração zero, sem animação) e a duração do assentamento. Alternativa: só `@media (prefers-reduced-motion: reduce)` no CSS — não alcança a animação do overlay, que é Web Animations API disparada em JS.

**8. Modelo puro e hooks dedicados.** `model/dragAnimation.ts` (destino, durações, keyframes), `model/dragPreview.ts` (prévia e âncora), `model/interaction.ts` (ordem do destino), `hooks/useBoardDragAnimation.tsx` (estado do arraste, exposto por contexto para não propagar props por lane e coluna) e `hooks/useCardFlip.ts` (deslizamento). Componentes apenas consomem.

## Risks / Trade-offs

- [O dnd-kit não sabe que a prévia mudou] → o `over` continua sendo calculado, mas a soltura usa a prévia (`previewRef`, lida no fim do arraste) e o arraste de coluna mantém o `over`. Verificado nas jornadas de e2e que arrastam.
- [Duas chamadas (`move` + `reorder`) no drop entre colunas] → se o `reorder` falhar depois do `move`, o card fica na coluna certa e na ordem antiga; o próximo refetch corrige. O rollback local é cirúrgico (coluna, status e posições afetadas), preservando atualizações concorrentes de outros itens — coberto por teste.
- [A altura do card pode mudar ao trocar de coluna quando a região de avanço aparece] → a vaga usa a altura medida no início do arraste; a diferença residual é de poucos pixels e não altera o índice nem a persistência (medido no board).
- [A prévia usa a geometria do início do arraste] → mudanças de layout durante o arraste (realtime) não são absorvidas; o índice continua coerente porque o modelo reposiciona os cards a partir das alturas medidas.
- [O FLIP mede o DOM a cada commit] → custo proporcional aos cards do quadro; o orçamento de bundle segue verde e a medição roda só durante o arraste.
- [Ordem do DOM diferente da lista do `SortableContext`] → o dnd-kit não é mais usado para posicionar os cards; os ids seguem no `SortableContext` apenas para o registro do arraste.
- [Animações não são verificáveis em jsdom] → testes de componente para estrutura e estados, teste de unidade para os modelos e medição por quadro de animação no board em execução (`e2e/drag-animation.ts`, 14 checagens).

## Migration Plan

Sem migração de dados nem endpoint novo: o movimento entre colunas passa a usar dois endpoints já existentes. O deploy é a substituição dos artefatos web e o rollback é reverter o commit. Nenhuma baseline visual é regenerada — o snapshot `board-simple` de `e2e/visual.ts` é capturado com o quadro vazio. `Board ref: f1590127-eb2f-4f79-b60e-c1c1b34fb22a` (card **T89**).

## Open Questions

- O rótulo textual da vaga ("Soltar aqui") foi mantido junto da forma tracejada; a spec exige a vaga visível com a altura do card, não o texto. Se incomodar em quadros densos, é remoção pontual.
- O `DndContext` não registra `KeyboardSensor` e usa os anúncios padrão do dnd-kit em inglês. Habilitar arraste por teclado e traduzir os anúncios é trabalho separado, sem impacto nesta spec.
