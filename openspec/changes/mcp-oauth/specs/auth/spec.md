## MODIFIED Requirements

### Requirement: API Key para agentes de IA
O sistema SHALL permitir geração de API Keys vinculadas a um Owner humano. A API Key SHALL ser usada no header `Authorization: Bearer {key}` e terá as mesmas permissões do Owner no projeto. Para conexão de code agents ao MCP, o uso de API Key SHALL ser tratado como depreciado em favor da conexão OAuth, sem mudança de comportamento da chave.

#### Scenario: Geração de API Key
- **WHEN** usuário ADMIN ou MEMBER solicita criação de API Key
- **THEN** sistema gera chave única, armazena o hash e exibe o valor completo uma única vez

#### Scenario: Requisição autenticada com API Key
- **WHEN** agente envia requisição com API Key válida
- **THEN** sistema autentica como o agente vinculado ao Owner e aplica permissões do Owner

#### Scenario: Identificação do agente no board
- **WHEN** agente faz claim de task
- **THEN** card exibe avatar do Owner humano com badge de IA (ícone de robô + nome do modelo informado na API Key)

#### Scenario: Agente conectado por OAuth no board
- **WHEN** um agente conectado ao MCP por OAuth faz claim de task
- **THEN** o card exibe avatar do usuário que autorizou a conexão com badge de IA e o nome do app registrado
