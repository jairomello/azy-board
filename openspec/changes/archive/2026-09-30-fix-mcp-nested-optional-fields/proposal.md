## Why

O schema exposto pelo servidor MCP exige campos opcionais dentro de objetos e arrays
aninhados — `update_items.filters` declara os 13 campos em `required`, e o mesmo vale
para os itens de `changes` e para `update_checklist_item.changes`. Na sessão de
2026-09-25, uma operação simples (`matchAll: true` + `sprint`) obrigou o cliente a
enviar 12 `null` explícitos, contrariando a própria documentação da skill
("filtros e campos opcionais podem ser omitidos"). É a continuação do mesmo bug de
contrato já corrigido apenas para campos de topo ("MCP: schema marca campos opcionais
como required" e "MCP: validador rejeita null em campos opcionais").

Board ref: 1720fa01-3650-44f0-96e9-cc2897195b8f

## What Changes

- `withOptionalFields` passa a ser recursivo: em qualquer objeto/array do
  `inputSchema`, o `required` exposto ao cliente MCP passa a conter apenas os campos
  realmente obrigatórios daquele nó, eliminando a exigência artificial herdada do
  modo estrito do OpenAI no registry interno.
- Os nós aninhados passam a declarar a obrigatoriedade real por nó no catálogo
  (`packages/tool-registry`), em vez de derivá-la implicitamente de "todos os campos".
- Null em campo opcional continua aceito como "não informado", em qualquer nível de
  profundidade — sem regredir as correções anteriores de topo.
- Os testes de contrato (`optional-fields.test.ts`, `registry-contract.test.ts`)
  passam a percorrer o schema inteiro e reprovar qualquer campo opcional presente em
  `required`, seja no topo ou aninhado.
- Mensagens de erro de validação passam a citar a forma mínima aceita quando a
  falha envolve objeto/array aninhado (ex.: `filters` sem `matchAll` nem filtro).

**Fora de escopo:** mudar a semântica dos filtros, renomear campos ou alterar os
enums de `changes` em `update_checklist`/`update_item_log`.

## Capabilities

### New Capabilities

_(nenhuma)_

### Modified Capabilities

- `mcp-tool-registry`: o requisito "Schema e validação derivados" passa a cobrir a
  obrigatoriedade real em nós aninhados (objects/arrays) e não apenas campos de topo,
  mantendo o cenário "Campo opcional omitido é aceito" válido em qualquer profundidade.
- `mcp-server`: o requisito "Paridade schema-validator-executor" ganha cenários para
  nós aninhados (`filters`, `changes`, `operations[].args`), e o contrato de erro de
  validação passa a exigir mensagem citando a forma mínima aceita.

## Impact

- `packages/tool-registry/src/registry.ts` — `itemFiltersSchema`, `itemChangeSchema`,
  `checklistItemChangeSchema`, ramo `operations` de `schemaFor`.
- `packages/tool-registry/src/fields.ts` — declaração de obrigatoriedade por nó.
- `packages/tool-registry/src/validation.ts` — mensagens de erro com forma mínima.
- `apps/mcp/src/index.ts` — `withOptionalFields` / `withOptionalOperationArgs`
  (generalização recursiva).
- `apps/mcp/src/optional-fields.test.ts`, `packages/tool-registry/src/registry-contract.test.ts`
  — testes de contrato estendidos.
- Sem mudança de API HTTP, banco, frontend ou contratos de runtime; afeta apenas o
  JSON Schema publicado em `tools/list` e as mensagens de erro de validação.
