## 1. Preparação

- [x] 1.1 Mapear os pontos de integração e os testes acoplados: `assistantHarness.ts` (normalização/eventos), `AzyAgentDrawer.tsx` (handler SSE), `BoardScreen.tsx`/`TreeViewPage.tsx` (estado de visão), `useBoardPreferences.ts` (`localStorage`), `check:mcp-catalog` e `assistant-ui-contract.test.ts`
- [x] 1.2 Definir nomes/campos das ferramentas de UI (`set_board_filters`, `set_board_view`, `open_item`, `restore_previous_view`), o domínio de UI e o envelope `AssistantViewCommand` versionado

## 2. Contratos e catálogo

- [x] 2.1 Adicionar o tipo `AssistantViewCommand` (identificador, versão, tipo, alvo, escopo) e a união de comandos em `packages/assistant-contracts/src/index.ts`
- [x] 2.2 Declarar as ferramentas de UI em `packages/tool-registry/src/{fields.ts,registry.ts}` com `operation: 'read'` e domínio de UI, sem mutação
- [x] 2.3 Excluir as ferramentas de UI do catálogo MCP (`apps/mcp/src/registry.ts`) e ajustar `check:mcp-catalog` com teste de ausência

## 3. API / harness

- [x] 3.1 Normalizar comandos de UI no `assistantHarness.ts` antes de `executeTool` (sem chamar a API de dados) e validar projeto/item para produzir erro acionável
- [x] 3.2 Incluir o campo aditivo `command` (com `commandId`) no payload de `TOOL_COMPLETED`, garantindo a persistência do evento com cursor
- [x] 3.3 Validar o envelope do comando em `apps/api/src/validation.ts`
- [x] 3.4 Testes do harness: comando normalizado, ausência de aprovação, comando inválido → erro sem efeito e UI fora do catálogo MCP

## 4. Web — store e aplicação

- [x] 4.1 Criar o `AssistantViewStore` por aba (`sessionStorage`) com filtros, modo, módulo ativo, item aberto e pilha de histórico limitada
- [x] 4.2 Assinar o store no `BoardScreen.tsx` e aplicar filtros/modo/módulo/abertura com a mesma semântica do toolbar (incluindo o operador de ausência de valor)
- [x] 4.3 Aplicar modo/abertura no `TreeViewPage.tsx` quando aplicável
- [x] 4.4 Publicar no store o comando recebido no handler SSE do `AzyAgentDrawer.tsx`, com deduplicação por `commandId`/cursor
- [x] 4.5 Garantir isolamento por aba: o overlay de sessão vence a preferência durável e nunca é gravado em `localStorage`
- [x] 4.6 Adicionar rótulos de confirmação e erro dos comandos nos três locales (`pt-BR`, `en`, `es`)

## 5. Testes e verificação

- [x] 5.1 Teste do store: aplicar filtros, alternar modo, abrir item, voltar à visão anterior, limite da pilha e isolamento entre abas
- [x] 5.2 Teste de contrato estrutural `[CONTRATO-ESTRUTURAL]` do wiring (drawer → store → BoardScreen/TreeView) e paridade i18n dos rótulos
- [x] 5.3 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir apontamentos
- [x] 5.4 Rodar `bun run test:smoke` e validar manualmente no navegador: pedir “mostre meus bugs sem versão”, alternar Kanban/árvore, abrir card, voltar à visão anterior e confirmar que duas abas não compartilham o estado aplicado
- [x] 5.5 Conferir `check:bundle` (orçamento do chunk `BoardPage`) e `check:mcp-catalog`

## 6. Encerramento

- [x] 6.1 Registrar o resultado no card T17 do Azy Board (Board ref: `b175146b-1a42-4f31-9d67-492d04bcb7fb`) com `create_item_log`
- [x] 6.2 Mover o card T17 para `Concluídas` com `complete_task` e confirmar `status = DONE` no board real
