## MODIFIED Requirements

### Requirement: Finalidade da chave na seção de API Keys
A seção de API Keys SHALL explicar que a API Key serve para conectar o code agent do usuário ao MCP do Azy Board, SHALL indicar que esse uso está depreciado e SHALL recomendar a conexão por OAuth, que dispensa chave. A orientação NUNCA SHALL exibir o valor da chave.

#### Scenario: Explicação visível

- **WHEN** o usuário acessa a seção de API Keys, com ou sem chaves cadastradas
- **THEN** é exibida uma orientação que liga a API Key à conexão do code agent ao MCP do Azy Board

#### Scenario: Valor da chave não exposto

- **WHEN** a orientação de conexão é exibida
- **THEN** nenhum valor de chave aparece no texto ou em controles dessa orientação

#### Scenario: Aviso de depreciação
- **WHEN** o usuário acessa a seção de API Keys
- **THEN** é exibido um aviso de que conectar o MCP por API Key está depreciado, com orientação para conectar por OAuth usando só a URL do MCP

### Requirement: Instrução pronta para o code agent
A seção de API Keys SHALL oferecer um controle que copia uma instrução curta contendo a URL do MCP, para o usuário enviar ao seu code agent e este configurar a conexão usando a skill oficial, por OAuth como padrão. A instrução NUNCA SHALL conter o valor da chave.

#### Scenario: Copiar instrução para o agente

- **WHEN** o usuário aciona o controle de copiar a instrução
- **THEN** a área de transferência recebe um texto que contém a URL do MCP e o pedido de configurar a conexão, sem o valor da chave

#### Scenario: Instrução orienta OAuth
- **WHEN** o usuário copia a instrução para o agente
- **THEN** o texto pede a conexão por OAuth usando a URL do MCP, sem exigir API Key
