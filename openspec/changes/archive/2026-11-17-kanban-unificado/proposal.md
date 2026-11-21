# Proposal

## Why

Hoje o Board oferece **Board** (Kanban em lanes por módulo, épico e história) e **Árvore**.
No Kanban, cada lane repete a sequência completa de colunas e mostra apenas os cards
daquele agrupamento. Para responder "o que está em andamento no projeto?" a pessoa precisa
rolar e comparar vários quadros, e a mesma coluna aparece dezenas de vezes com contagens
parciais.

A base de dados já trata a coluna como uma fila única por projeto: `PATCH /items/reorder`
monta a ordem de **todos** os cards da coluna, independentemente da lane. É a apresentação
que fragmenta essa fila.

## What Changes

- Adicionar uma **terceira visualização** no seletor do board: `Board`, `Unificado` e
  `Árvore`. O Kanban existente **não é substituído**: `Board` continua exatamente como é
  hoje, com lanes por módulo, épico e história, abas, expandir/recolher e ocultações.
- `Unificado` mostra uma única faixa de colunas com todos os cards do recorte, sem
  cabeçalhos de módulo, épico ou história.
- Aplicar ao `Unificado` os mesmos filtros de população do board (módulo, sprint,
  responsável, autor, centro de custo, versão, prioridade, status, tipo, tags, squad,
  alterados e subtasks), de modo que a pessoa recorte o quadro conforme a necessidade.
- Preservar o contexto de origem no breadcrumb do próprio card (épico → história), que já
  existe no card do Kanban.
- Manter `Opções` e `Criar` disponíveis no `Unificado`; os controles que só fazem sentido em
  lanes (abas de módulo, expandir/recolher, ocultar épicos/histórias vazias) não aparecem.
- **Adicionar card** no `Unificado` abre a criação contextual da coluna na modal de item,
  já que não existe lane de história para herdar como pai.
- Arraste, ordenação, contagem por coluna, caminho crítico, densidade e filtros continuam
  valendo no `Unificado`.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `board-visual-presentation`: o seletor do board passa a ter três visualizações, com o
  Kanban unificado ao lado do Kanban em lanes e da árvore.

## Impact

- Frontend: `BoardScreen`, novo `UnifiedBoard`, `BoardColumns`, `BoardCommandBar` e i18n
  (pt-BR, en, es). O estado de filtros não muda.
- Sem mudança de API, schema, MCP ou Shadow Markdown: o layout é apresentação e reusa os
  endpoints existentes de movimento e reordenação.
- Ordenação: `sortBoardItemsByPosition` ganha desempate determinístico por código e título,
  porque posições de histórias diferentes passam a coincidir na mesma coluna.

## Assumptions

- `Board` continua sendo a visualização inicial; a pessoa escolhe `Unificado` quando quer
  o recorte único. A escolha da visualização segue o comportamento atual (estado da aba),
  sem nova preferência durável por projeto.
- O recorte do `Unificado` é exatamente `allDisplayed` (cards visíveis + histórias como
  cards quando ativado), a mesma população do cabeçalho e das contagens.
- Card sem coluna (história virtual ou item recém-criado) aparece na primeira coluna do
  fluxo em vez de sumir do quadro.
- O assistente continua entendendo o `Unificado` como modo Kanban; o contrato
  `AssistantViewCommand` não ganha um terceiro modo nesta mudança.
- A criação inline por coluna deixa de existir apenas no `Unificado`; a captura rápida
  continua pela modal contextual, que escolhe o pai.
