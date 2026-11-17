# Proposal

## Why

Em produção, o card **T230 — "ajustes autenticação Violeta para PRD"** (projeto
NT-VIVO-IAjuda Campo) está com `status = IN_PROGRESS`, mas continua na coluna **Backlog**
do Kanban. A grade e o modal mostram "Em andamento"; o board mostra o card no backlog.

A causa: `PATCH /items/:id` aceita `status` e `columnId` independentes. A grade da árvore,
o seletor de status da modal e as ferramentas MCP enviam apenas `status`; o `columnId`
permanece o antigo, e o board — que posiciona o card pela coluna — exibe a etapa errada.

## What Changes

- Ao atualizar o `status` de um item móvel sem informar `columnId`, o servidor passa a
  posicionar o card na primeira coluna cujo `baseStatus` corresponde ao novo status.
- Ao atualizar `columnId`, o `status` passa a assumir o `baseStatus` da coluna.
- Quando os dois campos vêm juntos, a coluna manda no status base.
- Status sem coluna correspondente (`PLANNED`, `BLOCKED`, `CANCELLED`) não reposicionam o
  card; o comportamento anterior permanece.
- Itens que não são cards móveis (`EPIC`) não têm coluna alterada por edição de status.
- Coberto por teste de regressão na API, com o cenário do card em backlog e status em
  andamento.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `card-management`: atualização de status e coluna mantém os dois campos coerentes em
  qualquer caminho de edição (modal, grade da árvore, REST e MCP).

## Impact

- API: `updateItemApplication` reconcilia status/coluna antes de aplicar o patch.
- Sem migração de schema e sem mudança de contrato (o response continua com `status` e
  `columnId`).
- Dados existentes divergentes não são corrigidos automaticamente; o card afetado será
  movido para a coluna correta e os próximos ajustes já mantêm a coerência.
