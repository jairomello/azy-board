## Why

Sessão de 2026-10-02: chamadas MCP legítimas falharam ou produziram resultado enganoso por dois gaps de contrato na fronteira de argumentos:

1. **Tipos entregues como string**: o harness entregou `limit: "100"` e `fields: '["id","title","status"]'` como strings — o validador rejeitou chamadas válidas (`limit deve ser um inteiro...`, `fields deve ser uma lista...`). Pior: booleanos como string passam silenciosamente com semântica invertida (`onlyLeaves: "false"` é truthy em JS).
2. **Parâmetros desconhecidos ignorados silenciosamente**: `titleContains` e `itemIds` enviados para `list_tasks` (que não os suporta) foram aceitos e ignorados — a ferramenta retornou TODOS os itens como se tivesse filtrado, induzindo o agente a erro.

O objetivo é a ferramenta funcionar de primeira: coerção guiada pelo schema para tipos escalares/JSON e rejeição acionável de campos desconhecidos.

## What Changes

- **Coerção de argumentos guiada pelo schema** (nova função pura no tool-registry, aplicada antes da validação em todos os caminhos — MCP, Azy Agent e evals):
  - string numérica → `number` quando o schema declara number
  - `"true"`/`"false"` → `boolean` quando o schema declara boolean
  - string que é JSON de array/objeto → parseada quando o schema declara array/object (falha de parse preserva o valor para o validador gerar erro acionável)
  - recursiva: propriedades de objetos aninhados e entradas de arrays (ex.: `check_items.items[].position`, `batch.operations[].args.points`, `update_items.filters.onlyLeaves`)
  - idempotente: valores já corretos não mudam; strings de texto/data/ID nunca são tocadas
- **Rejeição de argumentos desconhecidos** na validação: campo de topo fora de `toolFields[name].fields` → erro acionável citando os campos aceitos (exceto allowlist interna `atomic`, `idempotencyKey`, `agentRunId` usada pelo harness/executor)
- **Harness do Azy Agent**: coerção aplicada antes da pré-validação e persistida com os args do tool call (aprovação e execução usam o mesmo valor)
- **Erros**: `details.path` aponta o campo desconhecido; mensagem lista campos aceitos
- **Skill/docs**: documentar coerção e rejeição (skills/azyboard + espelho .opencode; README do MCP se aplicável)

## Capabilities

### New Capabilities

_(nenhuma — comportamento pertence à capability existente `mcp-tool-registry`)_

### Modified Capabilities

- `mcp-tool-registry`: requisitos ADDED de coerção de tipos guiada pelo schema e rejeição de argumentos desconhecidos (requisitos existentes de schema/validação não mudam)

## Impact

- **packages/tool-registry**: nova `coerceArgumentsBySchema` (deriva tipos do schema do catálogo); `validateToolArguments` rejeita campos de topo desconhecidos com allowlist interna
- **apps/mcp**: `executeSharedTool` aplica coerção entre `pruneNullArguments` e `validateToolArguments`; `validationDetails` (index.ts) extrai caminho do erro de campo desconhecido
- **apps/api**: `assistantHarness.ts` — coerção antes da pré-validação (linha ~253) e args persistidos coeridos; sem mudança de rotas
- **Skills**: `skills/azyboard/SKILL.md` + espelho `.opencode` (seção de erros comuns)
- **Testes**: unitários de coerção, rejeição de desconhecidos, integração `executeSharedTool` (limit/onlyLeaves/fields como string), regressão do batch interno com `atomic: true`
- **Risco controlado**: allowlist interna protege injeções do harness (`atomic`); coerção é no-op para tipos corretos
- **Board ref**: B3 — MCP: coerção de tipos e rejeição de campos desconhecidos nos argumentos (`2f4cbbc6-70a8-477f-8d8e-b4e116041611`)