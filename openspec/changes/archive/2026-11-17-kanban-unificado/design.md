# Design

## Contexto

O Kanban hierárquico renderiza `BoardLanes`: módulo → épico → história, e cada lane monta
seu próprio `BoardColumns` com a sequência completa de colunas. O estado do arraste
(`measureDragAnimation`, `dropAnchor`, `preview.targetId`) já usa o prefixo `laneId` para
distinguir instâncias de coluna, e o handler de interação resolve o destino a partir do id.

A coluna, no domínio, é uma fila única do projeto: `destinationOrderWithInserted` lista
todos os itens com `columnId` igual, ordenados por `position`, e envia a ordem completa no
`PATCH /items/reorder`. O modelo de dados já é o do Kanban unificado; a fragmentação é só
de apresentação.

## Decisão 1 — visualização, não preferência de filtro

**Escolhido:** o unificado é um valor do estado de visualização da tela
(`BoardView = 'kanban' | 'unified' | 'tree'`), acionado pelo seletor da command bar.

**Por quê:** é uma terceira forma de ver o board, ao lado de `Board` e `Árvore`, e não um
recorte dentro do Kanban. Manter o estado fora de `BoardFilterState` garante que filtros,
`Limpar` e comandos da conversa não troquem a visualização, e que o Kanban em lanes
continue sendo exatamente o que é hoje.

**Alternativa descartada:** `kanbanLayout: 'lanes' | 'unified'` dentro dos filtros —
transformava o unificado em opção de exibição do próprio Kanban, escondia as lanes atrás de
`Opções` e arriscava trocar a visualização ao limpar filtros.

## Decisão 2 — componente próprio para a faixa única

**Escolhido:** `UnifiedBoard` compõe `BoardColumns` com `laneId="unified"`, cabeçalho com a
contagem do recorte e um estado vazio explicativo.

**Alternativas descartadas:**
- *Reusar `BoardLanes` com uma lane sintética:* carregaria `ModuleSwimlane`, accordions e
  cabeçalhos que o modo não usa, e o `laneId` vazio confundiria a vaga de destino.
- *Renderizar `BoardColumns` direto no `BoardScreen`:* a tela já é composition root e o
  componente novo mantém o contrato visual testável.

**Consequência:** o `DndContext`, o overlay e a prévia continuam no `BoardScreen`; o
`UnifiedBoard` só desenha. O `laneId="unified"` mantém os ids `unified:col:*`/`unified:drop:*`
que a detecção de colisão e o `getDropColumnId` já entendem.

## Decisão 3 — criação sem lane abre a modal contextual

**Escolhido:** `BoardColumns.onQuickAdd(columnId)`; no unificado o botão **Adicionar card**
chama `openCreationInColumn(columnId)`, que abre a modal de item com a coluna e o centro de
custo padrão preenchidos.

**Por quê:** em projeto `HIERARCHICAL` a API exige `parentId` para TASK/BUG. A criação
inline antiga herdava a história da lane; no unificado não existe essa lane. Abrir a modal
preserva a captura rápida e deixa a escolha do pai explícita.

**Alternativa descartada:** desabilitar criação no unificado — perderia o caminho mais usado
para registrar trabalho.

## Decisão 4 — ordem determinística entre histórias

`position` é por história, então duas histórias podem ter cards na posição 0 da mesma
coluna. O unificado as coloca lado a lado; `sortBoardItemsByPosition` passa a desempatar por
`sequenceCode` e depois por título. O primeiro arraste na coluna regrava as posições de
todos os cards dela, alinhando a fila única do domínio com o que a pessoa vê.

## Decisão 5 — contrato do assistente inalterado

O snapshot e os comandos de visão continuam com `mode: 'kanban' | 'tree'`. O `Unificado` é
publicado como `kanban`, porque a população de cards e as ações são as mesmas. Adicionar um
terceiro modo exigiria mudar `assistant-contracts`, a validação da API e a skill; fica fora
do escopo desta mudança.

## Riscos e limites

- Projetos `SIMPLE` também podem abrir o `Unificado`; como só têm uma história e uma faixa,
  o resultado é equivalente ao Board, sem regressão.
- O Shadow Markdown e os endpoints não mudam.
