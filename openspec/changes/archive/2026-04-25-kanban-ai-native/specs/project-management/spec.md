## ADDED Requirements

### Requirement: Criar projeto
O sistema SHALL permitir que um usuário autenticado crie um novo projeto informando nome e descrição opcional.

#### Scenario: Criação bem-sucedida
- **WHEN** usuário envia nome do projeto
- **THEN** sistema cria o projeto, associa o criador como administrador e retorna os dados do projeto criado

#### Scenario: Nome duplicado no mesmo workspace
- **WHEN** usuário tenta criar projeto com nome já existente no workspace
- **THEN** sistema retorna erro 409 com mensagem indicando duplicidade

---

### Requirement: Listar projetos do usuário
O sistema SHALL retornar apenas os projetos nos quais o usuário autenticado é membro.

#### Scenario: Listagem filtrada por membership
- **WHEN** usuário solicita lista de projetos
- **THEN** sistema retorna somente projetos onde o usuário possui membership ativa, independente de IDs passados na URL

---

### Requirement: Gerenciar squads dentro de um projeto
O sistema SHALL permitir criar múltiplos squads dentro de um projeto e associar membros a cada squad.

#### Scenario: Criação de squad
- **WHEN** administrador do projeto cria um squad com nome
- **THEN** sistema registra o squad vinculado ao projeto

#### Scenario: Adição de membro ao squad
- **WHEN** administrador adiciona um usuário ao squad informando e-mail ou matrícula
- **THEN** sistema cria membership do usuário no squad com o perfil especificado

---

### Requirement: Perfis e permissões por projeto
O sistema SHALL suportar perfis: `ADMIN`, `MEMBER` e `VIEWER`. Cada perfil define o que o usuário pode fazer dentro do projeto.

#### Scenario: Viewer não pode criar cards
- **WHEN** usuário com perfil VIEWER tenta criar um card via API
- **THEN** sistema retorna erro 403

#### Scenario: Admin pode alterar perfil de outros membros
- **WHEN** usuário ADMIN altera perfil de um membro
- **THEN** sistema atualiza o perfil e o novo nível de permissão entra em vigor imediatamente

---

### Requirement: Proteção contra acesso não autorizado a projetos
O sistema SHALL verificar server-side se o usuário autenticado tem membership no projeto antes de retornar qualquer dado.

#### Scenario: Acesso por ID manipulado na URL
- **WHEN** usuário tenta acessar projeto cujo ID foi inserido manualmente na URL sem ter membership
- **THEN** sistema retorna erro 404 (não revela existência do recurso)
