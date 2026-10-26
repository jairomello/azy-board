# Animação de arraste dos cards do quadro

Contrato do movimento do arraste de cards no Kanban: qual vaga de destino aparece,
quanto os cards deslizam, como o card arrastado assenta no destino e o que acontece
quando não há destino válido. O comportamento exigido está em
`openspec/specs/board-drag-animation/spec.md`; as constantes e decisões puras são a
fonte única em `apps/web/src/features/board/model/dragAnimation.ts` — este documento
explica o contrato, não repete os números.

## Fontes no código

| Papel | Arquivo |
|---|---|
| Constantes, destino sob o ponteiro, durações e keyframes | `apps/web/src/features/board/model/dragAnimation.ts` |
| Prévia do arraste (coluna, índice, âncora, ordem do destino) | `apps/web/src/features/board/model/dragPreview.ts` |
| Estado do arraste (prévia, validade, card ativo) | `apps/web/src/features/board/hooks/useBoardDragAnimation.tsx` |
| Deslizamento dos cards (FLIP) | `apps/web/src/features/board/hooks/useCardFlip.ts` |
| Ciclo do arraste, overlay e persistência | `apps/web/src/features/board/BoardScreen.tsx` |
| Vaga de destino | `apps/web/src/features/board/components/CardDropPlaceholder.tsx` |
| Lista da coluna com o card fora do fluxo e a vaga | `apps/web/src/features/board/components/BoardColumns.tsx` |
| Persistência da ordem na coluna de destino | `apps/web/src/features/board/hooks/useBoardInteraction.ts` |
| Estilos da vaga, do overlay e da coluna de destino | `apps/web/src/styles/globals.css` |

## Por que a prévia não é mais do dnd-kit

O `verticalListSortingStrategy` do dnd-kit translada o item ativo **apenas** quando o
destino é um item da mesma lista: ao pairar sobre outra coluna, `over` não pertence ao
`SortableContext` de origem, `overIndex` fica inválido e nenhum deslocamento acontece —
nem a vaga vai para o destino, nem a coluna de origem fecha o buraco.

Por isso a prévia é resolvida pelo quadro, a partir do ponteiro e da geometria medida
no início do arraste. O dnd-kit continua dono do ciclo do arraste (captura do ponteiro,
ativação com `activationConstraint` de 5 px, overlay) e dos endpoints de persistência.

## Vaga de destino

Durante o arraste o card ativo sai do fluxo (`.kanban-card--dragging») e a vaga entra
na **coluna e no índice** que a prévia resolver, com a altura que o card tinha no início
do arraste. A vaga é decorativa: não é clicável, não é focável, não altera a contagem da
coluna e não é persistida.

A vaga pertence à **instância** da coluna na lane, identificada pelo alvo prefixado
(`${laneId}:col:${column.id}`) — defeito corrigido pelo card **B14**
(`16e7e792-4a15-46b5-9311-0a3dbf8b297e`): em quadro hierárquico o mesmo id de coluna se repete em
todas as lanes, e comparar só a coluna desenharia uma vaga em cada lane — o que ainda
mudava a altura do conteúdo e mexia na rolagem. O assentamento também mede a vaga **da
lane de destino**, nunca a primeira do documento.

O card continua montado no DOM porque o dnd-kit mede o nó ativo na soltura; o overlay
que segue o ponteiro é quem representa o card durante o arraste. O nó ativo fica em
`position: fixed` com 1×1 px no canto: o `useDropAnimation` do dnd-kit chama
`scrollIntoViewIfNeeded` nesse nó antes de assentar e, se o retângulo estivesse fora da
viewport, ele rolaria a tela na soltura.

## Prévia do destino

`resolveDragPreview(ponteiro, cardArrastado, colunas)` responde três perguntas:

1. **Qual coluna** — o retângulo de coluna que contém o ponteiro (as bordas contam
   como dentro). Fora de todas as colunas, não há destino nem vaga.
2. **Qual índice** — depois de todos os cards cujo meio está acima do ponteiro,
   considerando os cards reposicionados como se o card arrastado já tivesse saído do
   fluxo.
3. **Qual âncora** — o card que fica logo depois da vaga, usado para persistir a ordem.

A âncora é sempre o card que fica **depois** da vaga, e a ordem nova é montada
**inserindo** o card nesse ponto — a mesma regra para a mesma coluna e para outra
coluna. Quando a vaga é a última, a âncora é vazia e o marcador da coluna (`:drop:`)
manda inserir no fim. Ancorar no último card com `arrayMove` deixaria o card um slot
abaixo da vaga quando o arraste fosse para baixo (defeito B14).

## Deslizamento da reordenação

`useCardFlip` mede os cards do quadro a cada commit e anima, a partir de onde estavam,
os que mudaram de posição, com a curva e a duração de `CARD_REORDER_TRANSITION`. Uma
animação nova cancela a anterior **do mesmo card**, então cruzar pontos médios em
sequência continua de onde o card está, sem fila. Cards que não mudam de posição não
animam.

## Assentamento e reversão

Ao soltar, o card arrastado anima do ponteiro até o retângulo da vaga (aceite) ou até a
origem (reversão), e o wrapper do card volta a ficar reto e no tamanho natural no mesmo
intervalo, com a duração publicada em `--board-drop-duration`. A duração vem de
`dropDuration()`: aceite curto, reversão mais longa, zero com movimento reduzido.

O `dropAnimation` é uma função própria — ele não depende do retângulo do nó ativo
(que está fora do fluxo) e por isso assenta exatamente onde a vaga estava.

## Persistência da posição

A ordem enviada no `PATCH /items/reorder` é sobre os **cards móveis** da coluna (as
folhas), que é a população que o board recebe do `GET /items` — colunas com cards que
têm filhos entram nessa regra sem quebrar o movimento (defeito B17: o servidor exigia
também os pais, que o cliente não tem, e respondia 400 desfazendo o arraste).

A gravação das posições vale para os dois perfis de instalação: SIMPLE (SQLite) e
ADVANCED (PostgreSQL) usam a mesma semântica — índice na ordem enviada, apenas cards
não arquivados da coluna, tudo em uma transação. Um stub `NOT_IMPLEMENTED` no adapter
PostgreSQL fazia o endpoint responder 500 em ADVANCED e desfazer todo arraste vertical.

A posição escolhida na coluna de destino também é gravada. Na mesma coluna, o
`arrayMove` sobre a ordem persistida resolve. Entre colunas, o `PATCH /items/:id/move`
troca a coluna e, em seguida, `PATCH /items/reorder` fixa a ordem da coluna de destino
já com o card no índice da vaga (`destinationOrderWithInserted`). O rollback é
cirúrgico: devolve coluna, status e as posições afetadas sem apagar atualizações mais
recentes de outros itens.

## Representação no cliente

A movimentação é representada **no cliente** e confirmada pelo servidor por baixo dos
panos — a interface não depende de reler o banco para obedecer:

1. Ao soltar, o estado otimista já aplica coluna, status e posição (a ordem calculada
   pela vaga), então a tela redesenha no mesmo quadro da soltura.
2. O evento `CARD_MOVED` do servidor atualiza coluna e status (não toca a posição).
3. O evento do reorder (`CARD_UPDATED` com `reordered: true` e `itemIds`) traz a ordem
   completa e é **aplicado como posições** — sem refetch.
4. Só os eventos sem estado no payload (restauração de arquivo, "touch" em lote)
   pedem releitura do quadro.
5. **Leituras em voo são canceladas antes de aplicar o movimento**, e a barreira de
   ressincronização aguarda a releitura (`invalidateBoard` devolve a promise de
   `invalidateQueries`). Sem isso, uma leitura pedida *antes* da soltura — foco da
   janela, lacuna de eventos, barreira anterior — chega *depois* e devolve o card
   para a coluna antiga, deixando a tela dependente de um F5 (defeito B16).

Antes, o evento de reorder descartava o payload e disparava releitura (defeito B15) —
e a releitura podia ser processada pelo servidor antes do commit do reorder, chegando
depois para sobrescrever o estado aplicado (defeito B16). Os dois defeitos juntos
produziam o sintoma "o banco está certo, mas a tela só obedece depois de F5".

## Destino inválido

O quadro não marca colunas proibidas: qualquer coluna elegível aceita um card folha. A
validade é resolvida pela **posição do ponteiro** (`resolveDragTarget`), não pelo `over`
do dnd-kit. Sem destino sob o ponteiro:

- nenhuma coluna recebe o destaque de destino;
- nenhuma vaga é exibida;
- o quadro comunica que o movimento foi cancelado;
- ao soltar, o card reverte à origem com a animação de reversão.

A recusa do servidor continua coberta pelo rollback otimista, que restaura ordem e
posição e apresenta o motivo.

## Movimento reduzido

`prefersReducedMotion()` é lido uma vez por arraste e alimenta os dois consumidores de
animação: o FLIP dos cards e a duração do assentamento. Com a preferência ativa, a
reordenação não desliza e o overlay não anima; a vaga e o estado final aparecem
imediatamente.

## Verificação

- `bun test apps/web/src/features/board/drag-animation.test.ts` — destino sob o
  ponteiro (inclusive nas bordas), durações, curva e keyframes do assentamento.
- `bun test apps/web/src/features/board/drag-preview.test.ts` — índice, âncora e ordem
  da vaga, incluindo a mesma coluna, coluna vazia e ausência de destino.
- `bun test apps/web/src/features/board/board-drag-animation.test.tsx` — estado do
  arraste do repouso à soltura, pelo contexto do quadro.
- `bun test apps/web/src/features/board/components/board-column-drop-target.test.tsx` —
  destaque da coluna, vaga no índice certo e card fora do fluxo.
- `bun test apps/web/src/features/board/board-interaction.test.ts` — ordem do destino
  com o card inserido, `move` + `reorder` e rollback cirúrgico.
- `E2E_API_PORT=3101 E2E_WEB_PORT=5273 bun run e2e/drag-animation.ts` — medição no
  board em execução (vaga, deslizamento por quadro de animação, assentamento, rejeição,
  movimento reduzido, lanes e densidade compacta).
- `bun run test:e2e` — jornadas que arrastam pela alça `[title="Arrastar card"] svg`.
