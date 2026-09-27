## Why

A change `add-client-cache-sync` (card Item 17) criou a camada de cache TanStack Query e migrou apenas Board e Dashboard. As demais telas de dados — Settings, Projects, TreeView, AdminUsers e ApiKeys — continuam com `useState`/`useEffect` + `api.get` manual, sem cache, sem `AbortSignal` e com refetch imperativo (`refreshToken` em `TreeViewPage.tsx:295-328`, `load()` em `AdminUsersPage.tsx:18-20`), reproduzindo exatamente as corridas de resposta antiga sobrescrevendo estado novo que o item 17 da análise de sistema denuncia. É a continuação prevista em `docs/ANALISE-SISTEMA.md:459` (card "Item 17 (continuação)").

## What Changes

- Migrar **Settings** (`useProjectSettingsData.ts` + seções de configuração), **Projects**, **TreeView**, **AdminUsers** e **ApiKeys** (`useApiKeys.ts`) para a camada de cache existente (`lib/queryClient.ts`), com chaves em `lib/queryKeys.ts`.
- Eliminar os mecanismos de refetch imperativo: `refreshToken`/`setTreeRefreshToken` do TreeView e `load()` repetidos de AdminUsers/ApiKeys/Projects — substituídos por invalidação/revalidação do cache.
- Cancelamento automático com `AbortSignal` em todas as consultas migradas (troca de projeto, filtros e desmontagem).
- Invalidação por eventos WebSocket nas telas migradas quando houver evento correspondente (ex.: `MODULE_CREATED` invalida Settings) e refetch no reconnect, como já ocorre em Board/Dashboard.
- Aplicar a política única de mutação (`optimistic-mutations`) às mutações das telas migradas, com rollback ou reconciliação — sem divergência de cache.
- Testes de contrato: nenhuma tela de dados busca estado remoto fora da camada de cache; isolamento por identidade/projeto; cancelamento e invalidação por evento nas telas migradas.
- Atualização de `docs/ANALISE-SISTEMA.md` (fechar a continuação do item 17) e da wiki desatualizada sobre sincronização.

## Capabilities

### New Capabilities
<!-- Nenhuma. A camada `client-cache` já existe; esta change amplia sua cobertura. -->

### Modified Capabilities
- `client-cache`: a camada única de cache passa a ser obrigatória em **todas** as telas de dados (não só no piloto Board/Dashboard), com cenários para eliminação de refetch imperativo e para invalidação/refetch das telas migradas por eventos WebSocket e reconexão.
- `optimistic-mutations`: a política única de mutação deixa de valer só para o board e passa a valer para as mutações das telas de dados migradas.

## Impact

- **Web (telas):** `features/project-settings/hooks/useProjectSettingsData.ts`, `features/project-settings/ProjectSettingsScreen.tsx` e `components/{Organization,Delivery,General}SettingsSections.tsx`; `pages/ProjectsPage.tsx`; `pages/TreeViewPage.tsx`; `pages/AdminUsersPage.tsx`; `hooks/useApiKeys.ts`; `pages/AccountPage.tsx` (seção de API keys).
- **Web (infra):** `lib/queryKeys.ts` (novas chaves: settings, projects, tree, adminUsers, apiKeys — mantida a raiz `['auth', userId, 'project', projectId, ...]`); `lib/realtimeEvents.ts` (mapeamento de eventos de metadados → invalidação).
- **Web (integração):** `features/board/BoardScreen.tsx` remove `setTreeRefreshToken`; `hooks/useWebSocket.ts` pode receber handlers adicionais por tela.
- **Testes:** novos contratos em `apps/web/src/` (cobertura das telas, cancelamento, invalidação por evento); preservar os testes existentes do Item 17 (`client-cache-contract.test.ts`, `lib/*.test.ts`, `optimistic-mutations-contract.test.ts`).
- **Docs:** `docs/ANALISE-SISTEMA.md` (item 17), `docs/azyboard-wiki/04 - Board e Visualizacoes/Sincronizacao em Tempo Real.md`.
- **Rastreabilidade:** Board ref: d7fc58f0-eab9-466a-9c82-fef29965109a (card "Item 17 (continuação): migrar cache/sincronização para as demais telas de dados").
- **Fora de escopo:** novos eventos WebSocket no servidor (item 20 segue aberto); replay/cursor de eventos; cache offline/persistente; componentes de apoio do card (ActivityLogPanel, WorkLogPanel, ChecklistSection etc.), que podem vir em change posterior; mudança de comportamento visível ao usuário além da atualização mais consistente dos dados.
