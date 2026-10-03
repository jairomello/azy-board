## 1. Fonte única da numeração

- [x] 1.1 Criar `apps/api/src/utils/sequenceCode.ts` com prefixos E/S/T/B, padrão `[ESTB]\d+` e `nextSequenceCode(codes, type)`.
- [x] 1.2 Refatorar `apps/api/src/routes/items.ts` para usar o helper (sem mudar comportamento da rota REST).

## 2. Numeração no lote (SIMPLE)

- [x] 2.1 `createBatchItemInsideTransaction`: gerar `sequence_code` pelo próximo livre do tipo, considerando itens existentes e as operações anteriores do lote.
- [x] 2.2 Adicionar `sequenceCode` a `BatchItemCreateResult` e retorná-lo em cada resultado.

## 3. Edição via MCP (update_item/update_items)

- [x] 3.1 `packages/tool-registry`: incluir `sequenceCode` no enum/allowlist/clearable e validar formato no SET.
- [x] 3.2 `apps/api/src/routes/batch.ts`: aceitar `sequenceCode`, validar formato e unicidade sobre o estado resultante (inclui intra-lote e itens não selecionados).

## 4. Testes

- [x] 4.1 Unit-of-work: lote numera por tipo, continua contagem e não duplica.
- [x] 4.2 Integração (API): batch cria com códigos e `update_items`/`update_item` alteram, rejeitam duplicado/formato e limpam.
- [x] 4.3 Contrato/validação MCP: `update_item`/`update_items` aceitam `sequenceCode` válido e rejeitam inválido antes da rede.

## 5. Skill e verificação

- [x] 5.1 Documentar em `skills/azyboard/` (+ espelho `.opencode` e cópia `.agents`) que cards de lote já vêm numerados e como ajustar via `update_item`.
- [x] 5.2 Rodar `bun run check`, `bun run test:smoke` e `bun run test:agent-skill`.

Board ref: d2e0a8fe-a60b-4ede-bc76-f65cd6e963af
