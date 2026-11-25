# Proposal

## Why

A prévia do arraste media colunas e cards **uma única vez**, na largada, em
coordenadas de viewport. Quando o quadro rolava durante o arraste — auto-scroll
do dnd-kit ao segurar o ponteiro na borda ou rolagem manual — as colunas
deslizavam na tela e a medição ficava velha. O ponteiro passava a resolver para
a coluna que estava ali **antes** da rolagem.

No Kanban unificado de um fluxo com sete colunas, a última etapa fica fora da
tela em qualquer largura usual de notebook. Reprodução em viewport de 1024 px:
ao arrastar um card da primeira para a última coluna, a faixa rolava 936 px, a
vaga era desenhada em `x = -201` (fora da tela) e a soltura persistia o card na
**terceira** coluna. Soltar em um ponto que sai do retângulo medido cancela o
movimento, o que o usuário percebe como “não consigo arrastar”.

## What Changes

- A medição do arraste passa a guardar os containers roláveis e a posição
  inicial de `scrollLeft`/`scrollTop` (canvas e faixa de colunas de cada lane).
- Uma função pura soma o deslocamento de rolagem desde a largada e reprojeta o
  ponteiro para as coordenadas da medição antes de resolver a vaga.
- Uma escuta de `scroll` durante o arraste recalcula a prévia mesmo sem novo
  movimento do ponteiro, mantendo a vaga e a âncora corretas na soltura.
- O cenário de regressão entra no E2E de arraste: viewport estreito, rolagem
  horizontal e verificação da coluna persistida.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `board-drag-animation`: novo requisito de coerência da vaga e da soltura
  quando o quadro rola durante o arraste.

## Impact

- `apps/web/src/features/board/model/dragAnimation.ts` (soma da rolagem e
  reprojeção do ponteiro).
- `apps/web/src/features/board/hooks/useBoardDragAnimation.tsx` (medição,
  escuta de rolagem e recálculo da prévia).
- `apps/web/src/features/board/BoardScreen.tsx` (captura dos containers
  roláveis na medição).
- Testes unitários de `dragAnimation` e do hook, e `e2e/drag-animation.ts`.
- Sem mudança de contrato REST, MCP, banco ou migration: a persistência continua
  a mesma; muda somente qual coluna é escolhida pelo ponteiro.
