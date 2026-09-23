## 1. Dependência e infraestrutura

- [x] 1.1 Adicionar `@tanstack/react-query` (MIT) em `apps/web/package.json` e instalar
- [x] 1.2 Criar `apps/web/src/lib/queryClient.ts` com defaults (`staleTime`, `gcTime`, `retry`, `refetchOnWindowFocus`) e um `QueryClient` único
- [x] 1.3 Criar `apps/web/src/lib/queryKeys.ts` com as chaves `board` e `dashboard` escopadas por identidade (`userId`) e `projectId` (dashboard inclui `qs`)
- [x] 1.4 Montar `QueryClientProvider` no topo do app (`App.tsx`/`main.tsx`) sem alterar a ordem dos providers existentes
- [x] 1.5 Limpar o cache no logout (`queryClient.clear()`) para evitar vazamento entre identidades

## 2. Cancelamento no cliente HTTP

- [x] 2.1 Permitir `options` (`RequestInit`) em `api.get`/`post`/`patch`/`delete`/`upload`, repassando `signal` ao `fetch`
- [x] 2.2 Garantir que `AbortError` seja tratado como cancelamento e não vire `ApiError`/toast

## 3. Migração do Board

- [x] 3.1 Migrar `features/board/hooks/useBoardData.ts` para `useQuery` com `boardKey`, passando `signal` a todas as chamadas do `Promise.all`
- [x] 3.2 Preservar os patches incrementais (`setQueryData` + `upsertItem`) para os eventos de alta frequência do board
- [x] 3.3 Substituir o refetch manual pós-mutação por invalidação da query do board
- [x] 3.4 Converter as mutações otimistas de `BoardScreen.tsx` (reorder, move, título) para `useMutation` com snapshot/rollback no cache, mantendo `createBoardInteractionHandler` puro e testável

## 4. Migração do Dashboard

- [x] 4.1 Migrar `ProjectDashboardPage.tsx` para `useQuery` com `dashboardKey` (incluindo a query string dos filtros) e `signal`
- [x] 4.2 Substituir `refreshToken` por `invalidateQueries` e configurar revalidação no foco
- [x] 4.3 Preservar o status por box (loading/ready/error) a partir do estado da query

## 5. Integração WebSocket

- [x] 5.1 Mapear tipos de evento para chaves de cache (incremental no board, invalidação no dashboard) em um módulo testável
- [x] 5.2 Refazer as consultas ativas do projeto quando a conexão voltar a `synced` após queda (refetch no reconnect)
- [x] 5.3 Não alterar o backoff/reconexão do `useWebSocket` (fora de escopo)

## 6. Bundle

- [x] 6.1 Isolar `@tanstack/react-query` em `vendor-query` no `manualChunks` (`vite.config.ts`)
- [x] 6.2 Adicionar a entrada `vendor-query` ao `apps/web/bundle-budget.json` com folga medida
- [x] 6.3 Rodar `bun run check:bundle` e garantir que nenhum chunk (inclusive `index`) estourou

## 7. Testes

- [x] 7.1 Teste de unidade das chaves de cache (board/dashboard, isolamento por projeto e identidade)
- [x] 7.2 Teste de unidade do mapeamento evento→cache (incremental vs invalidação)
- [x] 7.3 Teste de comportamento do cancelamento: consulta obsoleta não sobrescreve o estado e cancelamento não é erro
- [x] 7.4 Teste de rollback de mutação otimista no cache
- [x] 7.5 Contratos textuais: `useBoardData` usa a camada de cache e mantém `useWebSocket`/`upsertItem`; `ProjectDashboardPage` usa a camada
- [x] 7.6 Preservar `board-realtime-contract.test.ts`, `board-interaction.test.ts` e `frontend-page-modularity-contract.test.ts`

## 8. Documentação e verificação

- [x] 8.1 Marcar o item 17 em `docs/ANALISE-SISTEMA.md` como resolvido (piloto Board + Dashboard) com o `Board ref: 4e2ba2a8-3cfe-4e38-9cda-7d794075061b`
- [x] 8.2 Rodar `bun run check` (typecheck + lint + testes + build)
- [x] 8.3 Rodar `bun run test:smoke`
- [x] 8.4 Validar a change com `openspec validate add-client-cache-sync`
- [x] 8.5 Encerrar o card no Azy Board com `complete_task` e confirmar status `DONE`
