## ADDED Requirements

### Requirement: Renomear projeto pelo card
O sistema SHALL permitir que um usuário com papel `ADMIN` altere o nome de um projeto existente a partir do card na tela de projetos. O nome SHALL ser obrigatório, normalizado com remoção de espaços laterais e único dentro do tenant.

#### Scenario: Admin abre a edição pelo card
- **WHEN** usuário ADMIN visualiza um card de projeto
- **THEN** o card exibe uma ação de editar e, ao acioná-la, abre um formulário com o nome atual preenchido sem navegar para o board

#### Scenario: Admin renomeia projeto com sucesso
- **WHEN** usuário ADMIN informa um nome válido e confirma a edição
- **THEN** sistema envia `PATCH /projects/:projectId` com o nome, persiste o valor normalizado, fecha o formulário e exibe o novo nome no card

#### Scenario: Nome vazio é rejeitado
- **WHEN** usuário ADMIN remove todo o conteúdo do nome ou informa apenas espaços
- **THEN** sistema impede o salvamento e exibe uma mensagem de validação sem alterar o nome persistido

#### Scenario: Nome duplicado no tenant é rejeitado
- **WHEN** usuário ADMIN tenta renomear um projeto para o nome de outro projeto do mesmo tenant
- **THEN** sistema retorna erro 409, exibe feedback de conflito e mantém o nome anterior no card

#### Scenario: Usuário não administrador não vê edição
- **WHEN** usuário MEMBER ou VIEWER visualiza a lista de projetos
- **THEN** o card não exibe a ação de editar

#### Scenario: Tentativa não autorizada via API
- **WHEN** usuário MEMBER ou VIEWER envia diretamente `PATCH /projects/:projectId` para alterar o nome
- **THEN** sistema retorna erro 403 e não altera o projeto

#### Scenario: Projeto permanece navegável
- **WHEN** usuário clica em qualquer área do card que não seja a ação de editar
- **THEN** sistema navega para `/projects/:projectId/board` sem abrir o formulário de edição
