# Proposal

Board ref: B19 — Percentual de conclusão não conta itens cancelados/resolvidos (`67f32514-166c-48b2-b442-d8dfc202657f`)

## Why

O avanço de cada card vinha apenas da **coluna** em que ele está; o status era ignorado. No projeto real (NT-VIVO-IAjuda Campo), 56 folhas têm status diferente da coluna: 29 concluídas paradas no Backlog ou em "A Fazer" valiam 0%, e o card T189 ("Criar documentação completa das entregas já realizadas"), em homologação na coluna Backlog, valia 0% em vez de 90%. Cancelados entravam como 0% no denominador da árvore, das lanes e do card, mas o dashboard os excluía, então as telas divergiam. Stories e épicos sem filhos ficavam fora do cálculo. O projeto aparecia com 47% quando o registro indica 69%.

## What Changes

- O **status** define a faixa de avanço e a coluna só refina dentro dela: `DONE` = 100 em qualquer coluna; `NOT_STARTED`/`PLANNED` = 0; `IN_PROGRESS`/`IN_HOMOLOGATION` usam a própria coluna quando compatível, senão a primeira coluna do status (ou 50/90); `BLOCKED` fica onde parou no fluxo e vale 0 fora dele.
- `CANCELLED` e `ARCHIVED` ficam fora do avanço e da conclusão (nem numerador nem denominador) em todas as telas.
- Folha de progresso passa a ser qualquer `TASK`, `BUG`, `STORY` ou `EPIC` sem filhos; `EXTERNAL` continua à parte; a STORY fixa do modo `SIMPLE` é sempre contêiner.
- O agrupador continua sendo a média de todas as folhas válidas abaixo dele, o que equivale à média das filhas **ponderada pelo número de itens** (decisão registrada: a média simples das filhas foi descartada por dar o mesmo peso a 8 e a 226 itens).
- Uma única função de domínio (`createAdvanceResolver`, `itemsAdvance`, `aggregatedAdvance`) passa a ser usada pela árvore, lanes, card, cabeçalho de sprint, dashboard (`/snapshot` e `/indicators`) e listagem de projetos; o cálculo próprio do dashboard e da listagem sai.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `progresso-por-coluna`: o status define a faixa de avanço; cancelado fica fora; folhas de qualquer tipo; mesma regra em todas as telas.
- `tree-progress`: folhas por status, cancelado com "—", Story/Epic sem filhos contam, `EXTERNAL` sem percentual.
- `project-management`: a listagem de projetos usa a regra por status e a nova população de folhas.
- `project-dashboard`: população de progresso, conclusão, SPI e burnup inclui Story/Epic sem filhos; avanço pela regra por status.

## Impact

- Domínio: `packages/domain/src/progress.ts`.
- API: `services/treeProgress.ts`, `routes/items.ts`, `routes/dashboard.ts`, `routes/projects.ts`; recorte de folhas em `db/sqlite/adapter.ts` e `db/postgres/adapter.ts` (`dashboardLeafWhere`/`dashboardLeafConditions` e `listProjectProgress`).
- Web: `features/board/model/cardAdvance.ts`, `BoardColumns`, `BoardLanes`, `BoardScreen`.
- Sem migração de schema e sem alteração de dados. A correção dos 56 cards com status e coluna desencontrados no projeto real é uma ação de dados separada, que depende de aprovação.

## Assumptions

- Pontos continuam zerados no projeto real, então o percentual mede quantidade de itens e não esforço.
- A fase Backlog continua dentro do percentual do projeto.
