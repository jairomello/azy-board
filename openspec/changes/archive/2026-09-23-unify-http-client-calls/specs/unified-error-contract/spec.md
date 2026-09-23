## ADDED Requirements

### Requirement: Consumo do envelope pelos clientes
Os clientes do contrato de erro (web, MCP e Azy Agent) SHALL consumir `code`, `retryable` e `details` do envelope ao tratar falhas, usando `retryable` para decidir repetição e SHALL NOT inferir repetibilidade apenas do status HTTP.

#### Scenario: Cliente decide retry pelo envelope
- **WHEN** um cliente recebe uma resposta de erro com `retryable: true`
- **THEN** pode repetir conforme a política do método, usando o campo do envelope como sinal

#### Scenario: Cliente respeita erro permanente
- **WHEN** o envelope informa `retryable: false`
- **THEN** o cliente não repete e propaga `code` e `details` para a UI e os logs
