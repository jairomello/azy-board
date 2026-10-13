# Spec Delta

## ADDED Requirements

### Requirement: Dica visível para configurar o MCP com a skill

Junto da orientação de conexão do MCP, a seção de API Keys SHALL exibir uma dica curta orientando o usuário a pedir ao seu code agent que use a skill oficial `azyboard` e o comando `/azyboard-setup-mcp` para conduzir a configuração. A dica NUNCA SHALL pedir a chave no chat nem exibir o valor da chave.

#### Scenario: Dica exibida com a orientação

- **WHEN** o usuário acessa a seção de API Keys
- **THEN** uma dica visível, além da URL do MCP e dos controles de cópia, orienta o usuário a pedir ao seu code agent que use a skill oficial para configurar a conexão

#### Scenario: Dica nomeia a skill e o comando

- **WHEN** a dica é exibida
- **THEN** ela cita a skill `azyboard` e o comando `/azyboard-setup-mcp`

#### Scenario: Dica não expõe credencial

- **WHEN** a dica é exibida
- **THEN** nenhum valor de chave aparece na dica e ela não pede a chave no chat

#### Scenario: Dica nos três idiomas

- **WHEN** o idioma ativo é pt-BR, en ou es
- **THEN** a dica aparece no idioma ativo
