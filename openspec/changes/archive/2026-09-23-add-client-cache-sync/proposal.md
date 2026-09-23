## Why

Cada tela do web busca dados com `api.get`, guarda o resultado em `useState` local e decide manualmente quando recarregar, sem cache nem cancelamento. Isso produz corridas reais quando `projectId`/filtros mudam — `useBoardData.ts:47-80`, `useProjectSettingsData.ts:33-79`, `ProjectDashboardPage.tsx:28-36` — respostas antigas sobrescrevem estado novo, não há `AbortController` em lugar nenhum e o board não refaz o fetch no reconnect do WebSocket, apesar de a spec `realtime-sync` exigir. É o item 17 da análise de sistema.

## What Changes

- Adotar **TanStack Query** (MIT) como camada de cache/sincronização do estado remoto, com `QueryClientProvider` no topo do app.
- Chaves de cache escopadas por **tenant e projeto**, evitando vazamento de dados entre projetos/tenants.
- Suporte a **`AbortSignal`** no cliente `api` e cancelamento automático quando parâmetros mudam, com descarte de respostas obsoletas.
- **Invalidação/atualização por eventos WebSocket** e **refetch no reconnect**, fechando a lacuna da spec `realtime-sync`.
- Migração **piloto das telas Board e Dashboard** para a camada; estado remoto separado do estado de UI; mutações com atualização otimista e rollback via cache.
- Isolamento de TanStack Query em **vendor chunk** e atualização do **orçamento de bundle**.

## Capabilities

### New Capabilities
- `client-cache`: cache de estado remoto no web (provider, chaves por tenant/projeto, cancelamento, stale/refetch, dedupe, invalidação por WebSocket e rollback de mutações otimistas).

### Modified Capabilities
<!-- Nenhuma. A spec `realtime-sync` já exige refetch no reconnect; esta change implementa o requisito. -->

## Impact

- **Web (dependência):** `apps/web/package.json` (`@tanstack/react-query`, MIT), `vite.config.ts` (`manualChunks` `vendor-query`), `apps/web/bundle-budget.json`.
- **Web (infra):** novo `apps/web/src/lib/queryClient.ts` e `lib/queryKeys.ts`; provider em `App.tsx`/`main.tsx`; `lib/api.ts` com `AbortSignal`.
- **Web (telas piloto):** `features/board/hooks/useBoardData.ts` e `features/board/BoardScreen.tsx`; `pages/ProjectDashboardPage.tsx`.
- **Web (realtime):** `hooks/useWebSocket.ts` (refetch/invalidação no reconnect) e mapeamento evento→chaves.
- **Testes:** novos testes de unidade/contrato para chaves de cache, cancelamento, invalidação por evento e política de stale; preservar `board-realtime-contract.test.ts` e `board-interaction.test.ts`.
- **Docs:** `docs/ANALISE-SISTEMA.md` (item 17).
- **Rastreabilidade:** Board ref: 4e2ba2a8-3cfe-4e38-9cda-7d794075061b (card "Item 17: Não há camada consistente de cache e sincronização").
- **Fora de escopo:** migrar Settings, Projects, TreeView, AdminUsers e ApiKeys (ficam para changes seguintes, reutilizando a camada); cache no servidor; persistência offline; substituir o WebSocket.
