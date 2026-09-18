## 1. Diagnóstico e contrato

- [x] 1.1 Reproduzir o drop vertical do card B1 e documentar quais IDs `active` e `over` chegam ao handler em uma coluna com múltiplos cards.
- [x] 1.2 Revisar o fluxo atual de `useBoardInteraction`, `getDropColumnId` e os droppables de `BoardColumns`, preservando o endpoint e a Leaf Rule.

## 2. Correção do reorder

- [x] 2.1 Normalizar o alvo de drop para distinguir ID de card, marcador `:drop:`/`:col:` e drop em espaço vazio.
- [x] 2.2 Corrigir a montagem da ordem completa dos cards persistíveis da coluna e enviar `PATCH /projects/:id/items/reorder` com `columnId` e `order` corretos.
- [x] 2.3 Preservar a atualização otimista, rollback em erro e comportamento de movimentação entre colunas sem incluir cards virtuais.

## 3. Testes e integração

- [x] 3.1 Adicionar testes para reorder na mesma coluna, alvo por marcador, exclusão de cards virtuais e payload completo.
- [x] 3.2 Adicionar teste de falha do endpoint confirmando rollback da ordem e mensagem de erro.
- [x] 3.3 Executar `bun run check`, `bun run test:smoke` e validar que filtros, WebSocket, ordenação de colunas e movimentação entre colunas não regrediram.
- [x] 3.4 Garantir que a renderização das colunas ordene os cards pelo `position` atualizado após o reorder otimista e validar o fluxo no ambiente local.
