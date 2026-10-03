## Context

A numeração sequencial (`sequence_code`, prefixos E/S/T/B por projeto) existe desde a change `item-sequence-code`, mas só a rota `POST /projects/:projectId/items` calcula o próximo código (`nextSequenceCode` em `routes/items.ts`). O caminho em lote — `createBatchItemInsideTransaction` em `apps/api/src/db/sqlite/itemUnitOfWork.ts` — grava o literal `NULL`. As tools MCP `batch` e `create_project_structure` usam esse caminho, então todo card criado por agente fica sem número.

Além disso, `update_item`/`update_items` (que roteiam para `POST /projects/:projectId/batch/items/update`) não aceitam `sequenceCode` em `changes`; apenas o `PATCH` single-item da UI aceita. O índice único `idx_items_sequence_code (tenant_id, project_id, sequence_code)` já garante unicidade no banco.

## Goals / Non-Goals

**Goals:**
- Numeração automática por tipo na criação em lote, atômica e sem colisões.
- `sequenceCode` editável (SET/CLEAR) por `update_item` e `update_items`, com formato e unicidade validados.
- Expor o código gerado no resultado do lote.
- Fonte única para prefixo/próximo número, evitando duplicar a regra entre rota REST e persistência.

**Non-Goals:**
- Implementar `createItemsBatch` no adaptador PostgreSQL (paridade ADVANCED pendente, rastreada fora deste card).
- Permitir informar `sequenceCode` explicitamente nos `args` de criação em lote (o lote continua gerando automaticamente; o ajuste manual é feito por update).
- Renumerar cards existentes sem código.

## Decisions

- **Helper compartilhado `utils/sequenceCode.ts`:** extrair `SEQUENCE_PREFIX`, o padrão `[ESTB]\d+` e `nextSequenceCode(codes, type)` do `routes/items.ts`, reutilizando-os na persistência do lote. Evita duas implementações da mesma regra.
- **Cálculo por varredura dentro da transação:** no lote, o próximo número é derivado dos `sequence_code` já gravados para o prefixo no projeto, considerando as operações anteriores do próprio lote (elas já estão na transação). Isso mantém a atomicidade sem depender de contador separado.
- **`sequenceCode` no `BatchItemCreateResult`:** o resultado do lote passa a devolver o código gerado, para o agente confirmar sem re-listar.
- **Validação em duas camadas:** o catálogo MCP (`packages/tool-registry`) valida formato/clearance antes da rede; a rota `batch/items/update` revalida (allowlist, formato) e checa unicidade sobre o estado resultante do projeto (inclui itens não selecionados e duplicatas intra-lote).
- **CLEAR permitido:** `sequenceCode` é opcional (a spec aceita nulo); limpar é útil para correções e mantém paridade com o PATCH single-item.

Alternativas consideradas: contador persistido por projeto (mais estado e mais risco de drift); renumerar no read (não persiste identidade estável); bloquear o ajuste via MCP (mantém o agravante do card).

## Risks / Trade-offs

- [Custo de varredura por operação do lote] → lote é limitado a 50 operações e a consulta é por prefixo indexado (`sequence_code`); impacto desprezível comparado ao INSERT.
- [Colisão em concorrência] → o índice único no banco é a barreira final; a validação na rota cobre o caso comum e devolve erro acionável.
- [Divergência entre catálogo MCP e rota] → os testes de contrato (`tool-registry` + integração da rota) cobrem os dois lados.

## Open Questions

Nenhuma pendente. Decisões confirmadas: numeração por prefixo do tipo (E/S/T/B), próxima a partir do maior número existente; `sequenceCode` aceito em SET/CLEAR; ADVANCED fora do escopo (lote não implementado lá).
