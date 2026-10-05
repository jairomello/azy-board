## 1. Parser e descritor no catálogo

- [x] 1.1 Criar parser de duração reutilizável em `packages/tool-registry` aceitando `H:MM`, `Nh`, `NhMM`, `N`, `Nmin` e `Nm`, com testes unitários (válidos, inválidos, minutos `> 59`, negativos)
- [x] 1.2 Adicionar `durationMin` e `duration` a `toolFields.create_item_log` em `packages/tool-registry/src/fields.ts`, mantendo `projectId`, `itemId` e `activity` obrigatórios
- [x] 1.3 Atualizar descrição e schema de `create_item_log` em `packages/tool-registry/src/registry.ts` (incluindo o ramo de `durationMin` em `schemaFor`) e o `changes` de `update_item_log` se necessário para exibir duração formatada
- [x] 1.4 Implementar em `packages/tool-registry/src/validation.ts` a normalização `duration` → `durationMin`, a validação de inteiro não-negativo e a rejeição de conflito entre os dois campos, com mensagem citando valor recebido e formato aceito
- [x] 1.5 Garantir que a canonicalização ocorre antes do preview e do hash (normalização idempotente, sem alterar o contrato `H:MM` de `packages/ui-contracts`)

## 2. Executor MCP

- [x] 2.1 Ajustar `toolCreateItemLog` em `apps/mcp/src/tools.ts` para enviar `durationMin` normalizado e permitir confirmar atividade e duração na resposta
- [x] 2.2 Revisar o dispatch `case 'create_item_log'` em `apps/mcp/src/registry.ts` para repassar `duration`/`durationMin` já normalizados
- [x] 2.3 Conferir o retorno de `POST /projects/:id/items/:itemId/logs` em `apps/api/src/routes/items.ts` e `itemLogSchema` em `apps/api/src/validation.ts`; incluir `durationMin` na resposta se hoje ela só devolve `{ id }`
- [x] 2.4 Regerar a documentação do catálogo (`apps/mcp/README.md`) e rodar `bun run test:mcp-catalog`

## 3. Prévia e anti-duplicação no harness

- [x] 3.1 Adicionar ramo de preview para `create_item_log`/`update_item_log` em `apps/api/src/services/assistantHarness.ts`, exibindo atividade e duração formatada (`90 min (1h30)`) em pt-BR
- [x] 3.2 Garantir que `canonicalArguments`/hash usam o payload canônico com `durationMin` numérico, para que representações equivalentes tenham a mesma assinatura
- [x] 3.3 Cobrir em teste que a repetição do mesmo apontamento na run não cria registro duplicado (`REPEATED_TOOL_CALL`/`alreadyExecuted`)
- [x] 3.4 Garantir que o agente não promete data retroativa quando o pedido inclui data escolhida

## 4. Testes de contrato

- [x] 4.1 Estender `apps/mcp/src/optional-fields.test.ts` verificando `durationMin`/`duration` opcionais em `create_item_log` e os limites de `activity`
- [x] 4.2 Estender `packages/tool-registry/src/registry-contract.test.ts` com a paridade schema/validação/dispatch da duração e o caso de conflito `durationMin` × `duration`
- [x] 4.3 Adicionar teste de normalização de formatos (`1h30` → 90, `1:30` → 90, `90min` → 90) e de rejeição de duração inválida

## 5. Skill e documentação

- [x] 5.1 Documentar `create_item_log` com duração em `skills/azyboard/SKILL.md` e `skills/azyboard/references/mcp-operations.md` (exemplos `durationMin: 90` e `duration: "1h30"`, confirmação do resultado)
- [x] 5.2 Registrar a limitação de data retroativa na skill
- [x] 5.3 Sincronizar o espelho `.opencode/skills/azyboard/` e rodar `bun run test:agent-skill`

## 6. Verificação e encerramento

- [x] 6.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir regressões
- [x] 6.2 Rodar `bun run test:smoke` para o fluxo web/API
- [x] 6.3 Registrar `Board ref: 1fe2e457-e2f5-4acb-9856-cd018e740d1a` (T21) e confirmar o fechamento do card com `complete_task` no board real
