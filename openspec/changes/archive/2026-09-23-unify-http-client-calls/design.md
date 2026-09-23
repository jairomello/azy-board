## Context

O web tem um cliente HTTP comum em `apps/web/src/lib/api.ts` que centraliza `credentials: 'include'`, `Content-Type`, tratamento de sessão expirada (401), normalização de erro via `ApiError` e repasse de `AbortSignal`. Boa parte do app usa esse cliente, e `queryClient.ts` concentra a política de cache/retry das queries.

Ainda assim, `apps/web/src/features/project-settings/ProjectSettingsScreen.tsx` faz quatro `fetch` diretos (`:33`, `:36`, `:46`, `:47`) para excluir coluna, squad e módulo. O handler de coluna (`:33`) não verifica `res.ok` e não envia `credentials: 'include'`: a UI remove a coluna mesmo se o servidor recusar, e a sessão expirada não é tratada. Além disso, `api.delete` não oferece corpo de primeira classe, o que força o `fetch` direto; e `ApiError` descarta o campo `retryable` do envelope único de erro.

O envelope `{ error: { code, message, retryable, details } }` já é emitido pela API (`apps/api/src/middleware/errorResponse.ts`) e está especificado em `unified-error-contract`. O gap é de consumo no cliente, não de backend.

## Goals / Non-Goals

**Goals:**
- Garantir que toda chamada HTTP de runtime passe pelo cliente comum, verificado por teste de contrato.
- Oferecer `body` tipado em `api.delete`.
- Preservar `retryable`/`code`/`details` em `ApiError` e usá-los para decidir retry.
- Adicionar timeout configurável e retry seguro por método, sem retentar cancelamentos nem métodos não idempotentes.
- Migrar as quatro chamadas diretas e corrigir a atualização indevida de estado na exclusão de coluna.

**Non-Goals:**
- Migrar Settings/Projects/TreeView/AdminUsers/ApiKeys para a camada de cache e `useMutation` — isso é o card T6 / capability `client-cache`.
- Alterar o backend ou o formato do envelope de erro.
- Substituir o cliente por uma biblioteca externa (axios/ky).
- Cobrir WebSocket (`useWebSocket`) e SSE (`AzyAgentDrawer`), que não são HTTP.

## Decisions

### D1. Estender `lib/api.ts`, não trocar de biblioteca
O cliente atual já resolve cookies de sessão, 401 e normalização de erro e tem testes. Introduzir axios/ky adicionaria dependência e reescreveria chamadas sem ganho proporcional. Mantemos `lib/api.ts` como única porta HTTP e evoluímos sua API.
- Alternativas: axios (dependência extra, licença ok), ky (idem). Rejeitadas por custo/benefício.

### D2. `api.delete<T>(path, body?, options?)`
O segundo argumento passa a ser o corpo opcional, e `options` (com `signal`) vai para o terceiro. Isso torna o caso de uso real (exclusão com payload) natural e mantém `api.delete(path)` inalterado para os demais consumidores. A mudança de assinatura é **BREAKING** apenas internamente e será coberta por `typecheck` nos ~10 call sites existentes.
- Alternativa: `api.delete(path, { body, ...options })` — mais verboso e sujeito a confundir `body` com opções.

### D3. Timeout com `AbortSignal.timeout` + `AbortSignal.any`
Cada requisição recebe um timeout padrão (constante exportada, ex.: 15s), sobreponível por chamada. Combinamos o sinal do chamador com o de timeout via `AbortSignal.any`, abortando o `fetch`. Para distinguir timeout de cancelamento, marcamos o motivo: timeout vira `ApiError` com código estável (`TIMEOUT`), enquanto cancelamento do chamador continua `AbortError`. Fallback com `AbortController` manual caso o ambiente não suporte `AbortSignal.any`.
- Alternativa: timeout só no `queryClient` — não cobre mutações nem chamadas fora de query.

### D4. Retry no cliente, restrito a métodos idempotentes
O retry das queries já vive no `queryClient`; mutações não passam por lá. Para uniformizar, o retry passa a viver no `request()`: no máximo 1 nova tentativa, apenas para `GET`/`PUT`/`DELETE` e apenas quando `ApiError.retryable === true`, com pequeno backoff. `POST`/`PATCH`, cancelamentos e `retryable: false` nunca são repetidos. O `queryClient` mantém sua política para queries (e passa a considerar `retryable`), evitando duplicação de tentativas.
- Alternativa: retry só no `queryClient` — deixaria mutações sem retry e não cumpriria o card.

### D5. `ApiError` ganha `retryable`
Adicionamos `readonly retryable: boolean` (default `false`) ao construtor, preservando a compatibilidade das chamadas existentes. O parse do envelope passa a ler `error.retryable`. Erros de rede/timeout são normalizados para `ApiError` com `retryable` coerente.
- Alternativa: manter `retryable` só no corpo cru — descartaria o contrato único no ponto de consumo.

### D6. Teste de contrato proíbe `fetch` direto em runtime
Um teste varre os arquivos de `apps/web/src` (excluindo `*.test.ts` e `lib/api.ts`) e falha ao encontrar `fetch(` ou `XMLHttpRequest`. `new WebSocket(` e `new EventSource(` são permitidos explicitamente. Serve de gate contra regressão do problema.
- Alternativa: só revisão manual/ESLint — menos confiável e o projeto ainda não tem ESLint real.

### D7. Fronteira com o card T6
Aqui só migramos o transporte HTTP; não introduzimos `useMutation` nem chaves de cache para Settings. Isso evita sobreposição com o card T6 e mantém a change pequena e revisável.

## Risks / Trade-offs

- **Retry em `DELETE` com efeito colateral** (ex.: `moveToColumnId`) pode repetir a operação. → Só repetimos com `retryable: true` (a API marca conflitos de domínio como `false`) e no máximo 1 tentativa; o servidor deve tratar exclusão como idempotente.
- **Timeout derrubar operações legitimamente longas** (uploads, runs longos do agente). → Timeout sobreponível por chamada e `upload` com timeout maior/desativado; default generoso.
- **`AbortSignal.any` indisponível em navegadores antigos**. → Fallback com `AbortController` manual.
- **Mudança de assinatura de `delete` quebrar call sites**. → `typecheck` cobre os ~10 pontos; ajuste mecânico.
- **Teste de contrato com falso positivo** em strings/comentários ou em testes. → Excluir `*.test.ts` e `lib/api.ts`; permitir explicitamente WebSocket/EventSource; a varredura considera apenas código de runtime.
- **Duplicar retry com o `queryClient`**. → Política única: cliente para mutações/idempotência, `queryClient` para queries; ambos passam a olhar `retryable` e a nunca retentar abortos.

## Migration Plan

- Mudança em um único PR, sem migration de banco e sem alteração de backend.
- Ordem: (1) evoluir `lib/api.ts` (delete com body, `retryable`, timeout, retry); (2) ajustar `queryClient.ts`; (3) migrar as quatro chamadas de `ProjectSettingsScreen.tsx`; (4) testes (unitários + contrato).
- Verificação: `bun run check` (typecheck + lint + testes + build) e `bun run test:smoke`.
- Rollback: reverter o PR; nenhum dado ou schema é afetado.

## Open Questions

- Valor default do timeout e se `upload` deve ficar isento.
- Número máximo de tentativas e backoff (proposta: 1 tentativa, 150–300ms).
