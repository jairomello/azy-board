## 1. Infraestrutura de cache

- [x] 1.1 Estender `apps/web/src/lib/queryKeys.ts` com as chaves `projects`, `adminUsers`, `apiKeys` (irmãs da raiz `['auth', userId, ...]`) e `tree(userId, projectId)` (sob `'project', projectId`), preservando as chaves existentes de `board` e `dashboard`
- [x] 1.2 Atualizar `apps/web/src/lib/queryKeys.test.ts` cobrindo as novas chaves, o escopo por identidade e o isolamento entre projetos
- [x] 1.3 Criar helper `invalidateTree(queryClient, userId, projectId)` em `lib/queryKeys.ts` (ou `features/board/hooks/`) para substituir o `refreshToken` do TreeView

## 2. Telas simples: ApiKeys, AdminUsers e Projects

- [x] 2.1 Migrar `apps/web/src/hooks/useApiKeys.ts` para `useQuery` com chave `apiKeys(userId)` e `AbortSignal`; mutações (criar/revogar) no padrão reconciliado com invalidação da chave
- [x] 2.2 Migrar `apps/web/src/pages/AdminUsersPage.tsx` para `useQuery` com chave `adminUsers(userId)` e `AbortSignal`; eliminar o `load()` imperativo e invalidar após cada mutação (criar/editar/excluir usuário)
- [x] 2.3 Migrar `apps/web/src/pages/ProjectsPage.tsx` para `useQuery` com chave `projects(userId)` e `AbortSignal`; remover o `useEffect` de `loadProjects` e o listener manual de `onAssistantMutation` (substituído pelo passo 5.1)
- [x] 2.4 Garantir que as mutações das telas do passo 2 sigam o padrão reconciliado de `optimistic-mutations` (sem cache divergente em falha, aviso ao usuário)

## 3. TreeView

- [x] 3.1 Migrar `apps/web/src/pages/TreeViewPage.tsx` para `useQuery` com chave `tree(userId, projectId)` e `AbortSignal`, eliminando `useState(tree)` + `useEffect` e o `refreshToken`/`setTreeRefreshToken` (linhas 295-328)
- [x] 3.2 Em `apps/web/src/features/board/BoardScreen.tsx`, substituir `setTreeRefreshToken` (linhas 509, 527) por `invalidateTree(...)` nos mesmos pontos de mutação que alteram hierarquia
- [x] 3.3 Criar/atualizar teste de contrato do TreeView: mutação de hierarquia invalida a consulta e a árvore é refeita sem token de refetch

## 4. Settings

- [x] 4.1 Migrar `apps/web/src/features/project-settings/hooks/useProjectSettingsData.ts` para `useQuery` (uma consulta por seção ou `useQueries`) com chaves `settings(userId, projectId, secao)` e `AbortSignal` em todas as requisições
- [x] 4.2 Migrar as mutações de `OrganizationSettingsSections.tsx` (colunas, membros, squads, centros de custo) para o padrão reconciliado com invalidação das chaves correspondentes, eliminando refetch manual pós-mutação
- [x] 4.3 Migrar as mutações de `DeliverySettingsSections.tsx` (módulos, sprints, versões) para o padrão reconciliado com invalidação das chaves correspondentes
- [x] 4.4 Migrar `GeneralSettingsSections.tsx` (planejamento/nome) para atualizar o cache a partir da resposta da mutação
- [x] 4.5 Validar isolamento por projeto: alternar de projeto durante o carregamento de Settings não deixa resposta antiga sobrescrever (cenário de cancelamento da spec `client-cache`)

## 5. Realtime e assistente

- [x] 5.1 Criar hook `useAssistantCacheInvalidation` que consome `onAssistantMutation` (`lib/dataEvents.ts`) e invalida as chaves afetadas em um ponto único; substituir o listener manual de `ProjectsPage.tsx:49`
- [x] 5.2 Estender `apps/web/src/lib/realtimeEvents.ts` com o mapeamento de `MODULE_CREATED` → invalidação das consultas de Settings/módulos, e ligar o handler na tela de Settings
- [x] 5.3 Garantir refetch no reconnect (transição `offline → synced`) para as consultas ativas das telas migradas, como já ocorre em Board/Dashboard

## 6. Contratos de teste e verificação

- [x] 6.1 Criar testes de contrato por tela migrada (padrão estrutural do repositório, sem DOM): cache por chave de identidade/projeto, `AbortSignal` para cancelamento por mudança de chave e invalidação/`applyProject` pós-mutação (`migrated-screens-cache-contract.test.ts`, `tree-cache-contract.test.ts`)
- [x] 6.2 Criar teste guarda que varre as telas migradas e falha se reaparecer `api.get` em `useEffect`/`load()` imperativo ou `refreshToken` fora da camada de cache
- [x] 6.3 Preservar os testes existentes do Item 17 (`lib/queryClient.test.ts`, `lib/queryKeys.test.ts`, `lib/realtimeEvents.test.ts`, `features/board/model/realtimeCache.test.ts`, `optimistic-mutations-contract.test.ts`) e rodar `bun run check` + `bun run test:smoke` sem regressões

## 7. Documentação e fechamento

- [x] 7.1 Atualizar `docs/ANALISE-SISTEMA.md` (item 17: registrar que a continuação migrou Settings, Projects, TreeView, AdminUsers e ApiKeys)
- [x] 7.2 Atualizar `docs/azyboard-wiki/04 - Board e Visualizacoes/Sincronizacao em Tempo Real.md` (corrigir a seção "Queda de conexão" e descrever as telas cobertas pelo cache)
- [x] 7.3 Registrar `Board ref: d7fc58f0-eab9-466a-9c82-fef29965109a` nos artefatos da change e concluir o card com `complete_task` após a verificação final
