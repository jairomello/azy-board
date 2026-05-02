## ADDED Requirements

### Requirement: Criar projeto
O sistema SHALL permitir que um usuário autenticado crie um novo projeto informando nome e descrição opcional.

#### Scenario: Criação bem-sucedida com colunas padrão
- **WHEN** usuário envia nome do projeto
- **THEN** sistema cria o projeto, associa o criador como administrador, cria o módulo padrão "Geral" e provisiona automaticamente 6 colunas em ordem de fluxo: Backlog (NOT_STARTED), A Fazer (NOT_STARTED), Fazendo (IN_PROGRESS), A Testar (IN_PROGRESS), Testando (IN_PROGRESS), Concluídas (DONE)

#### Scenario: Board pronto para uso imediato
- **WHEN** usuário acessa o board de um projeto recém-criado
- **THEN** as 6 colunas padrão já estão presentes e o board aceita criação de cards sem configuração adicional

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

---

### Requirement: Seção "Módulos" na tela de Settings do projeto
O sistema SHALL exibir uma seção dedicada "Módulos" na tela de configurações do projeto (`SettingsPage`), após as seções existentes (Colunas, Membros, Squads).

#### Scenario: Acesso à seção Módulos
- **WHEN** admin navega para Settings do projeto
- **THEN** seção "Módulos" é exibida com a lista de módulos existentes e formulário de criação

#### Scenario: VIEWER vê módulos mas não pode editar
- **WHEN** usuário com papel VIEWER acessa Settings
- **THEN** seção "Módulos" exibe a lista somente para leitura, sem botões de criar/editar/excluir

---

### Requirement: Seção "Versões" na tela de Settings do projeto
O sistema SHALL exibir uma seção dedicada "Versões" na tela de configurações do projeto (`SettingsPage`), após a seção "Módulos".

#### Scenario: Acesso à seção Versões
- **WHEN** admin navega para Settings do projeto
- **THEN** seção "Versões" é exibida com a lista de versões (nome, situação badge, data) e botão "Nova versão"

#### Scenario: Lista vazia de versões
- **WHEN** projeto não possui versões cadastradas
- **THEN** seção exibe mensagem "Nenhuma versão cadastrada" com botão "Criar primeira versão"

---

### Requirement: Gerente Geral do Projeto
O sistema SHALL permitir indicar um usuário como Gerente Geral do Projeto no momento da criação e nas configurações do projeto. O campo é opcional e informativo (sem RBAC adicional nesta versão).

#### Scenario: Indicar gerente na criação do projeto
- **WHEN** usuário cria novo projeto e informa `manager_user_id` no payload
- **THEN** sistema persiste o campo e exibe o nome do gerente nas configurações do projeto

#### Scenario: Campo gerente opcional na criação
- **WHEN** usuário cria projeto sem informar `manager_user_id`
- **THEN** projeto é criado normalmente com `manager_user_id = null`; campo fica em branco nas configurações

#### Scenario: Alterar gerente nas configurações
- **WHEN** administrador acessa configurações do projeto e seleciona outro usuário membro como gerente
- **THEN** sistema atualiza `manager_user_id` e exibe o novo gerente imediatamente

#### Scenario: Gerente deve ser membro do projeto
- **WHEN** administrador tenta definir como gerente um usuário que não é membro do projeto
- **THEN** sistema retorna erro 422 "O gerente deve ser membro do projeto"

#### Scenario: Remover gerente
- **WHEN** administrador limpa o campo de gerente nas configurações
- **THEN** sistema persiste `manager_user_id = null` e o campo fica em branco

---

### Requirement: Seção "Centros de Custo" nas Settings do projeto
O sistema SHALL exibir uma seção "Centros de Custo" na página de configurações do projeto, após a seção de Membros & Squads.

#### Scenario: Acesso à seção Centros de Custo
- **WHEN** qualquer membro navega para as configurações do projeto
- **THEN** seção "Centros de Custo" é exibida (em modo somente leitura para VIEWER/MEMBER, com CRUD completo para ADMIN)
