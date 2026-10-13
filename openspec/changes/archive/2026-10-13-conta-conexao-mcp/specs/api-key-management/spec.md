# Spec Delta

## ADDED Requirements

### Requirement: Finalidade da chave na seção de API Keys

A seção de API Keys SHALL explicar que a API Key serve para conectar o code agent do usuário ao MCP do Azy Board. A orientação NUNCA SHALL exibir o valor da chave.

#### Scenario: Explicação visível

- **WHEN** o usuário acessa a seção de API Keys, com ou sem chaves cadastradas
- **THEN** é exibida uma orientação que liga a API Key à conexão do code agent ao MCP do Azy Board

#### Scenario: Valor da chave não exposto

- **WHEN** a orientação de conexão é exibida
- **THEN** nenhum valor de chave aparece no texto ou em controles dessa orientação

### Requirement: URL do MCP copiável

A seção de API Keys SHALL exibir a URL do MCP da instalação, derivada da origem atual e do base path, e SHALL oferecer um controle que copia essa URL com confirmação visual. A URL SHALL funcionar tanto na raiz quanto em publicação sob base path.

#### Scenario: URL do MCP exibida

- **WHEN** o usuário acessa a seção de API Keys
- **THEN** a URL `https://<host>/mcp` (origem atual + base path + `/mcp`) é exibida em texto legível e selecionável

#### Scenario: Copiar a URL do MCP

- **WHEN** o usuário aciona o controle de copiar a URL do MCP
- **THEN** a URL é copiada para a área de transferência e o controle exibe confirmação visual

#### Scenario: Publicação sob base path

- **WHEN** a aplicação roda sob um base path (ex.: `/azyboard/`)
- **THEN** a URL exibida inclui o prefixo (ex.: `https://host/azyboard/mcp`)

#### Scenario: Controle acessível por teclado

- **WHEN** o usuário navega por teclado pela seção
- **THEN** alcança e aciona o controle de copiar a URL, com retorno de foco e de estado

### Requirement: Instrução pronta para o code agent

A seção de API Keys SHALL oferecer um controle que copia uma instrução curta contendo a URL do MCP, para o usuário enviar ao seu code agent e este configurar a conexão usando a skill oficial. A instrução NUNCA SHALL conter o valor da chave.

#### Scenario: Copiar instrução para o agente

- **WHEN** o usuário aciona o controle de copiar a instrução
- **THEN** a área de transferência recebe um texto que contém a URL do MCP e o pedido de configurar a conexão, sem o valor da chave

### Requirement: Orientação do MCP nos três idiomas

Os textos da orientação de conexão do MCP SHALL existir em pt-BR, en e es no namespace `settings`.

#### Scenario: Textos traduzidos

- **WHEN** o idioma ativo é pt-BR, en ou es
- **THEN** a orientação, os rótulos e a instrução aparecem no idioma ativo, sem chave fixa embutida
