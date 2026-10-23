# Proposal

## Why

Mover cards é a operação central do quadro, mas o arraste no board real não corresponde ao que o usuário vê: o card de origem permanece esmaecido no lugar antigo, não existe uma vaga de destino explícita, a reordenação usa a transição padrão do dnd-kit (200 ms, `ease`) e, ao soltar, o card nem sempre pousa no retângulo que o usuário estava mirando. O protótipo `docs/prototipos/arraste-cards/` já resolveu esse problema com uma vaga tracejada de destino, deslizamento dos outros cards em uma única curva e um assentamento preciso do card arrastado antes da troca. Portar esse estilo e essa lógica para o board real torna o arraste previsível e elimina a sensação de "o card caiu em outro lugar".

## What Changes

- **Vaga de destino explícita.** Durante o arraste, a posição de soltura passa a ser marcada por uma caixa tracejada com a altura exata do card arrastado, no lugar do card de origem esmaecido que existe hoje. A vaga não é interativa e não altera o conteúdo nem a contagem da coluna. O card arrastado sai do fluxo (a lista fecha o buraco) e a vaga aparece na coluna e no índice resolvidos pelo ponteiro, inclusive quando o destino é outra coluna.
- **Reordenação ao vivo com movimento único.** Os demais cards deslizam para a ordem de soltura com a curva e a duração do protótipo (`cubic-bezier(.2,.8,.2,1)`, ~190 ms), cancelando a animação anterior do mesmo card quando o ponteiro volta a cruzar um ponto médio. Cards que não mudam de posição não animam.
- **Assentamento preciso do card arrastado.** Ao soltar com destino válido, o card arrastado anima até o retângulo da vaga (~180 ms) e só então é substituído pela posição final, sem salto de posição, escala ou rotação residual.
- **Rejeição explícita.** Sem destino válido sob o ponteiro (fora das colunas) ou com a mutação recusada pelo servidor, nenhuma coluna é marcada como destino, o board comunica o motivo e o card retorna à origem com animação própria de reversão (~220 ms). O rollback de estado já existente é preservado.
- **Movimento reduzido.** Com `prefers-reduced-motion: reduce`, não há deslizamento nem assentamento animado: a duração é zero e o estado final é aplicado imediatamente.
- **Prévia resolvida pelo quadro.** A ordem que o dnd-kit aplica com o `verticalListSortingStrategy` só desloca o item ativo dentro da própria lista; por isso a prévia do arraste passa a ser resolvida pelo quadro, a partir do ponteiro e da geometria medida no início do arraste. O dnd-kit continua dono do ciclo do arraste (captura do ponteiro, ativação, overlay) e dos endpoints `PATCH /items/reorder` e `PATCH /items/:id/move`.
- **Posição persistida no movimento entre colunas.** O `PATCH /items/:id/move` sozinho troca a coluna e deixa o card no topo, longe de onde o usuário soltou; o movimento entre colunas passa a enviar também `PATCH /items/reorder` com a ordem da coluna de destino já com o card na posição da vaga.

## Capabilities

### New Capabilities

- `board-drag-animation`: comportamento observável do arraste de cards no quadro — vaga de destino, deslizamento da reordenação ao vivo, assentamento do card arrastado, reversão em rejeição e respeito a movimento reduzido, em todos os modos de board, densidades e temas.

### Modified Capabilities

- `board-management`: o requisito **Drag-and-drop de cards entre colunas** passa a exigir que a posição vertical escolhida na coluna de destino também seja persistida, via `PATCH /items/reorder`, e que o rollback restaure coluna, posição e as posições dos demais cards da coluna de destino. Hoje o requisito só fala da troca de coluna.

O requisito de `board-visual-presentation` sobre a coluna como destino de arraste continua satisfeito — a coluna elegível segue comunicando o estado de destino — e o requisito genérico de estados visuais não fixa a aparência do card durante o arraste.

## Impact

- **Código (frontend):**
  - `apps/web/src/features/board/BoardScreen.tsx` — `DndContext`, `DragOverlay` e `dropAnimation`; estado do arraste ativo e do destino válido.
  - `apps/web/src/features/board/components/BoardColumns.tsx` — destaque da coluna de destino e lista com o card fora do fluxo e a vaga no índice da prévia.
  - `apps/web/src/features/board/components/CardDropPlaceholder.tsx` — a vaga de destino.
  - `apps/web/src/components/KanbanCard.tsx` — o card arrastado sai do fluxo sem duplicar conteúdo.
  - `apps/web/src/features/board/model/` e `apps/web/src/features/board/hooks/` — modelo testável da prévia, hook de estado do arraste, FLIP do deslizamento e a persistência da posição no movimento entre colunas.
  - `apps/web/src/styles/globals.css` — regras da vaga de destino, dos estados de destino e das transições, dentro dos tokens do board.
- **API, banco e dependências:** sem endpoint novo nem migração. O movimento entre colunas passa a fazer duas chamadas já existentes (`move` e `reorder`); nenhuma dependência nova é prevista (as animações usam a Web Animations API nativa).
- **i18n:** o rótulo da vaga de destino e a mensagem de cancelamento/recusa precisam de chaves traduzidas em pt-BR/en/es, no namespace do board.
- **Acessibilidade:** o arraste segue iniciado apenas pela alça (`role`/`tabIndex` do `useSortable`) e o foco por teclado é preservado; a vaga de destino é decorativa e não deve duplicar o anúncio do dnd-kit.
- **E2E e regressão:** `e2e/journeys.ts` localiza a alça por `[title="Arrastar card"] svg` e move o ponteiro em passos; os tempos e a presença da vaga não podem quebrar as jornadas de drag existentes. O snapshot `board-simple` de `e2e/visual.ts` é capturado com o quadro vazio e não cobre o arraste.
- **Orçamento:** `apps/web/bundle-budget.json` precisa continuar verde — o chunk do board não pode crescer para acomodar a mudança.
- **Board ref:** card **T89** (`f1590127-eb2f-4f79-b60e-c1c1b34fb22a`) no Azy Board, em `A Fazer`.
