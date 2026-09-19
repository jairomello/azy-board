## MODIFIED Requirements

### Requirement: Foto de perfil e avatar do usuário
O sistema SHALL permitir que cada usuário faça upload, altere e remova sua foto de perfil a partir da página de conta. A imagem SHALL ser validada e normalizada no servidor para 256×256 px, sem metadados, antes de ser armazenada em repositório dedicado e isolado por tenant, separado dos anexos de cards. Enquanto não houver foto, o sistema SHALL gerar automaticamente um avatar com as iniciais do nome do usuário. A foto SHALL ser servida por rota autenticada restrita a membros do mesmo tenant e SHALL estar refletida em todos os cards e comentários do usuário.

#### Scenario: Abertura do editor de recorte
- **WHEN** usuário escolhe um arquivo de imagem na seção de foto do perfil
- **THEN** o sistema abre um editor que permite ajustar zoom e enquadramento quadrado antes do envio

#### Scenario: Upload de foto de perfil
- **WHEN** usuário confirma o recorte e envia a imagem na página de perfil
- **THEN** a imagem é validada, normalizada para 256×256 px sem metadados, armazenada de forma isolada por tenant e exibida como avatar do usuário

#### Scenario: Recusa de arquivo inválido ou acima do limite
- **WHEN** usuário envia arquivo que não é imagem de formato permitido ou que excede o tamanho máximo aceito
- **THEN** o sistema rejeita o upload com mensagem de erro e não altera a foto atual

#### Scenario: Remoção da foto de perfil
- **WHEN** usuário remove sua foto de perfil
- **THEN** o sistema descarta a imagem armazenada e volta a exibir o avatar por iniciais

#### Scenario: Avatar por iniciais quando sem foto
- **WHEN** usuário não possui foto de perfil cadastrada
- **THEN** sistema exibe círculo colorido com as iniciais do nome (ex: "JS" para Jairo Silva) como avatar em todos os cards

#### Scenario: Avatar exibido nos cards
- **WHEN** task é atribuída a um usuário
- **THEN** avatar do responsável (foto ou iniciais) é exibido no card do Kanban e na Tree View

#### Scenario: Acesso autorizado à foto
- **WHEN** usuário autenticado requisita a foto de um usuário do mesmo tenant
- **THEN** o sistema serve a imagem com tipo de conteúdo correto e cabeçalhos de segurança e cache

#### Scenario: Isolamento entre tenants
- **WHEN** usuário autenticado tenta acessar a foto de um usuário de outro tenant
- **THEN** o sistema responde 404 sem servir a imagem

#### Scenario: Sincronização entre dispositivos
- **WHEN** usuário autentica em outro dispositivo
- **THEN** a foto de perfil atualizada é refletida no avatar da sessão
