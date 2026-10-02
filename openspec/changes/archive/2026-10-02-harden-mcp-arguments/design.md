## Context

O fluxo de argumentos hoje: cliente MCP → `CallToolRequestSchema` (index.ts injeta `projectId` default) → `executeSharedTool` (registry.ts:61) → `pruneNullArguments` → `validateToolArguments` → resolução de projeto → routing para `tool*`. O Azy Agent usa o mesmo `executeSharedTool`, mas o `assistantHarness` chama `validateToolArguments` diretamente (~linha 253) ANTES de persistir/aprovar o tool call, e injeta `atomic: true` em args de `batch` (~linha 423).

Incidentes reais (sessão 2026-10-02, harness opencode v1.18.34):
- `list_tasks` com `limit: "100"` (string) → rejeitado: "limit, quando informado, deve ser um inteiro entre 1 e 100"
- `list_tasks` com `fields: '["id","title","status"]'` (string JSON) → rejeitado: "fields deve ser uma lista..."
- `list_tasks` com `titleContains`/`itemIds` (campos inexistentes) → aceitos e ignorados; resposta completa enganou o agente
- Latente: `onlyLeaves: "false"` (string truthy) inverteria a semântica sem erro

O schema do catálogo (`getSharedToolDefinitions`/`schemaFor`) já declara o tipo de cada campo (`['number','null']`, `['boolean','null']`, `['array','null']` etc.) — a informação necessária para coerção já existe na fonte única.

## Goals / Non-Goals

**Goals:**
- Chamadas com escalares/JSON entregues como string funcionarem de primeira (coerção determinística guiada pelo schema)
- Campos desconhecidos falharem rápido com erro acionável (nunca mais resultado silenciosamente errado)
- Comportamento uniforme nos 3 consumidores do catálogo (MCP stdio, Azy Agent, evals)
- Zero mudança para clientes que já enviam tipos corretos (coerção idempotente)

**Non-Goals:**
- Corrigir a serialização do harness opencode (bug de terceiro, já reportado — issue #43311 e comentário complementar)
- Rejeição de campos desconhecidos em nós aninhados profundos (top-level + comportamento já existente de `changes`/`update_checklist*`); fica como evolução futura
- Coerção de datas/strings de domínio (texto permanece texto)
- Mudar schemas expostos ou políticas

## Decisions

### Decisão 1: Coerção como função pura no tool-registry, derivada do schema do catálogo

`coerceArgumentsBySchema(toolName, args)` em `packages/tool-registry` (novo módulo `coercion.ts`), usando o `inputSchema` interno de `getSharedToolDefinitions()` como fonte de tipos:

- `string` + schema type inclui `number` + valor casa `/^-?\d+(\.\d+)?$/` → `Number(valor)`
- `string` + schema type inclui `boolean` + valor trim/lowercase é `true`/`false` → booleano
- `string` + schema type inclui `array` ou `object` + valor trim começa com `[`/`{` → `JSON.parse`; se parse falhar, mantém a string original (o validador produz o erro acionável existente)
- Recursão: propriedades declaradas de objetos aninhados (`filters`, `changes`, `args`) e `items` de arrays (`check_items.items[]`, `operations[]`) usando o schema do nó
- Qualquer outro caso: valor intacto (idempotente)

**Alternativa rejeitada — coerção por ferramenta (mapa manual):** duplicaria o catálogo e divergiria (mesma doença das tabelas paralelas que o registry eliminou). O schema É a fonte.

**Alternativa rejeitada — validação que aceita strings (relaxar asserts):** espalharia `typeof x === 'string'` pelos executores e manteria o bug truthy de booleanos. Coerção na fronteira mantém o núcleo tipado.

### Decisão 2: Ponto de aplicação — `executeSharedTool` + pré-validação do harness

- `executeSharedTool`: `args = coerceArgumentsBySchema(name, pruneNullArguments(args))` antes de `validateToolArguments`. Cobre MCP e evals.
- `assistantHarness`: coergir antes do `validateToolArguments` da linha ~253 e persistir os args JÁ coeridos (preview de aprovação, hash de idempotência e execução usam o mesmo valor; evita aprovar um payload e executar outro).
- Coerção é idempotente → dupla aplicação (harness + executeSharedTool) é inofensiva.

### Decisão 3: Rejeição de campos desconhecidos no topo, com allowlist interna

Em `validateToolArguments`, após os obrigatórios: chaves de `args` fora de `toolFields[name].fields` E fora de `INTERNAL_ARG_ALLOWLIST = {'atomic','idempotencyKey','agentRunId'}` → `throw new Error(\`Campo desconhecido: ${key} em ${name}; campos aceitos: ${fields.join(', ')}\`)`.

- A allowlist protege injeções legítimas do harness/executor (`atomic` no batch via assistantHarness; `idempotencyKey`/`agentRunId` aceitos por `toolBatch` e cia.)
- `additionalProperties: false` já é declarado no schema — a validação agora honra o contrato na prática
- Nós aninhados: `update_checklist*`/`update_item_log` já rejeitam chaves inválidas em `changes`; `filters`/`changes[]`/`items[]`/`args` mantêm comportamento atual (non-goal)

### Decisão 4: Erro acionável alinhado ao contrato unificado

- Mensagem cita o campo e a lista de aceitos (recuperação óbvia para o agente)
- `validationDetails` (apps/mcp/src/index.ts) ganha extração de `Campo desconhecido: (\w+)` → `details.path = <campo>`; snippet mantém `JSON.stringify(args)`
- `retryable: false`, code `MCP_VALIDATION_ERROR` (comportamento existente)

### Decisão 5: Skill documenta o novo comportamento

Em "Payload, limites e erros comuns" (skills/azyboard + espelho .opencode):
- `Campo desconhecido: X em <tool>` → confira os campos aceitos listados na própria mensagem; não reenvie o mesmo payload
- Nota de que escalares podem chegar como string e são coeridos (agente não precisa "tentar de outro jeito")

## Risks / Trade-offs

- **[Risco] Coerção mascarar erro de cliente:** string `"100"` virando `100` é permissivo. → Mitigação: só casa padrões exatos (numérico/true/false/JSON válido); qualquer ambiguidade preserva o valor e o validador rejeita com mensagem existente.
- **[Risco] Rejeição quebrar fluxos internos que injetam campos:** → Mitigação: allowlist interna + regressão explícita do batch com `atomic: true` (tarefa de teste); grep de injeções antes de implementar.
- **[Risco] `JSON.parse` de string arbitrária em campo array/object:** parse só é tentado quando o schema declara array/object E o texto começa com `[`/`{`; falha é silenciosa (mantém original). Sem vetor de execução (JSON.parse é puro).
- **[Trade-off] Dupla coerção (harness + executor):** custo desprezível (objetos pequenos) e ganho de uniformidade; idempotência garantida por teste.
- **[Risco] Hash de idempotência do harness mudar** ao persistir args coeridos (`operationHash` deriva dos args): runs antigos não são afetados (hash é por run); aprovação e execução passam a usar o MESMO hash — hoje é que podem divergir.

## Migration Plan

1. Implementar `coercion.ts` + testes unitários (sem wiring)
2. Wiring em `executeSharedTool` e `assistantHarness` + rejeição em `validateToolArguments`
3. Regressões: suite MCP/registry, integration da API (batch do assistente), `test:mcp-catalog`, `test:agent-skill`
4. Rollback: reverter commit único (comportamento volta ao atual; sem migração de dados)

## Open Questions

_(nenhuma — allowlist interna e pontos de aplicação verificados no código durante a sessão)_