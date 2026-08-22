## ADDED Requirements

### Requirement: Ciclo de vida seguro de API Keys de agentes

API Keys SHALL possuir estado de revogação, expiração opcional, escopo opcional por projeto/permissão e registro de último uso. O segredo bruto SHALL ser exibido somente uma vez na criação, armazenado apenas como hash e nunca incluído em logs, respostas ou documentação.

#### Scenario: Chave expirada ou revogada
- **WHEN** agente envia API Key expirada ou revogada
- **THEN** API retorna HTTP 401 e não executa nenhuma operação

#### Scenario: Escopo limita projeto
- **WHEN** agente usa chave com escopo restrito ao projeto A para acessar projeto B
- **THEN** API retorna HTTP 404/403 e não revela nem modifica dados de B

#### Scenario: Último uso atualizado
- **WHEN** API Key válida autentica uma requisição
- **THEN** sistema atualiza `last_used_at` sem expor o valor bruto da chave

#### Scenario: Chave legada
- **WHEN** API Key existente não possui escopo ou expiração
- **THEN** sistema aplica membership e RBAC do Owner, preserva compatibilidade e permite migração/revogação posterior
