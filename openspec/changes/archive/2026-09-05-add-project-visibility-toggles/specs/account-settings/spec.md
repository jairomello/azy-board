## ADDED Requirements

### Requirement: Preferência de sessão para mostrar projetos ocultos
O sistema SHALL disponibilizar, no dropdown do avatar e na página `/account`, um controle "Mostrar projetos ocultos" que alterna a exibição de projetos ocultos na listagem de projetos. O controle SHALL iniciar desligado em cada sessão, SHALL ser reiniciado para desligado em todo login e logout e SHALL NÃO ser persistido em banco de dados nem em `localStorage`.

#### Scenario: Preferência desligada ao autenticar
- **WHEN** o usuário autentica na aplicação
- **THEN** o controle "Mostrar projetos ocultos" está desligado

#### Scenario: Alternar pelo dropdown do avatar
- **WHEN** o usuário aciona o controle no dropdown do avatar
- **THEN** a preferência é alternada para a sessão atual e a listagem de projetos reflete o novo valor

#### Scenario: Alternar pela página de conta
- **WHEN** o usuário aciona o controle na seção de preferências de `/account`
- **THEN** a preferência é alternada e o valor é o mesmo exibido no dropdown do avatar

#### Scenario: Preferência é reiniciada no login
- **WHEN** o usuário faz logout e autentica novamente
- **THEN** a preferência volta a estar desligada, independentemente do valor anterior

#### Scenario: Armazenamento indisponível
- **WHEN** o navegador bloqueia o acesso ao armazenamento de sessão
- **THEN** a preferência permanece utilizável durante a sessão em memória, a aplicação continua funcional e nenhum erro é exibido ao usuário

## MODIFIED Requirements

### Requirement: Dropdown de perfil no avatar do usuário
O sistema SHALL exibir um menu dropdown ao clicar no `UserAvatar` em qualquer header da aplicação. O dropdown SHALL conter o controle "Mostrar projetos ocultos" e as opções "Configurações da conta" e "Sair".

#### Scenario: Abrir dropdown no header da página de projetos
- **WHEN** o usuário clica no avatar na `ProjectsPage`
- **THEN** um menu dropdown é exibido com o controle "Mostrar projetos ocultos" e as opções "Configurações da conta" e "Sair"

#### Scenario: Abrir dropdown no header do board
- **WHEN** o usuário clica no avatar na `BoardPage`
- **THEN** um menu dropdown é exibido com o controle "Mostrar projetos ocultos" e as opções "Configurações da conta" e "Sair"

#### Scenario: Navegar para configurações de conta
- **WHEN** o usuário clica em "Configurações da conta" no dropdown
- **THEN** o sistema navega para a rota `/account`

#### Scenario: Sair pelo dropdown
- **WHEN** o usuário clica em "Sair" no dropdown
- **THEN** o sistema encerra a sessão e redireciona para a tela de login

#### Scenario: Alternar projetos ocultos pelo dropdown
- **WHEN** o usuário aciona "Mostrar projetos ocultos" no dropdown
- **THEN** o estado do controle é alternado e a listagem de projetos é recarregada considerando o novo valor

### Requirement: Página de configurações de conta
O sistema SHALL disponibilizar a rota `/account` como uma página protegida por autenticação que centraliza as configurações pessoais do usuário. A página SHALL exibir o nome e e-mail do usuário no topo, conter a seção de preferências de visibilidade de projetos e a seção de API Keys.

#### Scenario: Acesso autenticado à página de conta
- **WHEN** um usuário autenticado navega para `/account`
- **THEN** a página é exibida com nome, e-mail do usuário, a preferência "Mostrar projetos ocultos" e a seção de API Keys

#### Scenario: Acesso não autenticado redireciona para login
- **WHEN** um usuário não autenticado acessa `/account`
- **THEN** o sistema redireciona para a tela de login

#### Scenario: Botão de voltar na página de conta
- **WHEN** o usuário clica no botão de voltar
- **THEN** o sistema navega para `/projects`
