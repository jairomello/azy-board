## ADDED Requirements

### Requirement: Cliente HTTP único
Todo acesso HTTP de runtime no web SHALL passar pelo cliente em `apps/web/src/lib/api.ts`. Código de runtime (fora de testes) SHALL NOT chamar `fetch` diretamente nem usar `XMLHttpRequest`. Canais que não são HTTP (WebSocket e EventSource) são exceções explícitas.

#### Scenario: Chamada de runtime usa o cliente
- **WHEN** um componente, hook ou página precisa falar com a API
- **THEN** usa `api.get`, `api.post`, `api.patch`, `api.delete` ou `api.upload`, herdando cookies de sessão, normalização de erro, timeout, retry e cancelamento

#### Scenario: `fetch` direto em runtime é barrado
- **WHEN** um teste de contrato varre o código de runtime (excluindo `*.test.ts` e o próprio `lib/api.ts`) em busca de `fetch(`
- **THEN** nenhuma ocorrência é encontrada e o teste passa; uma nova ocorrência falha o teste

### Requirement: Suporte a corpo em DELETE
`api.delete` SHALL aceitar um corpo opcional tipado, serializado como JSON, mantendo `credentials: 'include'`, `Content-Type: application/json`, normalização de erro, timeout, retry e cancelamento.

#### Scenario: Exclusão com payload
- **WHEN** uma exclusão precisa enviar dados (por exemplo, mover cards para outra coluna antes de remover a coluna)
- **THEN** `api.delete(path, { moveToColumnId })` envia `DELETE` com corpo JSON e o cookie de sessão, sem `fetch` direto

#### Scenario: Exclusão sem payload
- **WHEN** a exclusão não precisa de corpo
- **THEN** `api.delete(path)` funciona como antes, sem corpo

### Requirement: Normalização e propagação de erro
O cliente SHALL lançar `ApiError` para toda resposta não bem-sucedida, expondo `status`, `code`, `details` e `retryable`. O campo `retryable` do envelope único de erro SHALL ser preservado. Cancelamento por `AbortSignal` SHALL continuar sendo `AbortError`, e não `ApiError`.

#### Scenario: Envelope de erro preserva retryable
- **WHEN** a API responde com `{ "error": { "code", "message", "retryable", "details" } }`
- **THEN** o erro lançado é `ApiError` com `code`, `details` e `retryable` correspondentes

#### Scenario: Cancelamento não é erro de domínio
- **WHEN** a requisição é cancelada via `AbortSignal`
- **THEN** o `AbortError` sobe intacto e `isAbortError` retorna verdadeiro, sem virar `ApiError`

### Requirement: Timeout por requisição
Toda requisição SHALL ter um timeout (padrão configurável e sobreponível por chamada). Ao estourar o timeout, a requisição SHALL ser abortada e SHALL lançar `ApiError` com código estável de timeout.

#### Scenario: Requisição lenta é abortada
- **WHEN** o servidor não responde dentro do timeout configurado
- **THEN** a requisição é abortada e o chamador recebe `ApiError` identificável como timeout, distinta de cancelamento do usuário

#### Scenario: Timeout sobreponível
- **WHEN** uma operação legitimamente longa precisa de mais tempo
- **THEN** a chamada pode informar um timeout maior, e o padrão é usado apenas quando não informado

### Requirement: Retry automático governado por retryable
O cliente SHALL repetir requisições apenas quando o método for idempotente (`GET`, `PUT`, `DELETE`) e o erro indicar `retryable: true`, respeitando um número máximo de tentativas e um pequeno backoff. Requisições não idempotentes (`POST`, `PATCH`), cancelamentos e erros `retryable: false` SHALL NOT ser repetidos automaticamente.

#### Scenario: Falha transitória idempotente é repetida
- **WHEN** um `GET`/`DELETE` falha com `retryable: true` e ainda há tentativas disponíveis
- **THEN** o cliente repete a requisição e, em sucesso, resolve normalmente

#### Scenario: Erro permanente não é repetido
- **WHEN** a resposta indica `retryable: false` (autorização, validação ou conflito de domínio)
- **THEN** o cliente lança `ApiError` imediatamente, sem nova tentativa

#### Scenario: POST não é repetido
- **WHEN** um `POST` ou `PATCH` falha com `retryable: true`
- **THEN** o cliente não repete automaticamente, para não duplicar efeitos colaterais

#### Scenario: Cancelamento não é repetido
- **WHEN** a requisição é cancelada pelo chamador
- **THEN** o cliente não tenta novamente

### Requirement: Cancelamento preservado em todos os métodos
O cliente SHALL repassar o `AbortSignal` do chamador em todos os métodos, inclusive `DELETE` com corpo e `upload`.

#### Scenario: Signal chega ao transporte
- **WHEN** o chamador passa `{ signal }` para qualquer método do cliente
- **THEN** o sinal é repassado ao `fetch` e o cancelamento interrompe a requisição

### Requirement: Falha de mutação não é mascarada
Chamadas de mutação no web SHALL tratar a rejeição do cliente e SHALL NOT atualizar o estado local como se tivesse havido sucesso quando a resposta não for bem-sucedida.

#### Scenario: Exclusão de coluna rejeitada mantém a coluna
- **WHEN** a exclusão de uma coluna falha no servidor
- **THEN** o erro é propagado ao usuário e a coluna permanece no estado local, sem remoção indevida

#### Scenario: Exclusão bem-sucedida atualiza o estado
- **WHEN** a exclusão de coluna, squad ou módulo é confirmada pelo servidor
- **THEN** o estado local é atualizado após o sucesso
