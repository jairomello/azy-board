## 1. Cliente HTTP (`apps/web/src/lib/api.ts`)

- [x] 1.1 Adicionar `retryable` a `ApiError` (default `false`) e ler `error.retryable` do envelope no parse de erro
- [x] 1.2 Normalizar timeout e falha de rede como `ApiError` com código estável, sem transformar `AbortError` do chamador em `ApiError`
- [x] 1.3 Implementar timeout por requisição (constante padrão exportada + opção por chamada) combinando o sinal do chamador com `AbortSignal.timeout`/`AbortSignal.any`, com fallback via `AbortController`
- [x] 1.4 Implementar retry no `request()`: máximo 1 tentativa, apenas `GET`/`PUT`/`DELETE` e `retryable === true`, com backoff curto; nunca retentar `POST`/`PATCH`, cancelamentos ou `retryable: false`
- [x] 1.5 Alterar `api.delete` para `delete<T>(path, body?, options?)`, serializando corpo JSON quando informado e mantendo cookie/headers/erro/timeout/retry
- [x] 1.6 Verificar call sites de `api.delete`: nenhum passava `RequestInit` no segundo argumento, então a nova assinatura não quebrou consumidores

## 2. Política de cache (`apps/web/src/lib/queryClient.ts`)

- [x] 2.1 Política de retry das queries não duplica o retry do cliente: não retentar `ApiError` (o cliente já aplicou `retryable`) nem abortos; erros inesperados não-ApiError mantêm 1 tentativa
- [x] 2.2 Garantir que não haja retry duplicado entre cliente e `queryClient` (cliente cobre idempotência; `queryClient` não repete `ApiError`)

## 3. Migrar chamadas diretas (`ProjectSettingsScreen.tsx`)

- [x] 3.1 Migrar `deleteColumn` para `api.delete` com corpo `{ moveToColumnId }` e só atualizar o estado local após sucesso, propagando erro em falha
- [x] 3.2 Migrar `deleteSquad` para `api.delete` com corpo `{ confirm: true }`, atualizando estado apenas em sucesso
- [x] 3.3 Migrar `deleteModule` para `api.delete` com corpo `{ targetModuleId }` ou `{ cascade: true }`, atualizando estado apenas em sucesso
- [x] 3.4 Migrar `checkDeleteModule` para `api.delete` tratando o 409 como "requer confirmação" via `ApiError.status`
- [x] 3.5 Remover os quatro `fetch` diretos; usar `runDeleteMutation` + `toast` para erros e chaves i18n nos 3 idiomas

## 4. Testes

- [x] 4.1 Ampliar `apps/web/src/lib/api.test.ts`: body em DELETE, `retryable` em `ApiError`, timeout abortando e retry apenas em método idempotente + `retryable`
- [x] 4.2 Criar teste de contrato `scripts/check-web-http-client.test.ts` que varre o runtime de `apps/web/src` (excluindo `*.test.ts` e `lib/api.ts`) e falha ao encontrar `fetch(` ou `XMLHttpRequest`
- [x] 4.3 Ajustar `client-cache-contract.test.ts` para a nova assinatura `ApiRequestOptions extends RequestInit`
- [x] 4.4 Adicionar teste de `runDeleteMutation` cobrindo falha (estado preservado) e sucesso (estado atualizado)

## 5. Verificação

- [x] 5.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir o que aparecer
- [x] 5.2 Rodar `bun run test:smoke`
