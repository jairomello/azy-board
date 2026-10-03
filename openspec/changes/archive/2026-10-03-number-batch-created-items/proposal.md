## Why

Cards criados pelo fluxo em lote (`batch` e `create_project_structure`, o caminho mais usado por agentes) nascem com `sequence_code` nulo, enquanto os criados pela rota REST single-item recebem identificador amigável (T#, B#, S#, E#). Pior: `update_item`/`update_items` não expõem `sequenceCode`, então nem o agente consegue corrigir depois — a capacidade "Numerar cards automaticamente" simplesmente não cobre o fluxo de agentes.

## What Changes

- Gerar `sequence_code` na criação em lote, por tipo e projeto, de forma atômica dentro do lote (sem colisão com códigos existentes nem duplicação entre operações do mesmo lote).
- Expor `sequenceCode` em `changes` de `update_item` e `update_items`, com validação de formato `[ESTB]\d+` e unicidade por projeto, permitindo também limpar o campo.
- Incluir `sequenceCode` no resultado da criação em lote para o agente confirmar o código gerado.
- Documentar na skill oficial `azyboard` que cards criados por lote já vêm numerados e como ajustar o código.

## Capabilities

### New Capabilities
- Nenhuma.

### Modified Capabilities
- Nenhuma. O delta entra como requisito ADICIONADO em `item-sequence-code` (a numeração no lote e a edição pelo MCP são comportamentos novos, sem alterar o comportamento REST já especificado).

## Impact

- `apps/api/src/db/sqlite/itemUnitOfWork.ts` (numeração no lote), `apps/api/src/utils/sequenceCode.ts` (novo, fonte única do prefixo/próximo número), `apps/api/src/routes/items.ts` (reuso do helper), `apps/api/src/routes/batch.ts` (campo `sequenceCode` e unicidade no update em lote), `apps/api/src/persistence/ports.ts` (resultado do lote).
- `packages/tool-registry/src/{fields,validation,registry}.ts` (campo no catálogo MCP).
- `skills/azyboard/` (+ espelhos) e testes de API, MCP e unit-of-work.
- Perfil ADVANCED: `createItemsBatch` segue `NOT_IMPLEMENTED` (lacuna pré-existente de paridade, fora deste escopo) — a numeração nova vale para o perfil SIMPLE, onde o lote é implementado.

Board ref: d2e0a8fe-a60b-4ede-bc76-f65cd6e963af
