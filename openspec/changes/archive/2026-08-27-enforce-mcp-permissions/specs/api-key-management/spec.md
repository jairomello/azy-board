## MODIFIED Requirements

### Requirement: Ciclo de vida seguro de API Keys de agentes
API Keys SHALL possuir estado de revogação, expiração opcional, escopo opcional por projeto/permissão e registro de último uso. O segredo bruto SHALL ser exibido somente uma vez na criação e nunca incluído em logs, respostas ou documentação. A API Key SHALL herdar o grupo global, tenant e permissões do Owner; seus escopos somente poderão restringir esse conjunto.

#### Scenario: Chave expirada ou revogada
- **WHEN** agente envia API Key expirada ou revogada
- **THEN** API retorna HTTP 401 e não executa nenhuma operação

#### Scenario: Escopo limita projeto
- **WHEN** agente usa chave com escopo restrito ao projeto A para acessar projeto B
- **THEN** API rejeita a operação sem revelar nem modificar dados de B

#### Scenario: Último uso atualizado
- **WHEN** API Key válida autentica uma requisição autorizada
- **THEN** sistema atualiza `last_used_at` sem expor o valor bruto da chave

#### Scenario: Escopo não amplia Owner
- **WHEN** API Key declara permissão ou projeto que o Owner não poderia acessar
- **THEN** a autorização efetiva permanece limitada ao Owner e a operação excedente é rejeitada
