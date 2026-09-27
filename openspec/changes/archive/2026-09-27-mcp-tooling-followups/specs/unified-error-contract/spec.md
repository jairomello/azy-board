## MODIFIED Requirements

### Requirement: Semântica estável de retry

Cada erro SHALL indicar explicitamente se repetir a operação pode ter sucesso usando `retryable`, e o valor SHALL ser determinado pelo código de erro, não por cada handler individualmente. Respostas HTTP 429 SHALL incluir o header `Retry-After` com o tempo, em segundos, após o qual a operação pode ser repetida. Clientes MCP SHALL distinguir falha de parsing local da chamada, que pode ter uma única repetição isolada, de erro retornado pela API.

#### Scenario: Falha transitória

- **WHEN** uma dependência temporariamente indisponível produz erro conhecido
- **THEN** a resposta usa código de indisponibilidade, status apropriado e `retryable: true`

#### Scenario: Falha permanente de domínio

- **WHEN** a operação é recusada por autorização, validação ou conflito de domínio
- **THEN** a resposta usa `retryable: false` e o cliente não repete automaticamente

#### Scenario: Rate limit informa quando repetir

- **WHEN** uma requisição é recusada por rate limit (HTTP 429)
- **THEN** a resposta inclui o header `Retry-After` com o tempo até a nova tentativa, e `retryable: true`

#### Scenario: Parsing local tem retry limitado

- **WHEN** o cliente não consegue serializar os argumentos antes de executar a ferramenta
- **THEN** pode repetir a chamada isoladamente uma vez, sem alterar a semântica de retry da API

### Requirement: Consumo do envelope pelos clientes

Os clientes do contrato de erro (web, MCP e Azy Agent) SHALL consumir `code`, `retryable` e `details` do envelope ao tratar falhas, usando `retryable` para decidir repetição e SHALL NOT inferir repetibilidade apenas do status HTTP. Mensagens de validação SHALL preservar caminho, causa e forma mínima quando fornecidas pelo executor.

#### Scenario: Cliente decide retry pelo envelope

- **WHEN** um cliente recebe uma resposta de erro com `retryable: true`
- **THEN** pode repetir conforme a política do método, usando o campo do envelope como sinal

#### Scenario: Cliente respeita erro permanente

- **WHEN** o envelope informa `retryable: false`
- **THEN** o cliente não repete e propaga `code` e `details` para a UI e os logs

#### Scenario: Erro orienta a próxima chamada

- **WHEN** a validação rejeita campos ou shape de uma ferramenta
- **THEN** `message` e `details` identificam o caminho inválido e, quando possível, apresentam a forma mínima aceita
