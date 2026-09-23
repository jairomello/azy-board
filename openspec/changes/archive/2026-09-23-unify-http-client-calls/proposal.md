## Why

Nem toda chamada HTTP do frontend passa pelo cliente comum `lib/api.ts`. Em `ProjectSettingsScreen.tsx` há quatro `fetch` diretos, e o handler de exclusão de coluna ignora `res.ok` — a UI remove a coluna mesmo quando o servidor rejeita. Como essas chamadas também não enviam `credentials: 'include'`, não recebem o tratamento uniforme de sessão expirada, erro, retry, timeout e cancelamento que o resto do app usa.

## What Changes

- Toda chamada HTTP de runtime do web passa a usar exclusivamente `lib/api.ts`; `fetch` direto em código de runtime deixa de ser permitido (garantido por teste de contrato).
- `api.delete` passa a aceitar `body` tipado de primeira classe (necessário para exclusão de coluna, squad e módulo com payload).
- `ApiError` passa a preservar e expor `retryable` do envelope único de erro, além de `code` e `details`.
- O cliente passa a aplicar **timeout** configurável por requisição (com cancelamento via `AbortSignal`) e uma política de **retry** baseada em `retryable`/método idempotente, sem retentar cancelamentos.
- As quatro chamadas diretas de `ProjectSettingsScreen.tsx` são migradas para o cliente; a exclusão de coluna só atualiza o estado local após resposta de sucesso, com rollback/erro padronizado em falha.
- **BREAKING** (interno): `api.delete` ganha assinatura com `body` opcional; consumidores existentes que passavam `RequestInit` no segundo argumento são ajustados.

## Capabilities

### New Capabilities
- `web-api-client`: cliente HTTP único do web — transporte, headers/cookies, normalização de erro (incluindo `retryable`), timeout, retry, cancelamento e suporte a body em `DELETE`, com uso obrigatório por todo código de runtime.

### Modified Capabilities
- `unified-error-contract`: o cliente web passa a consumir o envelope único preservando `retryable` e `code`, usando `retryable` para decidir retry.

## Impact

- Código: `apps/web/src/lib/api.ts`, `apps/web/src/lib/queryClient.ts`, `apps/web/src/features/project-settings/ProjectSettingsScreen.tsx`.
- Testes: `apps/web/src/lib/api.test.ts` (body em DELETE, timeout, retry), novo teste de contrato proibindo `fetch` direto em runtime, ajustes em `client-cache-contract.test.ts`.
- Contratos: nenhuma mudança no backend; o envelope `{ error: { code, message, retryable, details } }` já existe.
- Fora de escopo: migração das telas para a camada de cache/`useMutation` (tratada no card T6 / capability `client-cache`). Aqui o foco é a camada de transporte HTTP.

Board ref: d084353c-7750-45aa-a13d-175ca9484948
