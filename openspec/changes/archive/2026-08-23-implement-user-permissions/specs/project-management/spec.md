## MODIFIED Requirements

### Requirement: Criar projeto
O sistema SHALL permitir que um usuário autenticado com grupo `MANAGER`, `ADMIN` ou `ROOT` crie um novo projeto informando nome e descrição opcional. Membros de Equipe SHALL receber 403.

#### Scenario: Gerente cria projeto
- **WHEN** Gerente envia nome do projeto
- **THEN** sistema cria o projeto com as colunas padrão e associa o criador como administrador

#### Scenario: Board pronto para uso imediato
- **WHEN** usuário autorizado acessa o board de um projeto recém-criado
- **THEN** as 6 colunas padrão já estão presentes e o board aceita criação de cards sem configuração adicional

#### Scenario: Nome duplicado no mesmo workspace
- **WHEN** usuário autorizado tenta criar projeto com nome já existente no workspace
- **THEN** sistema retorna erro 409 com mensagem indicando duplicidade

#### Scenario: Membro tenta criar projeto
- **WHEN** Membro de Equipe envia nome do projeto
- **THEN** sistema retorna 403 e não cria o projeto

### Requirement: Listar projetos do usuário
O sistema SHALL retornar somente projetos do tenant ativo. Para Membros de Equipe e Gerentes, SHALL retornar apenas projetos com membership ativa; para Admins e Root, SHALL retornar todos os projetos do tenant.

#### Scenario: Listagem filtrada de membro
- **WHEN** Membro de Equipe solicita lista de projetos
- **THEN** sistema retorna somente projetos onde possui membership ativa

#### Scenario: Listagem completa de admin
- **WHEN** Admin solicita lista de projetos
- **THEN** sistema retorna todos os projetos do tenant ativo

### Requirement: Proteção contra acesso não autorizado a projetos
O sistema SHALL verificar server-side o grupo global e a membership do usuário antes de retornar qualquer dado de projeto, mantendo sempre o filtro do tenant ativo.

#### Scenario: Gerente acessa projeto sem membership
- **WHEN** Gerente tenta acessar projeto sem membership
- **THEN** sistema retorna 404 e não revela a existência do recurso

#### Scenario: Admin acessa projeto sem membership
- **WHEN** Admin tenta acessar projeto do tenant ativo sem membership
- **THEN** sistema permite o acesso conforme as permissões administrativas
