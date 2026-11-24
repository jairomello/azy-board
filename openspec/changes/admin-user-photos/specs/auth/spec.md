# Spec Delta

## ADDED Requirements

### Requirement: Foto de perfil alterada pelo administrador
O sistema SHALL aceitar inclusão, substituição e remoção da foto de perfil de um usuário alvo por um executor `ADMIN` ou `ROOT` do mesmo tenant. A gravação SHALL aplicar a mesma validação, normalização para 256×256 px sem metadados e armazenamento isolado por tenant do upload do próprio usuário, atualizando o ponteiro de foto do usuário alvo.

#### Scenario: Gravação normalizada para o usuário alvo
- **WHEN** um Admin envia uma imagem válida para outro usuário do tenant
- **THEN** o sistema normaliza a imagem para 256×256 px sem metadados, armazena-a isolada por tenant e associa a foto ao usuário alvo

#### Scenario: Substituição invalida cache da foto anterior
- **WHEN** a foto de um usuário é substituída pela Administração
- **THEN** a URL versionada da nova foto muda e requisições seguintes recebem a nova imagem, sem reaproveitar a versão anterior em cache

#### Scenario: Recusa de arquivo inválido ou acima do limite
- **WHEN** o Admin envia arquivo que não é imagem de formato permitido ou que excede o tamanho máximo aceito
- **THEN** o sistema rejeita a operação com o mesmo código de erro do upload do próprio perfil e não altera a foto armazenada

#### Scenario: Remoção pelo administrador
- **WHEN** um Admin remove a foto de um usuário do tenant
- **THEN** o sistema descarta a imagem armazenada, limpa o ponteiro de foto do usuário alvo e as exibições voltam ao avatar por iniciais

#### Scenario: Serviço da foto continua autenticado
- **WHEN** qualquer cliente requisita a foto de um usuário do tenant após a alteração administrativa
- **THEN** o sistema serve a imagem pela rota autenticada com tipo de conteúdo, ETag e cabeçalhos de cache, mantendo o isolamento entre tenants

#### Scenario: Alvo fora do tenant
- **WHEN** um Admin tenta alterar a foto de um usuário que não pertence ao tenant ativo
- **THEN** o sistema responde 404 e não grava nem remove imagem

#### Scenario: Upload do próprio perfil permanece inalterado
- **WHEN** um usuário comum altera ou remove a própria foto pela página de conta
- **THEN** o sistema continua aceitando a operação apenas para o próprio usuário autenticado
