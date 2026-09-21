## MODIFIED Requirements

### Requirement: Administração de usuários por Admin
O sistema SHALL exibir um grupo de menu `Admin` e disponibilizar nele a listagem e o cadastro de usuários do tenant para Admin e Root. Admin SHALL poder definir os grupos `TEAM_MEMBER`, `MANAGER` e `ADMIN`, mas SHALL não poder atribuir `ROOT`. O cadastro de usuário SHALL validar o e-mail como identidade global e SHALL rejeitar endereço já existente em qualquer tenant, inclusive fora do tenant ativo.

#### Scenario: Admin visualiza menu e usuários
- **WHEN** um Admin acessa a aplicação
- **THEN** o menu lateral exibe `Admin` e a área exibe usuários do tenant ativo

#### Scenario: Membro não visualiza Administração
- **WHEN** um Membro de Equipe ou Gerente acessa a aplicação
- **THEN** o menu `Admin` não é exibido e a rota retorna 403 se acessada diretamente

#### Scenario: Admin cadastra usuário
- **WHEN** um Admin cadastra um usuário e escolhe um grupo não Root
- **THEN** o sistema cria o usuário no tenant ativo com o grupo escolhido

#### Scenario: Admin cadastra e-mail já existente em outro tenant
- **WHEN** um Admin tenta cadastrar um e-mail que já pertence a um usuário de outro tenant
- **THEN** o sistema retorna 409 com mensagem explícita e não cria o usuário

#### Scenario: Admin tenta atribuir Root
- **WHEN** um Admin tenta criar ou alterar um usuário para o grupo `ROOT`
- **THEN** o sistema retorna 403 e não persiste a alteração
