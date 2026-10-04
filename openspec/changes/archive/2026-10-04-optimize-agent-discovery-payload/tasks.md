# Tasks — Otimização de desempenho do Azy Agent (payloads de descoberta)

## 1. Contratos e tool-registry

- [x] 1.1 Definir tipos/zod do digest (`ScreenOverview` e argumentos de `get_screen_overview`) em `packages/assistant-contracts` e exportá-los
- [x] 1.2 Registrar classificação `get_screen_overview: { domain: 'board', scope: 'project', operation: 'read' }` no `discovery` set do tool-registry e ajustar testes de contrato (`registry-contract.test.ts`)
- [x] 1.3 Adicionar campo opcional `includeDetails` aos schemas de `get_board`/`get_tree` no tool-registry com coerção booleana

## 2. Ferramentas

- [x] 2.1 Implementar `toolGetScreenOverview(api, args)` em `apps/mcp/src/tools.ts` reutilizando `toolGetBoard(api, projectId, false)` + agregação por coluna/status/tipo com amostra de ≤20 referências por coluna
- [x] 2.2 Implementar modo `summary` em `toolGetBoard`/`toolGetTree` (projeção de 9 campos por item; forma completa com `includeDetails=true`)
- [x] 2.3 Chavear `get_screen_overview` em `apps/mcp/src/registry.ts` e cobrir com testes (`tools.test.ts`/`registry.test.ts`)

## 3. Contexto e prompt

- [x] 3.1 Incluir o bloco `screenOverview` no `formatAssistantPromptContext` quando o snapshot tiver `results` (com `contextId`/`capturedAt` e aviso de captura)
- [x] 3.2 Adicionar as regras de "descoberta em um passo" ao `AZY_AGENT_SYSTEM_PROMPT` em `apps/api/src/routes/assistant.ts`
- [x] 3.3 Incluí-lo no roteamento adaptativo de intenções `read` (`toolsForMessage`) e revalidar `assistant.test.ts`

## 4. Documentação gerada

- [x] 4.1 Rodar `bun run generate:docs` e revisar catálogo MCP, OpenAPI e tabela de limites
- [x] 4.2 Atualizar doc da wiki (Azy Agent humano / Usar o Chat) apenas se elas fixarem valores afetados

## 5. Verificação

- [x] 5.1 Testes novos: digest injetado (com/sem results), `get_screen_overview` (SCREEN, PROJECT, sem autorização), summary default vs `includeDetails`, multi-tool por passo
- [x] 5.2 Smoke local de chat com banco de laboratório e provider stub (2 passos, prompt ≤ ~8K tokens)
- [x] 5.3 `bun run check` + `bun run test:smoke` + `bun run test:agent-skill` verdes; deploy no labapps
