## ADDED Requirements

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
