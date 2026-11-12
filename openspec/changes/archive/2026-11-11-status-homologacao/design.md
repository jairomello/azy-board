# Design

## Decisões

### `IN_HOMOLOGATION` é um status base de coluna, não um campo novo

O status do card já é derivado do `baseStatus` da coluna em toda movimentação (`moveItem`). Um campo paralelo (`awaitingAcceptance: boolean`) faria o dado divergir do Kanban e exigiria sincronização em cada caminho de escrita. Um valor novo no enum reaproveita a regra existente: mover o card para a coluna "Em Homologação" já grava `IN_HOMOLOGATION`.

Alternativa descartada: usar tag `homologacao`. Não muda o status exibido nem entra nos filtros de status, que é exatamente o problema.

### Peso de avanço: faixa do fluxo

`IN_HOMOLOGATION` entra em `isFlowStatus`, junto de `IN_PROGRESS` e `BLOCKED`. A alternativa (peso fixo 0, como `PLANNED`) faria o avanço do projeto cair quando o card entra em homologação — o oposto do que ela significa. A alternativa de uma faixa própria (91–99) exigiria uma regra nova de derivação para um único valor e quebraria o teto `FLOW_WEIGHT_TOP = 90`, que existe para garantir que só `DONE` valha 100.

Consequência: a coluna de homologação é a última do fluxo e vale o teto da faixa (90). Se o projeto quiser um peso diferente, o override explícito por coluna continua valendo.

### Ordem do enum

`NOT_STARTED`, `PLANNED`, `IN_PROGRESS`, `IN_HOMOLOGATION`, `BLOCKED`, `DONE`, `CANCELLED` (+`ARCHIVED` no item). A ordem reflete a leitura do fluxo e é a ordem dos filtros e selects. `BLOCKED` fica depois porque é um estado de exceção, não uma etapa.

### Sem coluna com esse status base, o status não pode ser atribuído em lote

A edição em massa (`update_items`) resolve o status para a primeira coluna cujo `baseStatus` corresponda e responde `COLUMN_FOR_STATUS_NOT_FOUND` quando não existe. Esse comportamento é intencional e não muda: status e coluna precisam ser coerentes. A mitigação é de produto e está na documentação — para usar homologação, o admin cria (ou converte) uma coluna com `baseStatus = IN_HOMOLOGATION`. A edição individual de um card continua aceitando o status explícito, porque ela não move o card.

### Shadow Markdown

O ícone do board markdown passa a tratar homologação como `[/]` (em andamento), e não `[ ]`. Sem isso, um card pronto para aceite apareceria como não iniciado para agentes que leem o board.

### Não criar a coluna automaticamente

Não há migração de dados criando colunas nos boards existentes: a posição da coluna no fluxo é decisão de cada projeto e a criação silenciosa mudaria o Kanban de quem já o organizou. O PR entrega o status; o board é ajustado pelo admin (criar a coluna já cria no fim do fluxo; `reorder_columns` posiciona).

## Riscos

- **Relatórios externos** que comparam `status` com uma lista fixa passam a ver um valor novo. Mitigação: o valor é aditivo e os buckets padrão ganharam `IN_HOMOLOGATION` nesta mesma entrega.
- **Dashboard**: a chave `IN_HOMOLOGATION` passa a aparecer em `boxes.wip.byStatus` mesmo com contagem zero. É consistente com a forma como `IN_PROGRESS`/`BLOCKED` já aparecem, mas é uma mudança de contrato aditiva — um consumidor que compare chaves exatas precisa ser atualizado (o teste de contrato do dashboard foi atualizado junto).
- **PostgreSQL:** o CHECK precisa ser recriado; a migration roda em transação pelo runner, então uma falha não deixa o schema meio alterado.
