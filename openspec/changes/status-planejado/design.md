# Design

## Decisões

### `PLANNED` é um status base de coluna, não um campo novo

O status do card já é derivado do `baseStatus` da coluna em toda movimentação (`moveItem`). Criar um campo paralelo (`planned: boolean`) faria o dado divergir do Kanban e exigiria sincronização em cada caminho de escrita. Um valor novo no enum reaproveita a regra existente: mover o card para a coluna "Planejado" já grava `PLANNED`.

Alternativa descartada: usar a tag `planejado`. Não muda o status exibido no card, que é exatamente o problema.

### Peso de avanço

`PLANNED` não entra em `isFlowStatus` e cai na regra de `NOT_STARTED`: peso derivado 0. Isso mantém o burnup e o avanço do projeto iguais ao comportamento anterior; a diferença é só de leitura e filtro. Um peso explícito continua tendo precedência.

### Ordem do enum

`NOT_STARTED`, `PLANNED`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `CANCELLED` (+`ARCHIVED` no item). A ordem reflete a leitura do fluxo e é a ordem dos filtros e selects.

### Colunas aceitam os cinco status já documentados

A UI e a wiki já ofereciam `BLOCKED` e `CANCELLED` como status base, mas a API respondia `400` (`columnSchema` restringia a três). Este change alinha a validação ao domínio e à documentação, em vez de remover opções da UI.

### Troca do status base propaga aos cards sincronizados

Sem a propagação, migrar a coluna "A Fazer" de `NOT_STARTED` para `PLANNED` deixaria os cards existentes com o status antigo — exatamente o problema que o change resolve. A troca atualiza, na mesma transação, os itens da coluna cujo status era igual ao status base anterior. Cards com status divergente (bloqueio explícito, por exemplo) são preservados: o usuário expressou um estado que a coluna não representa.

A propagação é um `UPDATE` em lote; ela marca `updated_at` (para a janela de última alteração) mas não grava um evento `STATUS_CHANGED` por card. O snapshot do dashboard lê os itens atuais e reflete a mudança; o histórico de burnup só a registra no próximo evento do projeto. Aceitável para uma operação administrativa rara, e documentado no PR.

### `release` acompanha a coluna

O SQLite voltava o status para `NOT_STARTED` e o PostgreSQL não mexia no status — comportamento divergente entre perfis. Com `PLANNED`, manter `NOT_STARTED` depois de liberar um card na coluna "Planejado" reintroduziria a inconsistência que o change resolve. Ambos passam a gravar o `baseStatus` da coluna atual; sem coluna, o SQLite volta a `NOT_STARTED` e o PostgreSQL preserva o status.

## Riscos

- **Relatórios externos** que comparam `status` com uma lista fixa passam a ver um valor novo. Mitigação: o valor é aditivo e os buckets padrão ganharam `PLANNED` nesta mesma entrega.
- **Agentes** que procuram apenas `NOT_STARTED` para pegar trabalho deixariam de encontrar cards em colunas migradas para `PLANNED`. Mitigação: skill e instrução de priorização do assistente passam a aceitar `PLANNED` (fora do `Backlog`).
- **PostgreSQL:** o CHECK precisa ser recriado; a migration roda em transação pelo runner, então uma falha não deixa o schema meio alterado.
