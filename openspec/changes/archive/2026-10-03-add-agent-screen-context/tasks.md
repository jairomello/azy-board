## 1. Contrato compartilhado do snapshot

- [x] 1.1 Criar em `packages/assistant-contracts` o tipo `AssistantScreenSnapshot` (schemaVersion 1: `contextId`, `capturedAt`, `route`, `screen`, `projectId`, `projectName`, `view { mode, activeModuleId, collapsedGroupIds }`, `filters` com operador tipado de ausência, `scope { mode: 'ALL' | 'FILTERED' }`, `results { displayedItemIds?, displayedCount, totalMatchingCount, isComplete, revisions }`, `focus` mínimo) e constantes de versão
- [x] 1.2 Traduzir o sentinela da interface (`__empty__`) para operador tipado de ausência no espelho de filtros — sem copiar o sentinela como ID/nome
- [x] 1.3 Reexportar os novos contratos por `packages/types/src/index.ts`

## 2. Web — captura da fotografia por visualização

- [x] 2.1 `BoardScreen.tsx`: derivar (memo) a fotografia do Kanban a partir do estado de apresentação — `allDisplayed` filtrando apenas cards de ação (TASK/BUG), aba de módulo ativa, grupos recolhidos incluídos, filtros ativos, `displayedCount` e `isComplete`
- [x] 2.2 `TreeViewPage.tsx`: derivar a fotografia da árvore a partir de `displayTree` + `expanded`, excluindo nós de agrupamento (módulo/épicos) de `displayedItemIds`
- [x] 2.3 `AssistantContext.tsx`: adicionar `screenSnapshot` a `AssistantPageContext` (desmontagem de modal restaura o contexto anterior); `AppShell.tsx` repassa a nova prop
- [x] 2.4 `AzyAgentDrawer.tsx`: capturar o snapshot no momento do envio da mensagem e do ajuste, montando o payload do `POST messages`/`adjust`
- [x] 2.5 i18n: rótulos de escopo interpretado, prévia e conflito/vazio nos 3 locales (`pt-BR`, `en`, `es`) e validar com `bun run check:i18n`

## 3. API — validação, fixação e prompt autoritativo

- [x] 3.1 `validation.ts`: campo `context` opcional (envelope versionado, com limites de tamanho/quantidade) em `assistantMessageSchema` e `assistantAdjustSchema`
- [x] 3.2 `routes/assistant.ts`: validar projeto vs. conversa (`CONVERSATION_PROJECT_MISMATCH`), acesso do autor e cada `displayedItemId` (tenant/projeto/tipo); IDs inválidos ou sem acesso retornam 422 listados, sem remoção silenciosa
- [x] 3.3 Persistir o snapshot: `metadataJson` da mensagem (contextId/hash) + snapshot inteiro no `executionState` do run; `formatAssistantPromptContext` inclui a fotografia no contexto do modelo
- [x] 3.4 Limites explícitos: excesso de payload/quantidade é declarado (sem truncamento silencioso), coerente com `assistantLimits`

## 4. Harness/executor — escopo travado e prévia real

- [x] 4.1 `canonicalArguments` (`assistantHarness.ts`): com snapshot presente, reescrever os filtros de `update_items` para o conjunto fixado (`matchAll: false`) e remover filtros que ampliem; preservar o estreitamento de tipos já imposto (`itemTypeScope`)
- [x] 4.2 `approvalPreview`: resolver a população no servidor para `update_items` escopado — `displayedCount` × `matchedCount` e alterações por card/campo, com resumo limitado e lista completa acessível
- [x] 4.3 `workerContext.ts`/`assistantRunExecutor.ts`: reidratar o snapshot na continuação/retomada; `executeApproved` re-verifica o hash dos args persistidos
- [x] 4.4 Idempotência: repetição/reexecução da mutação não duplica efeitos (assinaturas de mutação completas)

## 5. Rota de lote — concorrência, vazio e parciais

- [x] 5.1 `routes/batch.ts`: comparar revisões capturadas (`updatedAt` por item) no momento da execução; divergência retorna 409 `CONCURRENT_WRITE` com os itens divergentes
- [x] 5.2 Zero cards capturados ou correspondidos: sem mutação e sem fallback para o projeto (422 `NO_ITEMS_MATCHED`/mensagem explicada)
- [x] 5.3 Sprint e versão resolvidas no catálogo do projeto (incl. `CURRENT`); sprint fechada, destino ambíguo ou versão inexistente gera recusa sem associação
- [x] 5.4 Completude: quando a população exibida for parcial, `isComplete = false` com `totalMatchingCount` server-side (base para listas paginadas)

## 6. Testes

- [x] 6.1 `assistant.test.ts`: contexto autoritativo com snapshot; validação de projeto/IDs; ajuste continua com o snapshot original
- [x] 6.2 `assistantHarness.test.ts`: injeção travada no canonical (`itemIds`/`matchAll`); prévia com contagem e alterações por card
- [x] 6.3 `integration.test.ts`/`batchRelations.test.ts`: mutação atinge somente os capturados; card novo não entra; conflito concorrente; resultado vazio
- [x] 6.4 Evals: datasets de bulk com snapshot sintético no runner/datasets e gate atualizado
- [x] 6.5 Web: atualizar `assistant-ui-contract.test.ts` (payload com `context`) e `assistant-screen-context.test.ts`; marcar `[CONTRATO-ESTRUTURAL]` quando o teste ler código-fonte
- [x] 6.6 e2e: jornada do agente abre o board e verifica a captura do escopo (chip "sem filtro — ação vale para todos") antes do envio; prévia com aprovação do conjunto capturado coberto pelos testes de unidade/integração (6.2/6.3) até existir provider com mutação no e2e

## 7. Guardas e encerramento

- [x] 7.1 Rodar `bun run check` (typecheck + lint + fronteiras de persistência + testes + build) e `bun run test:smoke`
- [x] 7.2 Rodar `bun run check:frontend-tests` e `bun run check:bundle`; se o chunk `BoardPage`/drawer estourar, isolar a captura em chunk dedicado
- [x] 7.3 Regenerar documentação afetada (`bun run generate:docs` / `check:docs`) e atualizar README do MCP quando o contrato mudar
- [x] 7.4 Registrar `Board ref: 878fe024-3027-4d6e-a38c-b7d09ba17618` nos artefatos e fechar o card T16 com `complete_task`, confirmando no board que o status é `DONE`
