# Proposal

## Why

O card tem **uma única barra de progresso**, cujo percentual mistura status, coluna,
peso manual da coluna e posição do checklist dentro da faixa. Com isso, o progresso
do trabalho e o andamento do checklist ficam no mesmo indicador, e um card com subtasks
não mostra de forma alguma como as subtarefas estão — o número de filhos no rodapé é
apenas uma contagem.

O usuário precisa ler três dimensões diferentes no card sem confundi-las: o progresso
do item, o progresso do checklist (que pode ter vários checklists e é agregado)
e o avanço médio das subtasks. A barra principal deixa de considerar o checklist; as duas
dimensões adicionais ganham barras próprias, com estilos e cores distintos.

## What Changes

- A barra principal do card passa a refletir **somente** status, coluna e peso explícito da
  coluna (ajuste manual) — o checklist deixa de refinar o percentual em cards, lanes,
  árvore, dashboard e listagem de projetos.
- **Nova barra de checklist**: aparece apenas quando o card tem ao menos um checklist com
  itens; mostra `marcados/total` agregado de todos os checklists, com cor e estilo próprios,
  ao lado do indicador `12/20` existente.
- **Nova barra de subtasks**: aparece apenas quando o card tem filhos; mostra a média de
  avanço das subtasks diretas (status + coluna), com outro estilo e cor.
- O card pode exibir até **três barras**, nesta ordem: progresso, checklist e subtasks.
- As barras secundárias são somente leitura, têm nomes acessíveis distintos e não
  substituem contadores, etiquetas ou o rodapé.
- Mockup SVG do card com as três barras em `mockups/card-progresso-tres-barras.svg`.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `progresso-por-coluna`: o avanço deixa de ser refinado pelo checklist; passa a ser
  definido apenas por status, coluna e peso explícito.
- `tree-progress`: a folha da árvore usa o avanço por status/coluna, sem checklist.
- `kanban-card-layout`: a região de progresso passa a comportar até três barras distintas
  (progresso, checklist e subtasks), com regras de exibição, estilo e acessibilidade.

## Impact

- Domínio (`packages/domain/src/progress.ts`): `computeAdvance`/`createAdvanceResolver`
  deixam de aplicar o checklist.
- API: o progresso da árvore deixa de considerar checklist; `checklistProgress` continua
  no payload dos itens para alimentar a barra de checklist.
- Web: `KanbanCard` ganha as duas barras secundárias; o board calcula o avanço médio das
  subtasks a partir dos filhos já carregados; `ProgressBar`/CSS ganham variantes visuais.
- Backend, banco, contratos REST e MCP não mudam de forma incompatível. Nenhuma migração.
- Testes de progresso (domínio, board, árvore, dashboard) precisam ser ajustados porque
  o checklist não afina mais o percentual.
