# Design

## Context

Ver `proposal.md — Why`. Em `apps/web/src/features/board/components/BoardColumns.tsx`, cada coluna é composta por `SortableColumn` (cabeçalho + `DroppableColumn`) e `DroppableColumn` contém, na ordem atual, `<div class="board-column-cards">` (lista + `SortableContext`) e depois `<div class="board-column-add">` (botão `+ Adicionar card` ou `AddCardForm`). Os espaçamentos vêm de utilitários Tailwind (`p-2 mt-1`, `px-3 pt-2.5`) e `.board-add-card` em `globals.css`; `.density-compact` reduz paddings do conteúdo do card, não do bloco de criação.

## Goals / Non-Goals

**Goals:**
- Colocar o controle de criação logo abaixo do cabeçalho da coluna e antes da lista de cards, sempre visível no topo.
- Manter o mesmo comportamento (formulário rápido inline, criação via `POST /projects/:id/items`, permissões, tempo real).
- Ajustar espaçamentos para o topo sem colidir com o primeiro card, nas densidades confortável e compacta.

**Non-Goals:**
- Alterar o formulário rápido, a toolbar de criação, a API ou o modelo de dados.
- Introduzir posicionamento "sticky" do controle (a coluna usa `overflow-hidden` e o canvas é o contêiner de rolagem; ver Decisões).
- Reordenar colunas, cards ou qualquer outra região.

## Decisions

### Reordenar o bloco de criação dentro do `DroppableColumn`

Mover `<div class="board-column-add">` para antes de `<div class="board-column-cards">`, mantendo-o **dentro** do `DroppableColumn` (área de drop). Assim o botão/formulário aparece abaixo do cabeçalho e acima dos cards, e a área de drop continua abrangendo o topo da coluna.

- Alternativa considerada: mover o controle para fora do `DroppableColumn`, em `SortableColumn`, logo após o cabeçalho. Rejeitada porque reduziria a área de drop útil e separaria o controle do contexto rolável da coluna.

### Posicionamento não "sticky"

Manter o controle no fluxo (não fixo) no topo da coluna. A coluna usa `overflow-hidden` para os cantos arredondados e o `board-canvas` é o contêiner de rolagem; um `position: sticky` seria limitado por esses contêineres e criaria comportamento inconsistente. O ganho de usabilidade pedido (não rolar até o fim em colunas longas) é atendido por estar no topo.

- Alternativa considerada: `sticky top-0` no bloco de criação. Rejeitada pela interação frágil com `overflow-hidden`/scroll do canvas.

### Espaçamento no topo

Ajustar `board-column-add` para `px-3 pt-2.5` (mesmo recuo horizontal dos cards) e reduzir a separação superior de `board-column-cards` (ex.: `pt-2`), removendo o `mt-1`/`p-2` do rodapé. No modo compacto (`density-compact`), reduzir o padding vertical do bloco de criação para manter a densidade. Estados de coluna vazia e de formulário aberto usam o mesmo slot do topo.

## Risks / Trade-offs

- [Baseline visual `e2e/__screenshots__/board-simple.png` divergente] → regenerar com `E2E_UPDATE_SNAPSHOTS=1 bun run test:visual` após validar.
- [Espaçamento duplicado entre o controle e o primeiro card] → revisar `board-column-add` + `board-column-cards` nas duas densidades.
- [Interferência no arraste/drop] → o bloco permanece dentro do `DroppableColumn` e fora do `SortableContext` dos cards.
- [Coluna órfã sem criação] → preservar `allowAdd={false}` (nenhum controle é exibido).

## Migration Plan

1. Reordenar o bloco de criação no `BoardColumns.tsx`.
2. Ajustar espaçamentos em `globals.css` (inclusive `.density-compact`).
3. Verificar comportamento (abrir form no topo, criar card, coluna vazia, arraste) e regenerar a baseline visual.

Rollback: restaurar a ordem anterior do bloco no `BoardColumns.tsx` e os espaçamentos; sem migração de dados.
