## Purpose

Definir os requisitos da capacidade api key management.

## Requirements

### Requirement: Listar API Keys do usuário
O sistema SHALL exibir na página de conta todas as API Keys pertencentes ao usuário autenticado. Cada item SHALL mostrar nome da chave, nome do modelo de IA vinculado (se houver), data de criação e data do último uso. O valor completo da chave NUNCA SHALL ser exibido na listagem.

#### Scenario: Listagem com chaves existentes
- **WHEN** o usuário acessa a seção de API Keys com chaves cadastradas
- **THEN** cada chave é exibida com nome, modelo de IA, data de criação e último uso

#### Scenario: Listagem sem chaves
- **WHEN** o usuário acessa a seção de API Keys sem nenhuma chave cadastrada
- **THEN** uma mensagem de estado vazio é exibida com instrução para criar a primeira chave

### Requirement: Gerar nova API Key
O sistema SHALL permitir ao usuário gerar uma nova API Key informando um nome obrigatório e, opcionalmente, o nome do modelo de IA vinculado. Após a criação, o sistema SHALL exibir o valor completo da chave uma única vez em um Dialog com botão de cópia. O Dialog SHALL exigir confirmação ("Já copiei") antes de ser fechado.

#### Scenario: Gerar chave com nome válido
- **WHEN** o usuário preenche o nome e confirma a criação
- **THEN** a chave é criada e o Dialog exibe o valor completo com botão de cópia

#### Scenario: Copiar valor da chave gerada
- **WHEN** o usuário clica no botão de copiar no Dialog
- **THEN** o valor da chave é copiado para a área de transferência e o botão exibe confirmação visual

#### Scenario: Fechar Dialog após copiar
- **WHEN** o usuário clica em "Já copiei" no Dialog
- **THEN** o Dialog é fechado e a nova chave aparece na listagem (sem o valor completo)

#### Scenario: Tentativa de criar chave sem nome
- **WHEN** o usuário tenta confirmar a criação com o campo nome vazio
- **THEN** o sistema exibe erro de validação e não envia a requisição

### Requirement: Revogar API Key
O sistema SHALL permitir ao usuário revogar (deletar) qualquer API Key de sua propriedade. O sistema SHALL exibir uma confirmação antes de executar a revogação. Após confirmação, a chave é removida permanentemente e não pode ser recuperada.

#### Scenario: Revogar chave com confirmação
- **WHEN** o usuário clica em "Revogar" em uma chave e confirma a ação
- **THEN** a chave é removida permanentemente e some da listagem

#### Scenario: Cancelar revogação
- **WHEN** o usuário clica em "Revogar" mas cancela na confirmação
- **THEN** a chave permanece na listagem sem alteração

### Requirement: Endpoints REST de API Keys no nível do usuário
O backend SHALL expor os endpoints `GET /api-keys`, `POST /api-keys` e `DELETE /api-keys/:id` protegidos por `authMiddleware`. Todas as operações SHALL filtrar por `tenantId + ownerId` para garantir isolamento entre usuários. O endpoint DELETE SHALL verificar que a chave pertence ao usuário antes de deletar.

#### Scenario: Listar chaves via GET /api-keys
- **WHEN** uma requisição autenticada é feita para `GET /api-keys`
- **THEN** o sistema retorna apenas as chaves do usuário autenticado, sem o valor completo

#### Scenario: Criar chave via POST /api-keys
- **WHEN** uma requisição autenticada com `{ name, aiModelName? }` é enviada para `POST /api-keys`
- **THEN** o sistema cria a chave, armazena o hash e retorna o valor completo apenas nesta resposta

#### Scenario: Revogar chave via DELETE /api-keys/:id
- **WHEN** uma requisição autenticada é feita para `DELETE /api-keys/:id`
- **THEN** o sistema verifica que a chave pertence ao usuário, deleta e retorna 204

#### Scenario: Tentativa de revogar chave de outro usuário
- **WHEN** uma requisição autenticada tenta deletar uma chave de outro usuário via `DELETE /api-keys/:id`
- **THEN** o sistema retorna 404 sem revelar a existência da chave

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
