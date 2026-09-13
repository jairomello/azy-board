## Purpose

Definir o contrato único de erros compartilhado pela API HTTP, MCP e Azy Agent.

## Requirements

### Requirement: Contrato único de erro HTTP
Toda resposta de erro da API SHALL usar o envelope `{ "error": { "code": string, "message": string, "retryable": boolean, "details": object | array | null } }`. Os campos `code`, `retryable` e `details` SHALL ficar dentro de `error`, e `error` SHALL deixar de ser uma string.

#### Scenario: Erro de validação
- **WHEN** uma requisição contém dados inválidos
- **THEN** a API retorna HTTP 400 ou 422 com `error.code`, mensagem segura, `retryable: false` e `details` estruturado para os campos inválidos

#### Scenario: Recurso inexistente
- **WHEN** o usuário solicita um recurso inexistente ou fora do seu escopo
- **THEN** a API retorna HTTP 404 com o mesmo envelope, código estável e `details: null`

#### Scenario: Exceção inesperada
- **WHEN** ocorre uma exceção não mapeada no servidor
- **THEN** a API retorna HTTP 500 com código `INTERNAL_ERROR`, mensagem genérica, `retryable: false` e sem stack trace ou detalhes internos

### Requirement: Semântica estável de retry
Cada erro SHALL indicar explicitamente se repetir a operação pode ter sucesso usando `retryable`, e o valor SHALL ser determinado pelo código de erro, não por cada handler individualmente.

#### Scenario: Falha transitória
- **WHEN** uma dependência temporariamente indisponível produz erro conhecido
- **THEN** a resposta usa código de indisponibilidade, status apropriado e `retryable: true`

#### Scenario: Falha permanente de domínio
- **WHEN** a operação é recusada por autorização, validação ou conflito de domínio
- **THEN** a resposta usa `retryable: false`

### Requirement: Segurança dos detalhes de erro
O servidor SHALL remover stack trace, SQL, tokens, segredos e dados de infraestrutura de mensagens e `details` retornados ao cliente, mantendo diagnóstico completo somente nos logs protegidos.

#### Scenario: Erro com informação interna
- **WHEN** uma exceção contém stack trace ou credencial
- **THEN** esses dados não aparecem no payload HTTP, MCP ou Azy Agent
