## 1. Contratos compartilhados

- [x] 1.1 Criar `packages/ui-contracts/src/visibility.ts` com o tipo `ItemVisibilityReason` (união discriminada: `ARCHIVED`, `FILTER {field,value}`, `MODULE_TAB {moduleId}`, `SUBTASK_HIDDEN`, `COLLAPSED_GROUP {groupId,groupKind}`, `EMPTY_GROUP_HIDDEN {groupId,groupKind}`, `ACCESS_DENIED`, `UNKNOWN`) e o tipo do estado de visão de entrada
- [x] 1.2 Implementar `evaluateItemVisibility(item, viewState)` retornando `{ visible, reasons }`, com a ordem determinística da taxonomia e sem inferir exclusão pela ausência
- [x] 1.3 Reexportar os novos tipos/função no barrel `packages/ui-contracts/src/index.ts` (sem duplicar definições; manter `shared-package-architecture`)
- [x] 1.4 Em `packages/assistant-contracts/src/index.ts`, adicionar `view.presentation?` opcional em `AssistantScreenSnapshot` (`showSubtasks`, `storyDisplay`, `moduleViewMode`, `hideEmptyEpics`, `hideEmptyStories`) e `'reveal_item'` em `AssistantViewCommandType` com `itemId`; manter `SCREEN_SNAPSHOT_SCHEMA_VERSION` e `VIEW_COMMAND_SCHEMA_VERSION` em `1`

## 2. Avaliador aplicado ao board (paridade)

- [x] 2.1 Refatorar `apps/web/src/features/board/BoardScreen.tsx` (`boardCards`, `epicGroups`, `moduleGroups`, `visibleModuleGroups`) para derivar de `evaluateItemVisibility`/helpers compartilhados, removendo predicados inline duplicados
- [x] 2.2 Cobrir no avaliador os motivos de apresentação: `SUBTASK_HIDDEN` (`showSubtasks`), `MODULE_TAB` (`moduleViewMode='tabs'`), `COLLAPSED_GROUP` (`collapsedEpics/Modules/Stories`) e `EMPTY_GROUP_HIDDEN` (`hideEmptyEpics`/`hideEmptyStories`)
- [x] 2.3 Garantir equivalência com os predicados existentes de `apps/web/src/features/board/model/types.ts` (`matchesScalarFilter`, `matchesMemberFilter`, `matchesSprintFilter`, `EMPTY_FILTER_VALUE`)

## 3. Fotografia da tela com estado de apresentação

- [x] 3.1 Estender `SnapshotCaptureInput` e `buildScreenSnapshot` em `apps/web/src/lib/assistantSnapshot.ts` para capturar `presentation` sem alterar o cálculo de `scope` (`ALL`/`FILTERED`)
- [x] 3.2 Publicar o estado de apresentação a partir de `BoardScreen.tsx` (filtros de apresentação já disponíveis) e preservar o comportamento quando ausente

## 4. Explicação no servidor

- [x] 4.1 Adicionar a ferramenta somente-leitura `explain_item_visibility` em `apps/api/src/services/assistantUiTools.ts` (domínio de UI, sem aprovação, fora do catálogo MCP), aceitando `itemId` ou `sequenceCode`
- [x] 4.2 Resolver o item por `itemId`/`sequenceCode` e carregar ancestrais, vínculos de sprint/tags e módulo do épico em `apps/api/src/routes/assistant.ts` com verificação de membership e tenant (`// [TENANT]`)
- [x] 4.3 Aplicar `evaluateItemVisibility` com o estado da fotografia; retornar `ACCESS_DENIED` sem revelar conteúdo quando não houver acesso
- [x] 4.4 Integrar a ferramenta ao harness (`apps/api/src/services/assistantHarness.ts`): prompt/roteamento do nome e formatação da explicação com os motivos ordenados
- [x] 4.5 Garantir degradação: sem `presentation` no snapshot, explicar apenas os motivos determináveis e marcar `UNKNOWN` no restante

## 5. Revelação no cliente

- [x] 5.1 Adicionar `reveal_item` ao store de visão por aba (`apps/web/src/lib/assistantViewStore.ts`): recomputar com o estado vivo, neutralizar só os motivos responsáveis, gravar checkpoint no histórico e sinalizar a abertura do item
- [x] 5.2 Implementar a neutralização no `BoardScreen.tsx` (trocar aba de módulo, expandir grupo, desligar filtro/regra) preservando `restore_previous_view` (T17)
- [x] 5.3 Despachar `reveal_item` no `apps/web/src/components/AzyAgentDrawer.tsx` a partir do evento do run, reutilizando a deduplicação por `commandId`

## 6. Internacionalização

- [x] 6.1 Adicionar rótulos dos motivos e da oferta de revelação em `apps/web/src/i18n/locales/{pt-BR,en,es}/` (PT-BR padrão)
- [x] 6.2 Ajustar as mensagens do harness para o idioma do usuário, sem embutir texto no contrato

## 7. Testes

- [x] 7.1 Teste unitário do avaliador em `packages/ui-contracts` cobrindo cada motivo, ordem determinística, item visível sem motivos e `UNKNOWN`
- [x] 7.2 Teste de paridade board × avaliador: para uma matriz de filtros/regras, o conjunto visível do `BoardScreen` coincide com `visible = true`
- [x] 7.3 Atualizar/estender `apps/web/src/assistant-screen-context.test.ts` e um teste de contrato do snapshot com `presentation` e do comando `reveal_item`
- [x] 7.4 Estender `apps/api/src/services/assistantUiTools.test.ts` com `explain_item_visibility` e `reveal_item` (validação, acesso negado e ausência do catálogo MCP)

## 8. Verificação e encerramento

- [x] 8.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir regressões
- [x] 8.2 Rodar `bun run test:smoke` (fluxo web/API) e `bun run check:bundle` (chunk do board)
- [x] 8.3 Registrar `Board ref: 260522e1-21ac-44fc-8f3c-f7be2b4756bb` nos artefatos da change e confirmar que o card T18 termina em coluna com `baseStatus = DONE` (`complete_task`)
