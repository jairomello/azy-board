## ADDED Requirements

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
