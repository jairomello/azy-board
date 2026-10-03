## Why

O Azy Agent recebe hoje apenas tela, projeto e item das modais (`AzyAgentDrawer` envia `content`, `screen`, `projectId` e `itemId`); os filtros ativos e a população de cards exibida não chegam à execução. Pedidos como “mude os cards que estão aparecendo” não têm como fixar exatamente o que o usuário vê, e a mutação em lote (`update_items`) pode re-filtrar no servidor e ampliar o escopo para cards além da tela. A prévia de aprovação descreve filtros em texto, sem contagem real, e não cobre conflito concorrente nem resultado vazio.

Board ref: `878fe024-3027-4d6e-a38c-b7d09ba17618` (card T16).

## What Changes

- **Publicação da fotografia no frontend**: Board (Kanban) e árvore publicam a fotografia do contexto em cada envio — tela, projeto (id/nome), modo de visualização, aba de módulo ativa, grupos recolhidos, filtros ativos (com o significado fiel de “sem sprint”/“sem versão”) e o **modo de escopo**: sem nenhum filtro aplicado, a fotografia apenas declara que a ação vale para tudo (`scope: 'ALL'`), sem enviar IDs; com filtro aplicado, declara o conjunto específico (`scope: 'FILTERED'`) e envia os IDs dos cards reais apresentados — limitados, com truncamento explícito e, acima do limite, referência a snapshot persistido no servidor.
- **Contrato do chat evoluindo**: o envio de mensagem (`POST /assistant/conversations/:id/messages`), a revisão de aprovação e o ajuste transportam a fotografia em um campo novo e tipado (versionado). O prompt do agente passa a receber esse contexto autoritativo do servidor.
- **Fixação do snapshot na execução**: o servidor valida e persiste a fotografia na mensagem e no contexto de execução do run; a execução enfileirada (worker) usa esse mesmo snapshot — navegar ou refiltrar depois do envio não altera o escopo pendente.
- **Ação sobre os cards capturados**: com snapshot presente, o servidor aplica a mutação conforme o modo de escopo — `scope: 'ALL'` (sem filtro nenhum) usa `matchAll` já imposto pelo harness, com a população resolvida e contada no servidor; `scope: 'FILTERED'` reescreve os filtros para os **IDs fixados**, bloqueia ampliação (nenhum filtro/`matchAll` re-introduz população) e aplica sprint e versão somente aos cards capturados, resolvendo destino no catálogo do projeto (sprint fechada/ambígua não gera associação).
- **Prévia real**: a prévia exibe quantidade exibida × correspondidas e as alterações por card (ex.: “12 cards: sprint vazia → Sprint 1; versão vazia → v1.0.0”), com limites excedidos explícitos, sem truncamento silencioso.
- **Concorrência**: a fotografia carrega a revisão (`updatedAt`) de cada item capturados; divergência na execução provoca conflito visível (`CONCURRENT_WRITE`) e recalculo da prévia — sem ampliar a população silenciosamente.
- **Resultado vazio**: zero cards capturados ou correspondidos não produz mutação nem fallback para o projeto inteiro; o chat explica.
- **Semântica documentada e testada** para abas de módulo, grupos recolhidos, árvore e paginação/virtualização; IDs de agrupadores e histórias virtuais não entram como IDs persistidos de cards.
- Sem **BREAKING**: o campo novo é opcional; clientes antigos continuam funcionando.

## Capabilities

### New Capabilities
- `agent-screen-context`: fotografia do contexto da tela (tela, projeto, visualização, filtros e cards exibidos) com captura no envio, fixação na execução e na aprovação, escopo imposto pelo servidor, prévia com quantidade e alterações por card, conflito concorrente, resultado vazio e semântica para aba de módulo, grupos recolhidos, árvore e paginação.

### Modified Capabilities
- `azy-agent-chat`: mensagem, aprovação e ajuste passam a transportar a fotografia do contexto; o contexto autoritativo do modelo inclui o resultado exibido.
- `assistant-context-optimization`: o contexto visual passa a incluir a fotografia do resultado — permanecendo compacto e não autoritativo — e a prévia de `update_items` passa a refletir contagem real.

## Impact

- **Contratos compartilhados**: `packages/assistant-contracts/src/index.ts` (tipo `AssistantScreenSnapshot`/`E2E`-de-contrato) e `packages/types`.
- **Web**: `apps/web/src/contexts/AssistantContext.tsx`, `apps/web/src/components/AppShell.tsx`, `apps/web/src/components/AzyAgentDrawer.tsx`, `apps/web/src/features/board/BoardScreen.tsx`, `apps/web/src/pages/TreeViewPage.tsx` (e modais para foco quando aplicável).
- **API**: `apps/api/src/validation.ts` (`assistantMessageSchema`, `assistantAdjustSchema`), `apps/api/src/routes/assistant.ts` (captura, validação, prompt), `apps/api/src/services/assistantHarness.ts` (`canonicalArguments`, `approvalPreview`), `apps/api/src/services/assistantRunExecutor.ts` + `apps/api/src/services/workerContext.ts` (snapshot ao worker), `apps/api/src/routes/batch.ts` (escopo fixo, revisões, vazio).
- **tool-registry**: `packages/tool-registry/src/validation.ts` (gestão de `filters.itemIds`/`matchAll` e do escopo travado).
- **Testes e guardas**: `apps/api/src/assistant.test.ts`, `apps/api/src/services/assistantHarness.test.ts`, `apps/api/src/integration.test.ts`/`batchRelations.test.ts`, `apps/api/src/evals/datasets/core.ts`, web `assistant-ui-contract.test.ts`/`assistant-screen-context.test.ts`, e2e, `check:frontend-tests`, `check:bundle` (chunk `BoardPage`).
