## ADDED Requirements

### Requirement: Azy Agent propaga o contrato de erro comum
O middleware e o harness do Azy Agent SHALL retornar o envelope de erro da API sem convertê-lo para campos paralelos no nível raiz.

#### Scenario: Ferramenta do agente recebe erro da API
- **WHEN** uma chamada do Azy Agent falha com erro HTTP normalizado
- **THEN** o consumidor recebe `error.code`, `error.message`, `error.retryable` e `error.details` no mesmo envelope

#### Scenario: Erro gerado pelo harness
- **WHEN** o harness rejeita uma operação antes da chamada HTTP
- **THEN** ele produz o mesmo envelope e usa um código estável compatível com os erros da API
