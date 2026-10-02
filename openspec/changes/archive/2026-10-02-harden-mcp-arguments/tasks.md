## 1. Coerção no tool-registry

- [x] 1.1 Criar `packages/tool-registry/src/coercion.ts` com `coerceArgumentsBySchema(toolName, args)` derivando tipos do `inputSchema` do catálogo (number/boolean/array/object; recursiva para objetos e itens de array aninhados; idempotente)
- [x] 1.2 Exportar em `packages/tool-registry/src/index.ts`
- [x] 1.3 Testes unitários: número/booleano/JSON como string, string JSON inválida preservada, entradas aninhadas (`check_items.items[]`, `operations[].args`), tipos corretos intactos, strings de texto/data/ID intocadas

## 2. Rejeição de campos desconhecidos

- [x] 2.1 Grep de injeções internas de args (`atomic`, `idempotencyKey`, `agentRunId` e outras) em `assistantHarness.ts`, `assistantTools.ts`, `evals/runner.ts` para fechar a allowlist
- [x] 2.2 Em `validateToolArguments`: rejeitar chave de topo fora de `toolFields[name].fields` e fora de `INTERNAL_ARG_ALLOWLIST` com mensagem `Campo desconhecido: X em <tool>; campos aceitos: ...`
- [x] 2.3 Testes: `list_tasks` com `titleContains`/`itemIds` rejeitado citando aceitos; `batch` com `atomic: true` aceito; ferramentas sem campos extras seguem funcionando

## 3. Wiring

- [x] 3.1 `apps/mcp/src/registry.ts` (`executeSharedTool`): aplicar coerção após `pruneNullArguments` e antes de `validateToolArguments`
- [x] 3.2 `apps/api/src/services/assistantHarness.ts`: coergir antes da pré-validação (~linha 253) e persistir args coeridos (preview/hash/execução consistentes)
- [x] 3.3 `apps/mcp/src/index.ts` (`validationDetails`): extrair `Campo desconhecido: (\w+)` para `details.path`
- [x] 3.4 Testes de integração `executeSharedTool`: `limit: "50"` gera `limit=50` na query; `onlyLeaves: "false"` gera `leaf=false`; `fields: '["id"]'` projeta; batch do assistente com `atomic` continua executando

## 4. Documentação e skill

- [x] 4.1 `skills/azyboard/SKILL.md`: em erros comuns, adicionar `Campo desconhecido: X em <tool>` → conferir campos aceitos na mensagem; nota de que escalares podem chegar como string e são coeridos
- [x] 4.2 Sincronizar espelho `.opencode/skills/azyboard/SKILL.md` (validado por `validateSkillMirror`)
- [x] 4.3 `apps/mcp/README.md`: mencionar coerção e rejeição de desconhecidos na seção de validação (se existente)

## 5. Validação

- [x] 5.1 `bun run check` (typecheck + lint + testes + build) — comparar falhas com baseline pré-existente
- [x] 5.2 `bun run test:mcp-catalog` e `bun run test:agent-skill`
- [x] 5.3 Teste manual via MCP: `list_tasks` com `limit`/`fields` como string e com campo desconhecido (comportamento novo de primeira)

## 6. Encerramento

- [x] 6.1 Registrar `Board ref: <itemId>` na proposal — B3 (`2f4cbbc6-70a8-477f-8d8e-b4e116041611`)
- [x] 6.2 Ao concluir: `complete_task` no card B3 + confirmação de `DONE` no board real