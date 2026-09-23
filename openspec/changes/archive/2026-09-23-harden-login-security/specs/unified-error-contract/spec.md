## MODIFIED Requirements

### Requirement: Semântica estável de retry
Cada erro SHALL indicar explicitamente se repetir a operação pode ter sucesso usando `retryable`, e o valor SHALL ser determinado pelo código de erro, não por cada handler individualmente. Respostas HTTP 429 SHALL incluir o header `Retry-After` com o tempo, em segundos, após o qual a operação pode ser repetida.

#### Scenario: Falha transitória
- **WHEN** uma dependência temporariamente indisponível produz erro conhecido
- **THEN** a resposta usa código de indisponibilidade, status apropriado e `retryable: true`

#### Scenario: Falha permanente de domínio
- **WHEN** a operação é recusada por autorização, validação ou conflito de domínio
- **THEN** a resposta usa `retryable: false`

#### Scenario: Rate limit informa quando repetir
- **WHEN** uma requisição é recusada por rate limit (HTTP 429)
- **THEN** a resposta inclui o header `Retry-After` com o tempo até a nova tentativa, e `retryable: true`
