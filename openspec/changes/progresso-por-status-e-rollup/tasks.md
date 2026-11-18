# Tasks

## 1. Domínio

- [x] 1.1 Criar `createAdvanceResolver` com a regra por status, `countsForProgress` e `isProgressLeafType`.
- [x] 1.2 Fazer `itemsAdvance` usar o status e ignorar cancelados/arquivados; criar `aggregatedAdvance` para linhas agrupadas.
- [x] 1.3 Excluir cancelados/arquivados de `completionRatio`.

## 2. API

- [x] 2.1 Reescrever `addTreeProgress` com folhas de qualquer tipo, cancelado `null`, `EXTERNAL` `null` e contêiner da STORY fixa do modo SIMPLE.
- [x] 2.2 Dashboard (`/snapshot` e `/indicators`) e listagem de projetos usando `aggregatedAdvance`.
- [x] 2.3 Recorte de folhas com `STORY`/`EPIC` sem filhos e sem a STORY fixa do SIMPLE nos adapters SQLite e PostgreSQL; `isEligibleLeaf` alinhado.

## 3. Web

- [x] 3.1 `createCardAdvance` no board (card e preview de arraste) com status.
- [x] 3.2 Lanes e cabeçalho de sprint com status, cancelado fora do avanço e do total.
- [x] 3.3 Board calcula cabeçalho, módulos e lanes sobre a população de progresso (`selectProgressPopulation`: Leaf Rule, histórias e épicos sem filhos, mesmos filtros), sem mudar os cards exibidos.
- [x] 3.4 Textos do dashboard (escopo ativo e dica de avanço) em pt-BR, en e es.

## 4. Testes e validação

- [x] 4.1 Testes de domínio da regra por status (T189, concluído no Backlog, bloqueado, fallback, cancelado, agregados).
- [x] 4.2 Testes da árvore (cancelado, Story/Epic sem filhos, EXTERNAL, SIMPLE, média ponderada, pontos).
- [x] 4.3 Teste de API com status × coluna desencontrados: listagem, dashboard e árvore com o mesmo valor.
- [x] 4.4 Testes de componente do card e das lanes.
- [x] 4.5 Validação local com a cópia do projeto real no perfil ADVANCED: 289 nós da árvore iguais ao cálculo independente; projeto em 69% na árvore, no dashboard e na listagem; no navegador, cabeçalho do board 155 de 241 · 69% e 34 lanes iguais à árvore.
- [x] 4.6 `bun run typecheck`, `bun run lint`, `bun run check:persistence`, `bun run check:api-boundary`, `bun run build`, `bun run check:docs` e `bun run openspec:validate`.
