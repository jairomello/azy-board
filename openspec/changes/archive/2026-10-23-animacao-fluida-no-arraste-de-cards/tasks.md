# Tasks

## 1. Modelo da animação e estado do arraste

- [x] 1.1 Criar `apps/web/src/features/board/model/dragAnimation.ts` com o destino sob o ponteiro, as durações (aceite, reversão, movimento reduzido), a curva da reordenação e o plano de keyframes do assentamento — verificado por `bun test apps/web/src/features/board/drag-animation.test.ts`, incluindo ponteiro exatamente na borda e ausência de colunas
- [x] 1.2 Criar `apps/web/src/features/board/hooks/useBoardDragAnimation.tsx` com a prévia, o card ativo, a validade do destino (`validRef`) e a prévia corrente (`previewRef`), expostos por contexto e com entrada/saída limpas no início e no fim do arraste — verificado por `bun test apps/web/src/features/board/board-drag-animation.test.tsx` (repouso, início, movimentação, soltura, cancelamento e arraste de coluna)
- [x] 1.3 Documentar em `docs/board-drag-animation.md` o contrato do arraste (vaga, prévia, deslizamento, assentamento, reversão, destinos e fontes no código) — verificado por `bun run check:docs`

## 2. Vaga de destino na coluna e no índice

- [x] 2.1 Criar `CardDropPlaceholder` e, em `BoardColumns`, renderizar o card ativo como nó sem espaço (`.kanban-card--dragging`) e a vaga no índice da prévia, preservando `setNodeRef` e o registro do arraste — verificado por `bun test apps/web/src/features/board/components/card-drop-placeholder.test.tsx` e `board-column-drop-target.test.tsx`
- [x] 2.2 Estilizar a vaga e o overlay em `apps/web/src/styles/globals.css` com os tokens do board, legível nos temas claro e escuro e na densidade compacta, sem borda de status nem sombra do card — verificado por medição no board em execução (altura da vaga igual à do card, 164,25 px confortável e 117,84 px compacta) e por captura de tela nos dois temas
- [x] 2.3 Confirmar que a vaga não altera a contagem da coluna nem é persistida, e que o card de origem não fica duplicado — verificado no board em execução: contagem somando 5 cards durante o arraste, conteúdo do card arrastado ausente e vaga ausente do estado persistido

## 3. Prévia do destino e deslizamento

- [x] 3.1 Criar `apps/web/src/features/board/model/dragPreview.ts` resolvendo coluna, índice e âncora, com o reposicionamento dos cards abaixo da origem e a âncora ciente do caso "mesma coluna" — verificado por `bun test apps/web/src/features/board/drag-preview.test.ts` (mesma coluna, coluna vazia, última posição e ausência de destino)
- [x] 3.2 Ajustar os estados de destino da coluna em `BoardColumns` para que só a coluna sob o ponteiro receba o destaque e, sem destino válido, nenhuma seja destacada — verificado por `bun test apps/web/src/features/board/components/board-column-drop-target.test.tsx` e por observação no board em execução
- [x] 3.3 Criar `apps/web/src/features/board/hooks/useCardFlip.ts` (deslizamento com cancelamento por card) e conferir o movimento em lanes (HIERARCHICAL) e na densidade compacta — verificado por medição no board em execução: 69 posições distintas em 5 cruzamentos com animações ativas, e o mesmo dentro da lane do épico

## 4. Assentamento, reversão e persistência

- [x] 4.1 Configurar o `dropAnimation` do `DragOverlay` como função própria, animando até o retângulo da vaga (aceite) ou da origem (reversão), sem resíduo de rotação e escala — verificado por `bun test apps/web/src/features/board/drag-animation.test.ts` para o plano e por medição no board: o card assenta no mesmo deslocamento e índice da vaga
- [x] 4.2 Reconstruir o ponteiro (cliente do evento ativador + delta) para resolver a validade do destino, sem depender de `event.over`, e bloquear a mutação quando não houver destino — verificado por `bun test apps/web/src/features/board/board-drag-animation.test.tsx` e por observação: soltar fora das colunas não destaca coluna, não mostra vaga, avisa e devolve o card à origem
- [x] 4.3 Persistir a posição da vaga no movimento entre colunas com `destinationOrderWithInserted` + `PATCH /items/reorder` após o `PATCH /items/:id/move`, com rollback cirúrgico — verificado por `bun test apps/web/src/features/board/board-interaction.test.ts` (duas chamadas, ordem do destino e preservação de atualização concorrente) e por observação no board
- [x] 4.4 Aplicar movimento reduzido em um único ponto: FLIP com duração zero e `dropAnimation` sem animação — verificado por `bun test apps/web/src/features/board/drag-animation.test.ts` com a media query simulada e por medição no board em execução: zero animações de script e saltos diretos ao lugar

## 5. Mensagens traduzidas

- [x] 5.1 Adicionar as chaves novas (rótulo da vaga, cancelamento por ausência de destino e recusa da mutação) em pt-BR/en/es no namespace do board, e usá-las na vaga, no aviso de cancelamento e no feedback de recusa — verificado por `bun run check:i18n` e pelos testes de componente que conferem o texto traduzido

## 6. Verificação integrada

- [x] 6.1 Rodar `bun run test:e2e` e confirmar as jornadas de drag verdes (9/9), já que elas localizam a alça por `[title="Arrastar card"] svg` e movem o ponteiro em passos
- [x] 6.2 Rodar `bun run test:smoke` contra uma stack descartável com dois administradores (o smoke verifica isolamento entre tenants): criação, edição, movimento e leitura de item com código de saída 0
- [x] 6.3 Rodar `bun run check`, `bun run check:frontend-tests`, `bun run check:i18n`, `bun run check:bundle` e `bun run check:docs` e confirmar typecheck, lint, testes, build, orçamento do chunk do board e integridade da documentação

## Workflow follow-up

- Card **T89** (`f1590127-eb2f-4f79-b60e-c1c1b34fb22a`) já foi movido para `Fazendo` e reivindicado no início da implementação.
- Fechar o card **T89** com `complete_task` e confirmar no board real que ele está em coluna com `baseStatus = DONE`; registrar o consumo de tokens do card. Encerrar a change não encerra o card.
- Arquivar a change depois de sincronizar as deltas para `openspec/specs/board-drag-animation/` e para `openspec/specs/board-management/`, conferindo o resultado em `openspec/changes/archive/`.
