Board ref: 1720fa01-3650-44f0-96e9-cc2897195b8f

## Context

O `inputSchema` publicado pelo servidor MCP é derivado de `getSharedToolDefinitions()`
(`packages/tool-registry/src/registry.ts`), que mantém **todos** os campos em `required`
com tipos anuláveis — exigência do modo estrito do OpenAI usado pelo Azy Agent
(`apps/api/src/services/assistantHarness.ts:110`, `strict: true`).

Para o cliente MCP essa obrigatoriedade artificial é removida por `withOptionalFields`
(`apps/mcp/src/index.ts:87`), que hoje cobre **apenas** o `required` de topo
(via `requiredFieldsFor`) e `operations[].args` (via `OPERATION_ARGS_REQUIRED`).
Todo o resto da árvore — `filters`, itens de `changes`, `update_checklist_item.changes` —
continua exigindo todos os campos.

Consequência observada na sessão de 2026-09-25: `update_items` com `matchAll: true` +
`sprint` exigiu 12 `null` explícitos em `filters`, contrariando a skill
("filtros e campos opcionais podem ser omitidos").

Ao mapear a árvore surgiu uma segunda falha no mesmo nó `changes`: `update_checklist` e
`update_item_log` declaram `changes` como **array** de `{field, operation, value}` com
enum de campos de **item** (title, priority, status, …), enquanto o validador
(`packages/tool-registry/src/validation.ts:97`) exige **objeto** e os executores esperam
campos próprios (`name`/`position` e `activity`/`durationMin`, cf.
`apps/api/src/validation.ts:145` e `:192`). Seguindo o schema declarado, essas duas
ferramentas são inutilizáveis.

Régua adotada: o schema zod da API (`apps/api/src/validation.ts`) é o que a API
realmente aceita e, portanto, define a obrigatoriedade real por nó.

## Goals / Non-Goals

**Goals:**

- `required` exposto ao cliente MCP reflita a obrigatoriedade real em **qualquer**
  profundidade do `inputSchema`, não só no topo.
- Obrigatoriedade real por nó declarada no catálogo (`packages/tool-registry`), junto
  do restante do descritor — sem tabela paralela.
- `update_checklist.changes` e `update_item_log.changes` passem a ter a shape correta,
  eliminando a divergência schema-validator-executor.
- Null em campo opcional continue aceito como "não informado", em qualquer nível,
  sem regredir as correções anteriores.
- Testes de contrato percorram a árvore inteira e reprovem campo opcional em `required`.
- Erros de validação de objeto/array aninhado citem a forma mínima aceita.

**Non-Goals:**

- Mudar a semântica dos filtros de `update_items` (regra de `matchAll` permanece).
- Renomear campos ou alterar os enums dos campos de item em `changes`.
- Alterar a API HTTP, o banco, o frontend ou os contratos de runtime.
- Tornar o schema estrito do OpenAI mais permissivo.

## Decisions

### D1. Duas visões derivadas do mesmo descritor

`getSharedToolDefinitions()` **não muda**: continua entregando o schema estrito
(todos os campos em `required`, tipos anuláveis) que o `strict: true` do OpenAI exige.

Uma função nova, `applyOptionalFields(inputSchema, toolName)` em
`@azy-board/tool-registry`, produz a visão exposta ao MCP a partir desse schema.
O servidor MCP passa a chamá-la no lugar de `withOptionalFields`/`withOptionalOperationArgs`.

_A alternativa considerada_ — gerar `required` real direto no descritor e expandir para
o modo estrito — foi rejeitada porque mudaria o contrato interno consumido pelo harness
e exigiria uma expansão por nó com risco de perder campo em `required` (erro que o
OpenAI rejeita em tempo de chamada, não em build).

### D2. Obrigatoriedade real por nó declarada em `toolFields[name].nested`

```ts
update_items: {
  fields: [...], required: ['projectId', 'filters', 'changes'],
  nested: { filters: [], changes: [], 'changes[]': ['field', 'operation'] },
}
```

A chave é o caminho estrutural do nó a partir da raiz (`filters`, `changes`,
`changes[]`, `operations[].args`). `changes` (objeto) e `changes[]` (itens de array)
coexistem porque `update_checklist_item` usa objeto e `update_item` usa array — a
distinção é natural e não exige marcador extra no JSON publicado.

_Os valores são os do zod da API_: `itemFiltersSchema` tem tudo `.optional()` → `[]`;
`itemChangeSchema` exige `field` e `operation` → `['field', 'operation']`;
`updateChecklistItemSchema`, `updateChecklistSchema` e `updateItemLogSchema` são
totalmente opcionais → `[]`.

### D3. `applyOptionalFields` é recursivo e conservador

Percorre `properties` e `items`, acumula o caminho e, quando existe declaração `nested`
para aquele caminho, troca o `required` do nó pela lista real. Nós sem declaração são
mantidos como estão (ex.: `operations[]` já declara `['tool', 'args']` corretamente).
`operations[].args` passa a vir da mesma fonte (`OPERATION_ARGS_REQUIRED`), eliminando
o `withOptionalOperationArgs` especial-caso.

Se um caminho declarado em `nested` não existir no schema, o teste de contrato falha —
protege contra refatoração silenciosa da árvore.

### D4. Null continua tratado como omitido **sem** tornar o prune recursivo

`pruneNullArguments` (topo) e `pruneNullValues` (`update_checklist_item.changes`)
permanecem como estão. O restante da árvore não precisa de prune porque a API já aceita
null aninhado (`.nullable()` no zod).

Tornar o prune recursivo seria **incorreto**: em `batch.operations[].args`,
`parentRef: null` é semanticamente significativo ("item raiz") e seria apagado.
O requisito de não-regressão é coberto por teste, não por mais transformação.

### D5. Shapes corretas para `update_checklist.changes` e `update_item_log.changes`

Dois nós novos no catálogo, selecionados por ferramenta em `getSharedToolDefinitions`
(igual já acontece com `checklistItemChangeSchema`):

- `checklistChangeSchema` — objeto `{ name?: string, position?: number }`.
- `itemLogChangeSchema` — objeto `{ activity?: string, durationMin?: number }`.

O validador ganha ramos próprios para as duas ferramentas, rejeitando chaves desconhecidas
(como já faz `update_checklist_item`), fechando a divergência schema-validator-executor.

Hoje é impossível usar essas ferramentas seguindo o schema (o validador rejeita array),
então nenhum cliente funcional quebra: quem já funciona já envia objeto.

### D6. Erro de validação cita a forma mínima

`validateToolArguments` passa a compor as mensagens dos nós aninhados com a forma mínima
aceita, ex.:

- `Informe filtros ou confirme matchAll (forma mínima: { "matchAll": true } ou { "sprint": "CURRENT" })`
- `changes[].field e changes[].operation são obrigatórios (forma mínima: [{ "field": "title", "operation": "SET", "value": "..." }])`

Isso alimenta direto o envelope de erro normalizado já exigido pelo spec `mcp-server`.

## Risks / Trade-offs

- **[Perder a obrigatoriedade total em `required` do modo estrito]** → `getSharedToolDefinitions`
  não é alterado; teste assegura que a visão estrita continua com todos os campos em
  `required` enquanto a exposta usa a lista real.
- **[`nested` divergir do zod da API]** → teste de paridade por ferramenta: para cada uma,
  monta a "forma mínima" (omitindo todo opcional) e afirma que `validateToolArguments`
  aceita e que o schema exposto marca exatamente aqueles campos como obrigatórios.
- **[Quebrar clientes que já chamam `update_checklist`/`update_item_log`]** → o validador
  atual rejeita array, então quem funciona já envia objeto; registrar a correção no
  `CHANGELOG.md`.
- **[Caminho estrutural frágil a refatoração da árvore]** → teste de contrato falha quando
  um caminho declarado não é encontrado no schema.
- **[Revisitar `update_checklist.changes` amplia o escopo do card]** → decisão explícita
  do usuário (2026-09-26): corrigir, porque a ferramenta está inutilizável e o spec
  `mcp-server` já exige paridade schema-validator-executor.

## Migration Plan

Sem migração de dados nem mudança de API. Deploy padrão; rollback é reverter o commit.

1. Declarar `nested` e as shapes novas no catálogo.
2. Trocar `withOptionalFields`/`withOptionalOperationArgs` por `applyOptionalFields`.
3. Alinhar `validation.ts` (ramos próprios + mensagens com forma mínima).
4. Estender os testes de contrato e rodar `bun run check` + `bun run test:smoke`.

## Open Questions

_(nenhuma — escopo e régua definidos com o usuário em 2026-09-26)_
