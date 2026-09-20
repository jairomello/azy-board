## Why

O item 25 da análise apontava código morto no MCP. A remoção mais grave já foi feita (`apps/mcp/src/index.ts` virou adaptador de transporte com 177 linhas), mas a segunda metade do problema permanece: o catálogo de ferramentas mantém **múltiplas fontes de verdade em paralelo** que precisam ser editadas à mão e já divergem entre si. `required` existe em `registry.ts` e, de novo, em `validation.ts` — e não são iguais (por exemplo, `create_sprint` exige `startDate`/`endDate` em uma e não na outra; `create_checklist`/`add_checklist_item_to_task` também divergem). Quem altera uma ferramenta precisa lembrar de atualizar schema, `required`, `fieldsByTool`, os conjuntos de routing, `limits.ts` e `validation.ts`. Isso é a mesma classe de defeito que gerou os cards recentes de MCP (schema marcando opcionais como required, validador rejeitando `null`, limites de texto divergentes da API).

## What Changes

- Consolidar a definição de cada ferramenta em um único ponto: um descritor por tool que declara nome, descrição, campos (com tipo, obrigatoriedade, limites e texto de ajuda), routing e policy.
- Derivar do descritor, sem tabelas paralelas: o schema exposto (MCP e OpenAI strict), a lista de campos obrigatórios, o routing (`domain`, `scope`, `operation`, `risk`, dependências e telas), a validação de argumentos e os limites de texto.
- Eliminar as duplicatas: `required` em `validation.ts`, a lista de campos por ferramenta em `registry.ts` e os conjuntos manuais de classificação (`discovery`, `planning`, `projectTools`, `boardTools`, `createTools`, `updateTools`, `destructiveTools`, etc.).
- Cobertura de contrato: testes que garantam que o schema exposto, a validação e o catalogado pelo MCP permanecem derivados do descritor e que nenhuma ferramenta fica sem definição.
- Garantir que o comportamento observável não muda: os schemas expostos e as mensagens de erro continuam equivalentes aos atuais (corrigindo apenas as divergências reais já existentes).
- **Não muda**: contratos HTTP da API, políticas de permissão, o formato das respostas das ferramentas ou o transporte stdio.

## Capabilities

### New Capabilities
- `mcp-tool-registry`: fonte única de verdade para o catálogo de ferramentas MCP, da qual schema, obrigatoriedade, routing, limites e validação são derivados, com testes de contrato que impedem divergência entre definição, exposição e execução.

### Modified Capabilities
- `mcp-server`: o catálogo de definições, schemas e validação passa a ser derivado de uma definição única por ferramenta, mantendo o comportamento observável atual.

## Impact

- **MCP:** `apps/mcp/src/registry.ts` (descritores + derivação), `apps/mcp/src/validation.ts` (passa a consumir a definição única em vez de tabela própria), `apps/mcp/src/limits.ts` (limites movidos para os descritores ou derivados deles), `apps/mcp/src/index.ts` (schema exposto continua derivado), `apps/mcp/src/tools.ts` (executores, sem mudança de assinatura).
- **API (consumidor):** `apps/api/src/services/assistantTools.ts` e `apps/api/src/services/assistantHarness.ts` importam do MCP; devem continuar funcionando sem mudança de contrato.
- **Testes:** `apps/mcp/src/registry.test.ts`, `optional-fields.test.ts`, `api-response.test.ts` e `scripts/check-mcp-catalog.ts` (gate do CI) passam a validar a garantia de fonte única.
- **Rastreabilidade:** Board ref: 3481186a-fd35-450a-bd4b-2a9a90ad4f21 (Item 25: O MCP contém grande quantidade de código morto).
- **Fora de escopo:** criar pacote compartilhado para o import direto da API no MCP (item 26), alterar políticas de permissão, mudar schemas/descrições de forma que quebre clientes, ou mexer no transporte.
