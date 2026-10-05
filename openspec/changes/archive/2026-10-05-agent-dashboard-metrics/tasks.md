## 1. Contratos compartilhados

- [x] 1.1 Declarar `get_dashboard_metrics` em `packages/tool-registry/src/fields.ts` com os campos aceitos (`projectId`, `metric` obrigatório `snapshot|burnup|aging|hours|sprint`, `from`, `to`, `moduleId`, `sprintId`, `versionId`, `squadId`, `assigneeId`, `type`, `cycleId`, `includeItems`) e os realmente obrigatórios
- [x] 1.2 Classificar a ferramenta em `packages/tool-registry/src/registry.ts` como `{ domain: 'board', scope: 'project', operation: 'read' }`, incluí-la no conjunto `discovery` e adicionar descrição em `toolDescriptions`
- [x] 1.3 Adicionar a policy de leitura para `get_dashboard_metrics` em `packages/tool-registry/src/policies.ts`
- [x] 1.4 Adicionar bloco opcional `dashboard?: { filters; period: { from; to } }` a `AssistantScreenSnapshot` em `packages/assistant-contracts/src/index.ts`, mantendo `SCREEN_SNAPSHOT_SCHEMA_VERSION = 1`

## 2. Adaptador da ferramenta (MCP/Azy Agent)

- [x] 2.1 Implementar `toolGetDashboardMetrics` em `apps/mcp/src/tools.ts` montando a query dos filtros/período e chamando `/projects/:projectId/dashboard/{snapshot|burnup|aging|hours}` e `/dashboard/sprints[/:cycleId]` via `ApiCall`
- [x] 2.2 Normalizar a resposta por métrica com `capturedAt`/`coverage`, `filters` aplicados/inaplicáveis, `criteria` (Leaf Rule, cobertura de pontos, autor do log) e `populations` rotulando sobreposição como não aditiva (WIP ⊇ Bloqueados, `blockedSubset ≤ wipTotal`, Atrasados sobrepõe WIP)
- [x] 2.3 Incluir amostra limitada de itens de origem com `truncated` explícito quando exceder o limite, sem truncamento silencioso
- [x] 2.4 Aplicar default determinístico dos filtros/período a partir de `execution.context.screenSnapshot.dashboard` quando a tela ativa for o Dashboard; argumento explícito prevalece; `// [TENANT]` revalidado via `authorize` e contexto do run
- [x] 2.5 Registrar o `case 'get_dashboard_metrics'` em `apps/mcp/src/registry.ts` (import + dispatch), garantindo execução como `READ` sem aprovação

## 3. Roteamento e prompt do harness

- [x] 3.1 Garantir que `get_dashboard_metrics` entra no conjunto inicial de intenções `read` (namespace `discovery`) e nas dependencies de roteamento, sem substituir as ferramentas nominais de descoberta
- [x] 3.2 Atualizar `AZY_AGENT_SYSTEM_PROMPT` em `apps/api/src/services/assistantHarness.ts`: usar `get_dashboard_metrics` para WIP/bloqueios/atrasos/horas/burnup/aging/sprint, citar critérios/cobertura e nunca somar populações sobrepostas (WIP + Bloqueados)
- [x] 3.3 Incluir os filtros e o período do Dashboard no contexto autoritativo do modelo (`formatAssistantPromptContext`) quando a fotografia trouxer o bloco

## 4. Fotografia na tela do Dashboard (web)

- [x] 4.1 Publicar no contexto do assistente os filtros de população e o período do `apps/web/src/pages/ProjectDashboardPage.tsx`, reutilizando a semântica de ausência (IS_EMPTY) do padrão T16
- [x] 4.2 Estender `SnapshotCaptureInput`/`buildScreenSnapshot` em `apps/web/src/lib/assistantSnapshot.ts` para capturar o bloco `dashboard` apenas quando `screen === 'project-dashboard'`, sem alterar `scope`/`results`/`view`
- [x] 4.3 Garantir degradação sem o bloco do Dashboard e não regressão do escopo de mutação em lote do board

## 5. Testes

- [x] 5.1 Estender `packages/tool-registry/src/registry-contract.test.ts`: `get_dashboard_metrics` presente com schema, validação, policy e classificação coerentes
- [x] 5.2 Testar o adaptador com `ApiCall` mockado: montagem de query por métrica, normalização, amostra truncada, avisos de cobertura e rótulos de sobreposição
- [x] 5.3 Teste de paridade agente × Dashboard para o mesmo recorte (snapshot, hours, burnup, aging)
- [x] 5.4 Testar o default por fotografia do Dashboard e a precedência do filtro explícito do pedido
- [x] 5.5 Atualizar `apps/web/src/assistant-screen-context.test.ts` para o bloco `dashboard` e a degradação sem ele

## 6. Documentação e i18n

- [x] 6.1 Rodar `bun run generate:docs` e conferir README/OpenAPI/`docs/generated/assistant-limits.md` com a nova ferramenta
- [x] 6.2 Ajustar textos do harness e rótulos de cobertura/sobreposição no idioma do usuário (PT-BR padrão, EN, ES) quando houver strings de UI

## 7. Verificação e encerramento

- [x] 7.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir regressões
- [x] 7.2 Rodar `bun run test:smoke` (fluxo web/API) e, se aplicável, `bun run check:bundle`
- [x] 7.3 Confirmar paridade em SIMPLE e, quando disponível, no perfil ADVANCED/PostgreSQL (job `advanced`)
- [x] 7.4 Registrar `Board ref: d153710f-0a71-45cc-a274-de8741335e9f` nos artefatos da change e encerrar o card T20 com `complete_task`, confirmando no board que o `status` é `DONE`
