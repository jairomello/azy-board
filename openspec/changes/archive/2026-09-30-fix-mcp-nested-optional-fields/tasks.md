Board ref: 1720fa01-3650-44f0-96e9-cc2897195b8f

## 1. Catálogo: obrigatoriedade real por nó

- [x] 1.1 Em `packages/tool-registry/src/fields.ts`, estender `ToolFields` com `nested?: Record<string, string[]>` e declarar, por ferramenta, a obrigatoriedade real de `filters`, `changes`, `changes[]` e `operations[].args`, alinhada ao zod de `apps/api/src/validation.ts`
- [x] 1.2 Exportar do catálogo a consulta de obrigatoriedade por nó (mesmo espírito de `requiredFieldsFor`), mantendo `OPERATION_ARGS_REQUIRED` como a declaração de `operations[].args`
- [x] 1.3 Em `packages/tool-registry/src/registry.ts`, criar `checklistChangeSchema` (`name`, `position`) e `itemLogChangeSchema` (`activity`, `durationMin`), e selecionar o nó `changes` por ferramenta em `getSharedToolDefinitions`, como já ocorre com `checklistItemChangeSchema`
- [x] 1.4 Confirmar que `getSharedToolDefinitions` continua inalterado na visão estrita: todos os campos de topo e aninhados seguem em `required`, com tipos anuláveis

## 2. Exposição MCP recursiva

- [x] 2.1 Em `packages/tool-registry`, implementar `applyOptionalFields(inputSchema, toolName)`: percorrer `properties`/`items` acumulando o caminho e trocar o `required` de cada nó pela declaração correspondente; manter nós sem declaração intactos
- [x] 2.2 Fazer `applyOptionalFields` falhar explicitamente quando um caminho declarado em `nested` não existir no schema da ferramenta
- [x] 2.3 Em `apps/mcp/src/index.ts`, substituir `withOptionalFields` e `withOptionalOperationArgs` por `applyOptionalFields`, preservando `withOptionalProjectId` (depende do `defaultProjectId` em tempo de execução)
- [x] 2.4 Verificar que o harness do Azy Agent (`apps/api/src/services/assistantHarness.ts`) segue recebendo a visão estrita, sem reuso de `applyOptionalFields`

## 3. Validação: ramos próprios e forma mínima

- [x] 3.1 Em `packages/tool-registry/src/validation.ts`, criar ramos próprios para `update_checklist` e `update_item_log`, validando `name`/`position` e `activity`/`durationMin`, rejeitando chaves desconhecidas e mantendo `changes` como objeto
- [x] 3.2 Garantir que `update_item`/`update_items` continuam aceitando `changes` como array com `value` opcional (exigido apenas em `SET` e `OFFSET_DAYS`), e `update_checklist_item` como objeto com todos os campos opcionais
- [x] 3.3 Compor as mensagens de erro de nós aninhados com a forma mínima aceita e o caminho do nó (ex.: `filters`, `changes[]`), incluindo o caso `filters` sem critério e sem `matchAll: true`
- [x] 3.4 Revisar `apps/mcp/src/registry.ts` para que `update_checklist` e `update_item_log` repassem o `changes` já saneado ao executor, sem depender do formato antigo

## 4. Testes de contrato

- [x] 4.1 Estender `apps/mcp/src/optional-fields.test.ts` para percorrer a árvore inteira do `inputSchema` exposto e reprovar qualquer campo opcional presente em `required`, em qualquer profundidade
- [x] 4.2 Adicionar caso cobrindo a operação real que motivou o bug: `update_items` com `filters: { matchAll: true, sprint: 'CURRENT' }` e um `changes` com campo opcional omitido, sem `null` explícitos
- [x] 4.3 Adicionar em `packages/tool-registry/src/registry-contract.test.ts` o teste de "forma mínima" por ferramenta: o payload que só informa obrigatórios (topo e aninhados) passa em `validateToolArguments` e bate com o `required` exposto
- [x] 4.4 Testar que um caminho `nested` órfão reprova o contrato e que nó sem declaração mantém o `required` original
- [x] 4.5 Testes de não-regressão de null: opcional aninhado enviado como `null` é aceito, e `batch.operations[].args.parentRef: null` continua significando "item raiz" (não é apagado)
- [x] 4.6 Testes das shapes novas: `update_checklist` e `update_item_log` aceitam o objeto próprio, rejeitam array e rejeitam chave desconhecida

## 5. Verificação e encerramento

- [x] 5.1 Rodar `bun run check` (typecheck + lint + testes + build) e `bun run test:smoke`, corrigindo qualquer regressão
- [x] 5.2 Registrar a correção em `CHANGELOG.md`, destacando que `update_checklist` e `update_item_log` passam a expor o `changes` correto
- [x] 5.3 Conferir que os artefatos da change mantêm `Board ref: 1720fa01-3650-44f0-96e9-cc2897195b8f`
