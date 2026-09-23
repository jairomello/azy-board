## Context

O web não tem camada de cache: `lib/api.ts` faz `fetch` direto (sem `AbortSignal`), cada tela mantém `useState` próprio e refaz GET manualmente. Fatos que restringem o design:

- **Corridas reais** em `useBoardData.ts:47-80`, `useProjectSettingsData.ts:33-79` e `ProjectDashboardPage.tsx:28-36`: efeitos keyed por `projectId`/filtros com escritas incondicionais e nenhum cancelamento.
- **Sem biblioteca de cache/estado** no `apps/web/package.json` (apenas React Router e i18next).
- **WebSocket** (`hooks/useWebSocket.ts`) não refaz fetch no reconnect, apesar de `realtime-sync/spec.md:32-34` exigir; o Dashboard usa um `refreshToken` manual e o Board aplica patches incrementais com `upsertItem` (coberto por `board-realtime-contract.test.ts`).
- **Orçamento de bundle apertado** (`bundle-budget.json`; `index` 90 KB gzip) e gate no CI (`check-bundle.ts`); `manualChunks` isola apenas react, charts e editor.
- **Testes** são majoritariamente contratos textuais (leem o fonte) e o único teste de comportamento injeta `patch` (`board-interaction.test.ts`); não há testing-library.
- Identidade é global por e-mail; o `User` do web não expõe `tenantId`.

## Goals / Non-Goals

**Goals:**

- Uma única fonte de verdade para estado remoto, com chaves por identidade/projeto.
- Cancelamento automático e descarte de respostas obsoletas quando parâmetros mudam.
- Invalidação/atualização por eventos WebSocket e refetch no reconnect.
- Migrar as telas **Board** e **Dashboard** como piloto, sem regressão de UX (patches incrementais do board preservados).
- Manter o bundle dentro do orçamento.

**Non-Goals:**

- Migrar Settings, Projects, TreeView, AdminUsers e ApiKeys (changes seguintes reutilizam a camada).
- Cache no servidor, persistência offline, service worker.
- Substituir o WebSocket ou corrigir o backoff de reconexão (item 20).
- Expor `tenantId` no `User` do web (escopo por identidade cobre o isolamento).

## Decisions

### Decisão 1 — TanStack Query como camada, isolada em vendor chunk

Adotar `@tanstack/react-query` (MIT) em vez de uma camada interna: entrega cache por chave, `staleTime`/`gcTime`, dedupe, `signal` por query, retry e invalidação prontos. A alternativa interna foi descartada por reimplementar (com risco de bugs) exatamente esses comportamentos. A lib é isolada em `vendor-query` via `manualChunks` e recebe entrada própria no `bundle-budget.json`, preservando os limites dos chunks existentes.

### Decisão 2 — Chaves escopadas por identidade e projeto

`lib/queryKeys.ts` centraliza as chaves com raiz na identidade autenticada e no projeto:

- `board`: `['auth', userId, 'project', projectId, 'board']`
- `dashboard`: `['auth', userId, 'project', projectId, 'dashboard', qs]`

`userId` é a identidade global (implica o tenant) e evita vazamento entre contas no mesmo browser. No logout, `queryClient.clear()` remove tudo. Alternativa de usar `tenantId` exigiria alterar o contrato de `/auth/me`; mantido fora de escopo.

### Decisão 3 — `AbortSignal` no cliente `api`

`request` já repassa `RequestInit` ao `fetch`; a superfície passa a aceitar `options` (`api.get(path, { signal })`). O `queryFn` recebe `signal` do TanStack Query e o repassa a todas as chamadas do `Promise.all`, de modo que trocar `projectId`/filtros aborta as requisições antigas. `AbortError` é tratado como cancelamento (não vira toast/erro).

### Decisão 4 — Board mantém patches incrementais; Dashboard invalida

O board preserva `setQueryData` + `upsertItem` nos eventos de alta frequência (CARD_MOVED, ITEM_CREATED/UPDATED/DELETED, etc.), mantendo a UX atual e o contrato testado. Eventos mais estruturais e o Dashboard usam `invalidateQueries` (refetch coerente). No **reconnect** (`status` volta a `synced` após offline), invalida-se a query ativa do projeto para reconciliar mudanças perdidas.

### Decisão 5 — Mutações otimistas com rollback no cache

As operações do board passam a usar `useMutation` com `onMutate` (snapshot + `setQueryData` otimista), `onError` (rollback do snapshot) e `onSettled` (invalidate). A função pura `createBoardInteractionHandler` é preservada e recebe um `patch` que executa a mutação, mantendo `board-interaction.test.ts` válido.

### Decisão 6 — Política de stale/refetch explícita

`lib/queryClient.ts` define defaults: `staleTime` 30s, `gcTime` 5min, `retry` 1, `refetchOnWindowFocus` desligado. Board usa `staleTime` moderado (WS mantém fresco); Dashboard usa `staleTime` curto e `refetchOnWindowFocus` ligado (comportamento atual de refetch no foco).

## Risks / Trade-offs

- [Dependência nova estoura o orçamento de bundle] → isolar em `vendor-query`, medir com `bun run check:bundle` e definir limite com folga; não alterar limites dos chunks existentes.
- [StrictMode monta efeitos duas vezes e duplica fetch] → TanStack Query deduplica por chave; validar com teste de comportamento.
- [Regressão na sincronização do board] → preservar `upsertItem`/contrato textual e adicionar teste de invalidação por evento e no reconnect.
- [`AbortError` aparecendo como erro para o usuário] → filtrar cancelamento no `api` e no `retry`/`onError`.
- [Vazamento de cache entre contas] → raiz por `userId` + `queryClient.clear()` no logout.
- [Rollback otimista incompleto] → limitar às operações já cobertas por teste e usar snapshot do cache.

## Migration Plan

1. Adicionar `@tanstack/react-query`, `manualChunks` `vendor-query` e entrada no orçamento; medir.
2. Criar `lib/queryClient.ts`, `lib/queryKeys.ts` e `AbortSignal` no `api`; montar `QueryClientProvider` no topo do app e `clear()` no logout.
3. Migrar `useBoardData` para `useQuery` + patches incrementais e mutações otimistas; migrar `ProjectDashboardPage` para `useQuery` + invalidação.
4. Integrar WebSocket (invalidação por evento e refetch no reconnect).
5. Verificar: `bun run check`, `bun run check:bundle`, `bun run test:smoke`; atualizar o item 17 da análise.
6. Rollback: remover o provider e reverter as duas telas (mudança isolada ao web; sem migration de banco).

## Open Questions

- Granularidade futura da invalidação no Dashboard (por box vs tudo) fica para a migração completa das telas.
- Se o `User` do web deve passar a expor `tenantId` para chaves explícitas por tenant (avaliar junto com as telas restantes).
