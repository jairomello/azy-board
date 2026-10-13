# Spec Delta

## MODIFIED Requirements

### Requirement: Autoconfiguração do MCP pelo agente do usuário
A skill oficial SHALL orientar o agente a configurar o servidor MCP do Azy Board no cliente do usuário (Claude Code, Codex, OpenCode e outros) a partir de um pedido em linguagem natural, cobrindo os modos stdio local e Streamable HTTP remoto, pré-requisitos, uso seguro da API Key, estrutura de configuração do servidor `azy-board` e verificação da conexão. O roteiro SHALL usar placeholders e NÃO SHALL conter segredos, hosts privados ou credenciais reais.

#### Scenario: Usuário pede para configurar o MCP
- **WHEN** o usuário pede ao agente, com a skill carregada, que ajude a configurar o MCP do Azy Board no seu code agent
- **THEN** o agente explica os pré-requisitos, como gerar a API Key em Minha conta, qual estrutura de configuração registrar no cliente e como verificar a conexão, adaptando ao cliente informado

#### Scenario: Configuração do modo remoto
- **WHEN** o usuário pede para conectar o code agent ao MCP de uma instalação hospedada por URL
- **THEN** o agente orienta a registrar o endpoint e a credencial no cabeçalho, adaptando ao cliente informado, e apresenta o modo stdio como alternativa local

#### Scenario: Credencial nunca em arquivo versionado
- **WHEN** o agente monta a configuração para o usuário
- **THEN** usa `azb_sua_chave_aqui` como placeholder, orienta a manter a chave em variável de ambiente ou cofre do cliente e alerta para não gravá-la em arquivo versionado

#### Scenario: Verificação após configurar
- **WHEN** a configuração foi aplicada e o cliente recarregado
- **THEN** o agente orienta a confirmar que o servidor iniciou sem erro e que `list_tasks` e `list_modules` aparecem e respondem para um projeto acessível

#### Scenario: Comando semântico de configuração
- **WHEN** o usuário invoca o comando semântico de configuração do MCP (ou o equivalente em linguagem natural)
- **THEN** o agente segue o roteiro de configuração sem exigir que o cliente suporte slash commands

### Requirement: Segurança da credencial na configuração do MCP
O roteiro de configuração SHALL deixar explícito que a API Key identifica um Owner humano, que cada cliente e ambiente usa uma chave própria, que a chave exposta deve ser revogada e que `AZYBOARD_PROJECT_ID` só se aplica ao modo stdio e não é segredo. No modo remoto, o contexto de projeto SHALL ser informado explicitamente e nunca derivado da credencial.

#### Scenario: Chave exposta
- **WHEN** o usuário relata que colou a chave em um arquivo versionado ou a compartilhou
- **THEN** o agente orienta a revogar a chave em Minha conta, gerar uma nova e movê-la para variável de ambiente ou cofre do cliente

#### Scenario: Projeto padrão no modo remoto
- **WHEN** o agente explica como o projeto é definido na configuração
- **THEN** informa que `AZYBOARD_PROJECT_ID` é exclusivo do modo stdio e que, no modo remoto, o projeto é informado explicitamente na configuração ou na chamada, nunca pela credencial
