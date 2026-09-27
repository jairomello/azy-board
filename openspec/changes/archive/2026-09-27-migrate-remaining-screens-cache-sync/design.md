## Context

A change `add-client-cache-sync` (Item 17) introduziu a camada de cache com TanStack Query (`lib/queryClient.ts`, `lib/queryKeys.ts`), `AbortSignal` no cliente `lib/api.ts`, invalidação/refetch por WebSocket (`lib/realtimeEvents.ts`) e migrou o piloto **Board** (`features/board/hooks/useBoardData.ts`) e **Dashboard** (`pages/ProjectDashboardPage.tsx`). As mutações do board seguem a política única de `features/board/model/mutation.ts` (`runOptimisticMutation`) — o `useMutation` do TanStack não é usado no código real.

Ficaram no padrão antigo (`useState` + `useEffect` + `api.get` manual, sem cache/cancelamento):

- `features/project-settings/hooks/useProjectSettingsData.ts` (`Promise.all` sem `signal`, linhas 33-79) + ~27 chamadas imperativas em `ProjectSettingsScreen.tsx` e seções `Organization/DeliverySettingsSections.tsx`, com refetch manual pós-mutação;
- `pages/TreeViewPage.tsx` — `useState(tree)` + `useEffect` com `refreshToken` imperativo (linhas 295-328), incrementado por `BoardScreen.tsx` via `setTreeRefreshToken`;
- `pages/ProjectsPage.tsx` — `useEffect` + `loadProjects()` e listener próprio de `onAssistantMutation` com refetch manual (linhas 36-49);
- `pages/AdminUsersPage.tsx` — `load()` imperativo (linhas 18-20), `await load()` após cada mutação;
- `hooks/useApiKeys.ts` — `useState` + `useEffect` + `load()` (linhas 17-30).

Isso reproduz os sintomas do item 17 da análise: corrida quando `projectId` muda, respostas antigas sobrescrevendo estado novo, dados repetidos e ausência de cancelamento. A spec `client-cache` já exige camada única, cancelamento e refetch no reconnect — as telas restantes apenas não a cumprem.

Restrições relevantes: PT-BR em tudo; somente licenças MIT/Apache/BSD/ISC/Domain público (TanStack Query MIT já é dependência); chaves de cache sempre escopadas por identidade (isolamento entre contas via `queryClient.clear()` no logout, `AuthContext.tsx:126`).

## Goals / Non-Goals

**Goals:**

- Todas as telas de dados (Settings, Projects, TreeView, AdminUsers, ApiKeys) consomem estado remoto exclusivamente pela camada de cache existente.
- Eliminar `refreshToken` do TreeView e `load()` imperativos de Projects/AdminUsers/ApiKeys em favor de invalidação/revalidação do cache.
- `AbortSignal` em todas as consultas migradas; respostas obsoletas descartadas.
- Invalidação por eventos WebSocket existentes e refetch no reconnect nas telas migradas.
- Mutações das telas migradas seguem a política única de `optimistic-mutations` (padrão **reconciliado** por default).
- Testes de contrato que impeçam regressão ao padrão antigo.

**Non-Goals:**

- Novos tipos de evento WebSocket no servidor (item 20 da análise segue aberto).
- Replay/cursor de eventos, cache offline persistente ou substituição do WebSocket.
- Migrar componentes de apoio do card (ActivityLogPanel, WorkLogPanel, ChecklistSection, TagSelector, CardChildrenSection etc.) — candidatos a change posterior.
- Mudança de UX/visual das telas além da atualização mais consistente dos dados.

## Decisions

1. **Reutilizar a camada existente em vez de nova abstração.** As telas migradas usam `useQuery`/`queryClient` + `lib/api.ts` com `signal`, exatamente como Board/Dashboard. *Alternativa:* criar hooks genéricos (`useCrudList`) — rejeitada por esconder o contrato e trazer uma segunda API de dados.

2. **Chaves em `lib/queryKeys.ts` com a raiz `['auth', userId, ...]`.** Chaves por projeto continuam sob `'project', projectId`; as consultas não escopadas por projeto viram irmãs dessa raiz: `['auth', userId, 'projects']`, `['auth', userId, 'adminUsers']`, `['auth', userId, 'apiKeys']`. *Alternativa:* chave única sem identidade — rejeitada porque quebra o isolamento entre contas já exigido pela spec.

3. **TreeView por consulta cacheada, com invalidação explícita.** `useQuery` com chave `tree(userId, projectId)` substitui `refreshToken`; as mutações do board que alteram hierarquia chamam `invalidateQueries(treeKey)` (helper `invalidateTree`), em vez de `setTreeRefreshToken`. O callback de refetch do `useQuery` preserva o comportamento atual de reload completo da árvore.

4. **Mutações das telas migradas: padrão reconciliado por default.** CRUDs de baixa frequência (Settings, AdminUsers, ApiKeys) aplicam o estado após sucesso e invalidam/refazem a consulta — sem antecipação otimista. O padrão otimista com rollback (`runOptimisticMutation`) só é usado onde já há benefício percebido. *Alternativa:* `useMutation` com `onMutate/onError/onSettled` — rejeitada para não criar um segundo estilo de mutação ao lado de `runOptimisticMutation`.

5. **Invalidação por WebSocket restrita aos eventos que existem.** Hoje só `MODULE_CREATED` é emitido para metadados (`routes/projects.ts:320`); portanto Settings invalida consultas de módulos nesse evento, e o refetch no reconnect cobre as demais mudanças (membros, squads, versões, sprints). *Alternativa:* emitir novos eventos no servidor — fora de escopo (item 20).

6. **Invalidação central do assistente.** O `onAssistantMutation` (`lib/dataEvents.ts`) passa a invalidar as chaves relevantes em um ponto único (hook `useAssistantCacheInvalidation`), substituindo o listener manual de `ProjectsPage.tsx:49` — mutações do Azy Agent continuam refletindo em todas as telas.

7. **Contrato anti-regressão por teste estrutural.** O workspace não tem DOM/jsdom/React Testing Library, então os testes seguem o padrão estrutural do repositório (leitura do fonte + asserção dos caminhos de cache): contratos por tela migrada cobrem chave por identidade/projeto, `AbortSignal` e invalidação/`applyProject` pós-mutação; um teste guarda varre as telas migradas e falha se reaparecer `api.get` em `useEffect`/`load()` imperativo, `refreshToken` ou `useState` para dados remotos. *Alternativa:* `renderHook` com `QueryClientProvider` — rejeitada por exigir infraestrutura de browser fora do escopo; a cobertura comportamental equivalente fica para E2E.

## Risks / Trade-offs

- [Settings tem ~27 chamadas imperativas e formulários acoplados ao refetch] → migrar seção a seção (Organization, Delivery, General), mantendo o padrão reconciliado e validando com `bun run check` + `bun run test:smoke` a cada seção.
- [Remover `refreshToken` pode quebrar a atualização da árvore após reparent/move] → o `invalidateTree` é chamado nos mesmos pontos de `setTreeRefreshToken` (`BoardScreen.tsx:509, 527`) e há teste de contrato do TreeView cobrindo a invalidação.
- [Consultas não escopadas por projeto (Projects, AdminUsers, ApiKeys) podem vazar entre contas] → manter a raiz `['auth', userId, ...]` e o `queryClient.clear()` no logout; cenário de isolamento na spec.
- [Padrão reconciliado pode parecer "mais lento" em CRUDs] → aceitável: são operações de baixa frequência e a alternativa otimista amplia o risco de rollback inconsistente.
- [Eventos de metadados são escassos hoje] → o reconnect faz refetch; quando o item 20 trouxer mais eventos, basta estender `lib/realtimeEvents.ts`.

## Migration Plan

1. Estender `lib/queryKeys.ts` (e testes) com as novas chaves.
2. Migrar as telas na ordem: ApiKeys → AdminUsers → Projects → TreeView → Settings (das mais simples para a mais complexa), cada uma em um commit verificável.
3. Trocar `setTreeRefreshToken` por `invalidateTree` e remover o `refreshToken`.
4. Centralizar invalidação do assistente e ligar os handlers de WebSocket existentes.
5. Rodar `bun run check`, `bun run test:smoke` e os testes de contrato novos; atualizar `docs/ANALISE-SISTEMA.md` e a wiki.

Rollback: cada tela migra em commit isolado; em caso de regressão, reverte-se o commit da tela sem afetar as demais.

## Open Questions

- Vale estender a change para os painéis de apoio do card (ActivityLogPanel, WorkLogPanel, ChecklistSection)? — fora de escopo por ora; se necessário, nova change reutilizando esta.
- Quando o item 20 trouxer eventos de metadados ricos (members/versions/sprints), a invalidação prevista em `realtimeEvents.ts` será suficiente ou será necessário patch incremental como no board?
