## ADDED Requirements

### Requirement: Dropdown de perfil no avatar do usuário
O sistema SHALL exibir um menu dropdown ao clicar no `UserAvatar` em qualquer header da aplicação. O dropdown SHALL conter as opções "Configurações da conta" e "Sair".

#### Scenario: Abrir dropdown no header da página de projetos
- **WHEN** o usuário clica no avatar na `ProjectsPage`
- **THEN** um menu dropdown é exibido com as opções "Configurações da conta" e "Sair"

#### Scenario: Abrir dropdown no header do board
- **WHEN** o usuário clica no avatar na `BoardPage`
- **THEN** um menu dropdown é exibido com as opções "Configurações da conta" e "Sair"

#### Scenario: Navegar para configurações de conta
- **WHEN** o usuário clica em "Configurações da conta" no dropdown
- **THEN** o sistema navega para a rota `/account`

#### Scenario: Sair pelo dropdown
- **WHEN** o usuário clica em "Sair" no dropdown
- **THEN** o sistema encerra a sessão e redireciona para a tela de login

### Requirement: Página de configurações de conta
O sistema SHALL disponibilizar a rota `/account` como uma página protegida por autenticação que centraliza as configurações pessoais do usuário. A página SHALL exibir o nome e e-mail do usuário no topo e conter a seção de API Keys.

#### Scenario: Acesso autenticado à página de conta
- **WHEN** um usuário autenticado navega para `/account`
- **THEN** a página é exibida com nome, e-mail do usuário e a seção de API Keys

#### Scenario: Acesso não autenticado redireciona para login
- **WHEN** um usuário não autenticado acessa `/account`
- **THEN** o sistema redireciona para a tela de login

#### Scenario: Botão de voltar na página de conta
- **WHEN** o usuário clica no botão de voltar
- **THEN** o sistema navega para `/projects`
